// Motor de regras e de entregas — funções PURAS (sem acesso a dados), testáveis.
// Regras de negócio da aba (documento docs/reconhecimentos-v2/PROPOSTA.md §3).
import { adicionarDias } from './datas'

// ------------------------------------------------------------------ RGs

/** Próximo número de RG do projeto = maior número já registrado + 1 (1 se não houver). */
export function proximoNumeroRg(numeros: Array<number | null | undefined>): number {
    return numeros.reduce<number>((max, n) => (typeof n === 'number' && n > max ? n : max), 0) + 1
}

/** O número cai num marco da regra? Sem repetição, só o marco inicial; com, a cada `repetir` a partir dele. */
export function ehMarco(numero: number, aPartirDe: number, repetirACada: number | null): boolean {
    if (!Number.isInteger(numero) || numero < aPartirDe) return false
    if (!repetirACada) return numero === aPartirDe
    return (numero - aPartirDe) % repetirACada === 0
}

// ------------------------------------------------------- geração de bonificações

export interface RegraMotor {
    id: string
    nome: string
    tipo_id: string
    gatilho: 'cada_reconhecimento' | 'marcos_de_rg'
    a_partir_de: number | null
    repetir_a_cada: number | null
    tipo_premiacao: string
    valor: number | string | null
    descricao_premiacao: string
    prazo_dias: number | null
    vigente_desde: string
    ativo: boolean
}

export interface ReconhecimentoMotor {
    id: string
    tipo_id: string
    data_reconhecimento: string
    projeto_id: string | null
    projeto_nome: string | null
    colaborador_id: string | null
    colaborador_nome: string | null
    nucleo: string | null
    numero_rg: number | null
    created_at: string
}

export interface NovaBonificacao {
    regra_id: string
    reconhecimento_id: string
    chave_unica: string
    marco: number | null
    tipo_nome: string
    regra_nome: string
    motivo: string
    projeto_id: string | null
    projeto_nome: string | null
    colaborador_id: string | null
    colaborador_nome: string | null
    nucleo: string | null
    tipo_premiacao: string
    valor: number | null
    descricao_premiacao: string
    status: 'disponivel'
    liberada_em: string
    prazo_limite: string | null
}

export const chaveCadaReconhecimento = (regraId: string, reconhecimentoId: string) => `rec:${regraId}:${reconhecimentoId}`
export const chaveMarcoRg = (regraId: string, projetoId: string, marco: number) => `rg:${regraId}:${projetoId}:${marco}`

export interface EntradaGeracao {
    regras: RegraMotor[]
    reconhecimentos: ReconhecimentoMotor[]
    nomesDosTipos: Record<string, string>
    chavesExistentes: Iterable<string>
    /** Ignora a vigência das regras (usado só no "aplicar a registros anteriores"). */
    ignorarVigencia?: boolean
}

/**
 * Calcula as bonificações que ainda NÃO existem. Idempotente: o que já tem chave é ignorado.
 * Só considera regras ativas e reconhecimentos REGISTRADOS depois da vigência da regra (a menos que ignorarVigencia):
 * criar uma regra nova não gera bonificações para o que já estava registrado — para isso há o "aplicar a registros anteriores".
 * Nenhum valor ou regra é inventado: tudo vem da configuração.
 */
export function calcularNovasBonificacoes(entrada: EntradaGeracao): NovaBonificacao[] {
    const jaExistem = new Set(entrada.chavesExistentes)
    const novas: NovaBonificacao[] = []

    const criar = (regra: RegraMotor, rec: ReconhecimentoMotor, chave: string, motivo: string, marco: number | null) => {
        if (jaExistem.has(chave)) return
        jaExistem.add(chave)
        const valor = regra.valor === null || regra.valor === undefined || regra.valor === '' ? null : Number(regra.valor)
        novas.push({
            regra_id: regra.id,
            reconhecimento_id: rec.id,
            chave_unica: chave,
            marco,
            tipo_nome: entrada.nomesDosTipos[rec.tipo_id] ?? '',
            regra_nome: regra.nome,
            motivo,
            projeto_id: rec.projeto_id,
            projeto_nome: rec.projeto_nome,
            colaborador_id: rec.colaborador_id,
            colaborador_nome: rec.colaborador_nome,
            nucleo: rec.nucleo,
            tipo_premiacao: regra.tipo_premiacao,
            valor,
            descricao_premiacao: regra.descricao_premiacao || '',
            status: 'disponivel',
            liberada_em: rec.data_reconhecimento,
            prazo_limite: regra.prazo_dias ? adicionarDias(rec.data_reconhecimento, regra.prazo_dias) : null,
        })
    }

    for (const regra of entrada.regras) {
        if (!regra.ativo) continue
        const vigencia = Date.parse(regra.vigente_desde)
        const elegiveis = entrada.reconhecimentos.filter(r =>
            r.tipo_id === regra.tipo_id && (entrada.ignorarVigencia || Date.parse(r.created_at) >= vigencia))

        if (regra.gatilho === 'cada_reconhecimento') {
            for (const rec of elegiveis) criar(regra, rec, chaveCadaReconhecimento(regra.id, rec.id), regra.nome, null)
            continue
        }
        // marcos_de_rg: a RG com número igual a um marco gera a bonificação daquele marco (por projeto)
        if (regra.a_partir_de === null) continue
        for (const rec of elegiveis) {
            if (!rec.projeto_id || rec.numero_rg === null) continue
            if (!ehMarco(rec.numero_rg, regra.a_partir_de, regra.repetir_a_cada)) continue
            criar(regra, rec, chaveMarcoRg(regra.id, rec.projeto_id, rec.numero_rg), `${rec.numero_rg}ª RG reconhecida`, rec.numero_rg)
        }
    }
    return novas
}

// ---------------------------------------------------------------- expiração

export interface BonificacaoParaExpirar {
    id: string
    status: string
    prazo_limite: string | null
}

/**
 * Expira apenas o que está `disponivel`, com prazo vencido (prazo < hoje) e SEM nenhuma entrega concluída.
 * Solicitações/aprovações pendentes não impedem a expiração, mas ficam preservadas.
 */
export function bonificacoesParaExpirar(
    bonificacoes: BonificacaoParaExpirar[],
    entregasConcluidasPorBonificacao: Set<string>,
    hoje: string,
): string[] {
    return bonificacoes
        .filter(b => b.status === 'disponivel' && b.prazo_limite && b.prazo_limite < hoje && !entregasConcluidasPorBonificacao.has(b.id))
        .map(b => b.id)
}

// ------------------------------------------------------------------ entregas

export interface DatasEntrega {
    situacao: 'solicitada' | 'aprovada' | 'entregue'
    solicitada_em?: string | null
    aprovada_em?: string | null
    entregue_em?: string | null
}

export interface EntregaNormalizada {
    situacao: 'solicitada' | 'aprovada' | 'entregue'
    solicitada_em: string | null
    aprovada_em: string | null
    entregue_em: string | null
}

/**
 * Coerência entre situação e datas: preenche o que falta com `hoje` e apaga o que não vale mais
 * (ex.: voltar de "entregue" para "aprovada" limpa a data de entrega).
 * Lança Error com mensagem em português se a ordem das datas for impossível.
 */
export function normalizarEntrega(d: DatasEntrega, hoje: string): EntregaNormalizada {
    const solicitada = d.solicitada_em || null
    let aprovada = d.aprovada_em || null
    let entregue = d.entregue_em || null
    if (d.situacao === 'solicitada') {
        aprovada = null; entregue = null
        return { situacao: 'solicitada', solicitada_em: solicitada ?? hoje, aprovada_em: null, entregue_em: null }
    }
    if (d.situacao === 'aprovada') {
        entregue = null
        aprovada = aprovada ?? hoje
        if (solicitada && aprovada < solicitada) throw new Error('A data de aprovação não pode ser anterior à data da solicitação.')
        return { situacao: 'aprovada', solicitada_em: solicitada, aprovada_em: aprovada, entregue_em: null }
    }
    entregue = entregue ?? hoje
    aprovada = aprovada ?? entregue
    if (solicitada && aprovada < solicitada) throw new Error('A data de aprovação não pode ser anterior à data da solicitação.')
    if (entregue < aprovada) throw new Error('A data de entrega não pode ser anterior à data de aprovação.')
    return { situacao: 'entregue', solicitada_em: solicitada, aprovada_em: aprovada, entregue_em: entregue }
}

export interface ResumoEntregas {
    total: number
    solicitadas: number
    aprovadas: number
    entregues: number
    pendentes: number
}

export function resumirEntregas(entregas: Array<{ situacao: string }>): ResumoEntregas {
    const conta = (s: string) => entregas.filter(e => e.situacao === s).length
    return {
        total: entregas.length,
        solicitadas: conta('solicitada'),
        aprovadas: conta('aprovada'),
        entregues: conta('entregue'),
        pendentes: conta('solicitada') + conta('aprovada'),
    }
}

/** O cartão só pode ser concluído ("Entregue") com ≥ 1 entrega concluída e nenhuma pendente. */
export function podeConcluir(entregas: Array<{ situacao: string }>): { ok: true } | { ok: false; motivo: string } {
    const r = resumirEntregas(entregas)
    if (r.entregues === 0) return { ok: false, motivo: 'Registre ao menos uma entrega concluída antes de concluir a bonificação.' }
    if (r.pendentes > 0) {
        return { ok: false, motivo: `Ainda há ${r.pendentes} colaborador(es) com solicitação pendente (solicitada ou aprovada, sem entrega). Conclua ou ajuste essas entregas primeiro.` }
    }
    return { ok: true }
}

/** Cancelar é bloqueado se alguém já recebeu. */
export function podeCancelar(entregas: Array<{ situacao: string }>): { ok: true } | { ok: false; motivo: string } {
    return resumirEntregas(entregas).entregues > 0
        ? { ok: false, motivo: 'Esta bonificação já tem entrega concluída e não pode ser cancelada.' }
        : { ok: true }
}

// ------------------------------------------------------------------ prazo

/** Dias entre hoje e o prazo (negativo = vencido). null quando não há prazo. */
export function diasRestantes(prazo: string | null | undefined, hoje: string): number | null {
    if (!prazo) return null
    const [a, m, d] = prazo.split('-').map(Number)
    const [ha, hm, hd] = hoje.split('-').map(Number)
    return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ha, hm - 1, hd)) / 86400000)
}
