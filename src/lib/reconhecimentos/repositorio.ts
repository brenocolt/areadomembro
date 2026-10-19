// Acesso a dados da aba Reconhecimentos (SERVIDOR). Recebe o cliente com a
// service role já criado pelo guard, depois de validar sessão + VP/ADMIN.
// Reconstrói a lógica que no sistema de origem rodava no navegador
// (sincronizarBonificacoes, registrar, ajustar RGs, entregar, cancelar...).
import type { SupabaseClient } from '@supabase/supabase-js'
import { calcularBonificacoes, type ReconhecimentoMotor, type RegraMotor, type BonificacaoExistente } from './engine'
import { hojeISO, normalizar } from './datas'
import { OBS_RG_ANTERIOR, STATUS_ABERTOS } from './constantes'
import { ErroDeRequisicao } from './erros'
import { validarNucleo, type EntradaRegistro, type EntradaRegra } from './validacao'

type Db = SupabaseClient
/* eslint-disable @typescript-eslint/no-explicit-any */
type Linha = Record<string, any>

const PAGINA = 1000
const LOTE = 200

type Resposta<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>

// PostgREST devolve no máximo 1000 linhas por consulta: pagina até acabar.
async function buscarTudo<T = Linha>(montar: (de: number, ate: number) => Resposta<T>): Promise<T[]> {
    const todas: T[] = []
    for (let de = 0; ; de += PAGINA) {
        const { data, error } = await montar(de, de + PAGINA - 1)
        if (error) throw new Error(error.message)
        if (!data || data.length === 0) break
        todas.push(...data)
        if (data.length < PAGINA) break
    }
    return todas
}

function falhou(error: { message: string } | null | undefined, contexto?: string) {
    if (error) throw new Error(contexto ? `${contexto}: ${error.message}` : error.message)
}

function emLotes<T>(itens: T[], tamanho = LOTE): T[][] {
    const lotes: T[][] = []
    for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho))
    return lotes
}

// ---------------------------------------------------------------- leitura

export async function listarDados(db: Db) {
    const [tipos, regras, reconhecimentos, bonificacoes, config] = await Promise.all([
        buscarTudo((de, ate) => db.from('reconhecimento_tipos').select('*').order('ordem').order('id').range(de, ate)),
        buscarTudo((de, ate) => db.from('regras_bonificacao').select('*, reconhecimento_tipos(nome, escopo)').order('ordem').order('id').range(de, ate)),
        buscarTudo((de, ate) => db.from('reconhecimentos').select('*, reconhecimento_tipos(nome, escopo)').order('data', { ascending: false }).order('created_at', { ascending: false }).order('id').range(de, ate)),
        buscarTudo((de, ate) => db.from('bonificacoes').select('*').order('liberada_em', { ascending: false }).order('created_at', { ascending: false }).order('id').range(de, ate)),
        db.from('bonificacoes_config').select('*').limit(1).maybeSingle(),
    ])
    falhou(config.error)
    return { tipos, regras, reconhecimentos, bonificacoes, config: config.data ?? null }
}

export async function listarProjetos(db: Db) {
    const { data, error } = await db.from('projetos').select('id, nome').eq('status', 'Ativo').order('nome')
    falhou(error)
    return (data || []) as Array<{ id: string; nome: string }>
}

export async function listarEventos(db: Db, bonificacaoId: string) {
    const { data, error } = await db.from('bonificacao_eventos').select('*').eq('bonificacao_id', bonificacaoId).order('created_at')
    falhou(error)
    return data || []
}

// ----------------------------------------------------------------- motor

export interface ResultadoSincronizacao {
    novas: number
    expiradas: number
}

/**
 * Recalcula as bonificações a partir dos reconhecimentos: cria só o que ainda
 * não existe (chave de marco única) e expira os prazos vencidos.
 * Gatilhos (iguais ao original): abrir a aba, registrar, ajustar RGs, salvar regra.
 */
export async function sincronizarBonificacoes(db: Db, usuarioEmail: string): Promise<ResultadoSincronizacao> {
    const [regras, recs, config, existentes] = await Promise.all([
        buscarTudo<RegraMotor>((de, ate) => db.from('regras_bonificacao').select('*, reconhecimento_tipos(nome)').eq('ativo', true).order('ordem').order('id').range(de, ate)),
        buscarTudo<ReconhecimentoMotor>((de, ate) => db.from('reconhecimentos').select('*').order('data').order('created_at').order('id').range(de, ate)),
        db.from('bonificacoes_config').select('*').limit(1).maybeSingle(),
        buscarTudo<BonificacaoExistente>((de, ate) => db.from('bonificacoes').select('id, marco_chave, status, prazo_limite').order('id').range(de, ate)),
    ])
    falhou(config.error)

    const { novas, expirar } = calcularBonificacoes(regras, recs, config.data?.prazo_padrao_dias ?? null, existentes, hojeISO())

    let criadas = 0
    for (const lote of emLotes(novas)) {
        // ON CONFLICT DO NOTHING: duas sincronizações simultâneas não derrubam o lote.
        const { data, error } = await db
            .from('bonificacoes')
            .upsert(lote, { onConflict: 'marco_chave', ignoreDuplicates: true })
            .select('id')
        falhou(error)
        if (data?.length) {
            const ev = await db.from('bonificacao_eventos').insert(
                data.map((b: Linha) => ({
                    bonificacao_id: b.id,
                    evento: 'criada',
                    detalhe: 'Bonificação gerada automaticamente pela regra',
                    usuario: usuarioEmail,
                })),
            )
            falhou(ev.error, 'Bonificações criadas, mas o histórico falhou')
            criadas += data.length
        }
    }

    let expiradas = 0
    for (const lote of emLotes(expirar)) {
        // O filtro de status evita sobrescrever uma entrega/cancelamento concorrente.
        const { data, error } = await db
            .from('bonificacoes')
            .update({ status: 'expirada' })
            .in('id', lote.map(b => b.id))
            .eq('status', 'disponivel')
            .select('id')
        falhou(error)
        const atualizadas = new Set((data || []).map((b: Linha) => b.id))
        const eventos = lote.filter(b => atualizadas.has(b.id)).map(b => ({
            bonificacao_id: b.id,
            evento: 'expirada',
            detalhe: `Prazo limite ${b.prazo_limite} ultrapassado`,
            usuario: 'sistema',
        }))
        if (eventos.length) {
            const ev = await db.from('bonificacao_eventos').insert(eventos)
            falhou(ev.error, 'Bonificações expiradas, mas o histórico falhou')
            expiradas += eventos.length
        }
    }

    return { novas: criadas, expiradas }
}

// ------------------------------------------------------- reconhecimentos

export async function registrarReconhecimento(db: Db, usuarioEmail: string, entrada: EntradaRegistro): Promise<ResultadoSincronizacao> {
    const { data: tipo, error } = await db.from('reconhecimento_tipos').select('id, nome, escopo, ativo').eq('id', entrada.tipo_id).maybeSingle()
    falhou(error)
    if (!tipo || !tipo.ativo) throw new ErroDeRequisicao('Selecione o tipo de reconhecimento')

    const isProjeto = tipo.escopo === 'projeto'
    // O tipo "Núcleo" é detectado pelo nome (comportamento do original, L-10).
    const isNucleoImpacto = normalizar(tipo.nome).includes('nucleo')

    let linhas: Linha[]
    if (isProjeto) {
        if (!entrada.projeto_id) throw new ErroDeRequisicao('Selecione o projeto')
        const { data: projeto, error: erroProjeto } = await db.from('projetos').select('id, nome').eq('id', entrada.projeto_id).maybeSingle()
        falhou(erroProjeto)
        if (!projeto) throw new ErroDeRequisicao('Projeto não encontrado')
        const base = {
            tipo_id: tipo.id,
            data: entrada.data,
            projeto_id: projeto.id,
            projeto_nome: projeto.nome || '',
            rg_adiantada: false,
            projeto_adiantado: false,
            nucleo_impacto: null,
            criado_por: usuarioEmail,
        }
        linhas = [{ ...base, adiantado: entrada.adiantado, observacao: entrada.observacao }]
        // RGs adiantadas registradas antes do uso do sistema (entram na contagem).
        for (let i = 0; i < entrada.rgs_anteriores; i++) {
            linhas.push({ ...base, adiantado: true, observacao: OBS_RG_ANTERIOR })
        }
    } else if (isNucleoImpacto) {
        const nucleo = validarNucleo(entrada.nucleo)
        linhas = [{ tipo_id: tipo.id, data: entrada.data, pessoa_nome: nucleo, nucleo_impacto: nucleo, observacao: entrada.observacao, criado_por: usuarioEmail }]
    } else {
        if (!entrada.pessoa_nome) throw new ErroDeRequisicao('Informe o nome da pessoa reconhecida')
        linhas = [{ tipo_id: tipo.id, data: entrada.data, pessoa_nome: entrada.pessoa_nome, nucleo_impacto: null, observacao: entrada.observacao, criado_por: usuarioEmail }]
    }

    const ins = await db.from('reconhecimentos').insert(linhas)
    falhou(ins.error)
    return sincronizarBonificacoes(db, usuarioEmail)
}

export async function excluirReconhecimento(db: Db, id: string) {
    // Não roda o motor e não mexe nas bonificações já geradas (FK SET NULL).
    const { data, error } = await db.from('reconhecimentos').delete().eq('id', id).select('id')
    falhou(error)
    if (!data?.length) throw new ErroDeRequisicao('Reconhecimento não encontrado', 404)
}

export async function ajustarRgsAnteriores(
    db: Db, usuarioEmail: string, projetoId: string, quantidade: number,
): Promise<ResultadoSincronizacao & { semAlteracao: boolean }> {
    const { data, error } = await db
        .from('reconhecimentos')
        .select('*')
        .eq('projeto_id', projetoId)
        .order('data', { ascending: false })
        .order('created_at', { ascending: false })
    falhou(error)
    const recsProjeto = (data || []) as Linha[]
    if (recsProjeto.length === 0) throw new ErroDeRequisicao('Projeto sem reconhecimentos registrados')

    const anteriores = recsProjeto.filter(r => r.observacao === OBS_RG_ANTERIOR)
    const diff = quantidade - anteriores.length
    if (diff === 0) return { novas: 0, expiradas: 0, semAlteracao: true }

    if (diff > 0) {
        const base = recsProjeto[0]
        const primeiraData = recsProjeto.map(r => r.data as string).sort()[0]
        const linhas = Array.from({ length: diff }, () => ({
            tipo_id: base.tipo_id,
            data: primeiraData,
            projeto_id: projetoId,
            projeto_nome: base.projeto_nome || '',
            adiantado: true,
            rg_adiantada: false,
            projeto_adiantado: false,
            nucleo_impacto: null,
            observacao: OBS_RG_ANTERIOR,
            criado_por: usuarioEmail,
        }))
        const ins = await db.from('reconhecimentos').insert(linhas)
        falhou(ins.error)
    } else {
        const remover = [...anteriores]
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
            .slice(0, -diff)
        const del = await db.from('reconhecimentos').delete().in('id', remover.map(r => r.id))
        falhou(del.error)
    }

    return { ...(await sincronizarBonificacoes(db, usuarioEmail)), semAlteracao: false }
}

// ---------------------------------------------------- tipos, regras, config

export async function criarTipo(db: Db, nome: string) {
    const { count, error } = await db.from('reconhecimento_tipos').select('id', { count: 'exact', head: true })
    falhou(error)
    const ins = await db.from('reconhecimento_tipos').insert({ nome, escopo: 'pessoa', ordem: (count ?? 0) + 1 })
    falhou(ins.error)
}

export async function salvarRegra(db: Db, usuarioEmail: string, id: string | null, entrada: EntradaRegra): Promise<ResultadoSincronizacao> {
    const { data: tipo, error } = await db.from('reconhecimento_tipos').select('id').eq('id', entrada.tipo_id).maybeSingle()
    falhou(error)
    if (!tipo) throw new ErroDeRequisicao('Selecione o tipo de reconhecimento')

    if (id) {
        const { data, error: erroUpd } = await db.from('regras_bonificacao').update(entrada).eq('id', id).select('id')
        falhou(erroUpd)
        if (!data?.length) throw new ErroDeRequisicao('Regra não encontrada', 404)
    } else {
        const ins = await db.from('regras_bonificacao').insert(entrada)
        falhou(ins.error)
    }
    return sincronizarBonificacoes(db, usuarioEmail)
}

export async function salvarPrazoPadrao(db: Db, dias: number | null) {
    const { data, error } = await db.from('bonificacoes_config').select('id').limit(1).maybeSingle()
    falhou(error)
    if (data?.id) {
        const upd = await db.from('bonificacoes_config').update({ prazo_padrao_dias: dias, updated_at: new Date().toISOString() }).eq('id', data.id)
        falhou(upd.error)
    } else {
        const ins = await db.from('bonificacoes_config').insert({ prazo_padrao_dias: dias })
        falhou(ins.error)
    }
}

// ------------------------------------------------- entrega e cancelamento

async function exigirBonificacaoAberta(db: Db, id: string, campos: Linha, evento: Linha) {
    // Só `disponivel`/`expirada` aceitam a transição (no original, só a interface garantia isso).
    const { data, error } = await db.from('bonificacoes').update(campos).eq('id', id).in('status', STATUS_ABERTOS).select('id')
    falhou(error)
    if (!data?.length) {
        const { data: existe } = await db.from('bonificacoes').select('id').eq('id', id).maybeSingle()
        if (!existe) throw new ErroDeRequisicao('Bonificação não encontrada', 404)
        throw new ErroDeRequisicao('Esta bonificação já foi entregue ou cancelada.', 409)
    }
    const ev = await db.from('bonificacao_eventos').insert({ bonificacao_id: id, ...evento })
    falhou(ev.error, 'Status atualizado, mas o histórico não foi gravado')
}

export async function entregarBonificacao(
    db: Db, usuarioEmail: string, id: string, entrega: { entregue_para: string | null; observacao: string | null },
) {
    await exigirBonificacaoAberta(
        db, id,
        {
            status: 'entregue',
            entregue_em: new Date().toISOString(),
            entregue_por: usuarioEmail,
            entregue_para: entrega.entregue_para,
            observacao_entrega: entrega.observacao,
        },
        {
            evento: 'entregue',
            detalhe: [entrega.entregue_para ? `Entregue para: ${entrega.entregue_para}` : null, entrega.observacao].filter(Boolean).join(' — ') || null,
            usuario: usuarioEmail,
        },
    )
}

export async function cancelarBonificacao(db: Db, usuarioEmail: string, id: string, justificativa: string) {
    await exigirBonificacaoAberta(
        db, id,
        {
            status: 'cancelada',
            cancelada_em: new Date().toISOString(),
            cancelada_por: usuarioEmail,
            justificativa_cancelamento: justificativa,
        },
        { evento: 'cancelada', detalhe: justificativa, usuario: usuarioEmail },
    )
}
