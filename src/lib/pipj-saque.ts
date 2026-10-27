// Reversão de um saque de PIPJ já APROVADO. Sem dependências além do cliente Supabase recebido por parâmetro
// (testável com um cliente falso).
//
// O que faz: devolve o valor ao saldo do colaborador, registra o estorno em transacoes_pipj (aparece em
// "Registros de Alterações de Saldo", com quem fez e o motivo) e reabre a solicitação como PENDENTE
// (a decisão é desfeita: ela pode ser aprovada de novo ou rejeitada). Não altera o esquema do banco.
//
// Atenção de negócio: se o pagamento (PIX) já foi feito fora do sistema, reverter NÃO o recupera.

export class ErroPipj extends Error {
    status: number
    constructor(message: string, status = 400) {
        super(message)
        this.name = 'ErroPipj'
        this.status = status
    }
}

// Só o que a função usa do cliente Supabase.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Cliente = { from: (tabela: string) => any }

export interface ResultadoReversao {
    valor: number
    colaboradorId: string
    novoSaldo: number
}

const TENTATIVAS_SALDO = 5

export const PREFIXO_ESTORNO = 'Estorno de saque aprovado'

export async function reverterSaqueAprovado(
    db: Cliente,
    entrada: { id: string; motivo: string; ator: string; agora?: Date },
): Promise<ResultadoReversao> {
    const motivo = (entrada.motivo || '').trim()
    if (!entrada.id) throw new ErroPipj('Solicitação inválida.')
    if (motivo.length < 3) throw new ErroPipj('Informe o motivo da reversão.')
    if (motivo.length > 300) throw new ErroPipj('Motivo muito longo (máx. 300 caracteres).')
    const agora = (entrada.agora ?? new Date()).toISOString()

    const { data: saque, error: erroBusca } = await db
        .from('solicitacoes_saque')
        .select('id, colaborador_id, valor, status, tipo, data_aprovacao, aprovado_por')
        .eq('id', entrada.id)
        .maybeSingle()
    if (erroBusca) throw new ErroPipj('Erro ao buscar a solicitação.', 500)
    if (!saque) throw new ErroPipj('Solicitação não encontrada.', 404)
    if (saque.tipo !== 'saque_pipj') throw new ErroPipj('Só saques de PIPJ podem ser revertidos aqui.')
    if (saque.status !== 'APROVADO') throw new ErroPipj('Só é possível reverter um saque que está APROVADO.', 409)

    const valor = Number(saque.valor)
    if (!Number.isFinite(valor) || valor <= 0) throw new ErroPipj('Valor da solicitação inválido.', 500)

    // 1) "Reserva" a reversão: só uma execução consegue trocar APROVADO -> PENDENTE (evita reverter duas vezes).
    const { data: reservado, error: erroReserva } = await db
        .from('solicitacoes_saque')
        .update({ status: 'PENDENTE', data_aprovacao: null, aprovado_por: null })
        .eq('id', saque.id)
        .eq('status', 'APROVADO')
        .select('id')
    if (erroReserva) throw new ErroPipj('Erro ao reabrir a solicitação.', 500)
    if (!reservado || reservado.length === 0) throw new ErroPipj('Este saque já foi revertido ou alterado por outra pessoa.', 409)

    const desfazerReserva = async () => {
        await db
            .from('solicitacoes_saque')
            .update({ status: 'APROVADO', data_aprovacao: saque.data_aprovacao, aprovado_por: saque.aprovado_por })
            .eq('id', saque.id)
    }

    // 2) Registra o estorno (rastro de quem fez e por quê).
    const { data: tx, error: erroTx } = await db
        .from('transacoes_pipj')
        .insert({
            colaborador_id: saque.colaborador_id,
            tipo: 'ENTRADA',
            valor,
            descricao: `${PREFIXO_ESTORNO}: ${motivo}`,
            status: 'CREDITADO',
            data: agora,
            realizado_por: entrada.ator,
        })
        .select('id')
        .single()
    if (erroTx || !tx) {
        await desfazerReserva()
        throw new ErroPipj('Erro ao registrar o estorno. Nada foi alterado.', 500)
    }

    // 3) Devolve o saldo. Atualização "com trava": só grava se o saldo não mudou desde a leitura (senão relê e tenta de novo).
    let novoSaldo: number | null = null
    for (let i = 0; i < TENTATIVAS_SALDO && novoSaldo === null; i++) {
        const { data: colab, error: erroColab } = await db
            .from('colaboradores')
            .select('saldo_pipj')
            .eq('id', saque.colaborador_id)
            .maybeSingle()
        if (erroColab || !colab) break
        const atual = colab.saldo_pipj === null || colab.saldo_pipj === undefined ? null : Number(colab.saldo_pipj)
        const proximo = Number(((atual ?? 0) + valor).toFixed(2))
        let consulta = db.from('colaboradores').update({ saldo_pipj: proximo }).eq('id', saque.colaborador_id)
        consulta = atual === null ? consulta.is('saldo_pipj', null) : consulta.eq('saldo_pipj', colab.saldo_pipj)
        const { data: gravado, error: erroSaldo } = await consulta.select('id')
        if (erroSaldo) break
        if (gravado && gravado.length > 0) novoSaldo = proximo
    }
    if (novoSaldo === null) {
        await db.from('transacoes_pipj').delete().eq('id', tx.id)
        await desfazerReserva()
        throw new ErroPipj('Não foi possível devolver o saldo agora (ele foi alterado ao mesmo tempo). Nada foi alterado; tente de novo.', 409)
    }

    return { valor, colaboradorId: saque.colaborador_id, novoSaldo }
}
