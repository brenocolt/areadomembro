// Motor de bonificações — função pura, sem acesso a dados.
// Reconstrução fiel de bonificacoes-engine.ts (pacote de migração), com a
// aritmética de datas corrigida (sem dependência de fuso). Especificação em
// docs/migracao-reconhecimentos/02-especificacao-tecnica.md §3.1.
import { adicionarDias } from './datas'

export interface RegraMotor {
    id: string
    nome: string
    tipo_id: string | null
    criterio: string
    quantidade_necessaria: number | null
    ciclo: number | null
    requer_rg_adiantada: boolean
    requer_projeto_adiantado: boolean
    tipo_premiacao: string
    valor: number | string | null
    descricao_premiacao: string | null
    prazo_dias: number | null
    reconhecimento_tipos?: { nome?: string | null } | null
}

export interface ReconhecimentoMotor {
    id: string
    tipo_id: string
    data: string
    projeto_id?: string | null
    projeto_nome?: string | null
    pessoa_nome?: string | null
    adiantado?: boolean | null
    rg_adiantada?: boolean | null
    projeto_adiantado?: boolean | null
    nucleo_impacto?: string | null
}

export interface BonificacaoExistente {
    id: string
    marco_chave: string
    status: string
    prazo_limite: string | null
}

export interface NovaBonificacao {
    regra_id: string
    reconhecimento_id: string
    marco_chave: string
    marco: number
    projeto_id: string | null
    projeto_nome: string | null
    pessoa_nome: string | null
    nucleo_impacto: string | null
    tipo_nome: string
    regra_nome: string
    motivo: string
    tipo_premiacao: string
    valor: number
    descricao_premiacao: string | null
    status: 'disponivel'
    liberada_em: string
    prazo_limite: string | null
}

export interface ResultadoMotor {
    novas: NovaBonificacao[]
    expirar: Array<{ id: string; prazo_limite: string }>
}

// Chaves de idempotência das bonificações. Exportadas para que uma futura
// importação de dados históricos gere EXATAMENTE as mesmas chaves do motor.
export function sujeitoDe(rec: ReconhecimentoMotor) {
    const key = rec.projeto_id || rec.projeto_nome || rec.pessoa_nome || 'sem-identificacao'
    return {
        key: String(key),
        projeto_id: rec.projeto_id || null,
        projeto_nome: rec.projeto_nome || null,
        pessoa_nome: rec.pessoa_nome || null,
    }
}

export const chaveMarcoPorReconhecimento = (regraId: string, reconhecimentoId: string) => `${regraId}:rec:${reconhecimentoId}`
export const chaveMarcoAcumulado = (regraId: string, rec: ReconhecimentoMotor, marco: number) => `${regraId}:${sujeitoDe(rec).key}:${marco}`

const ehAdiantado = (r: ReconhecimentoMotor) => !!(r.adiantado || r.rg_adiantada || r.projeto_adiantado)

/**
 * Calcula quais bonificações criar e quais expirar.
 * @param regras        regras ATIVAS (com o nome do tipo em reconhecimento_tipos)
 * @param reconhecimentos todos os reconhecimentos, em ordem crescente de data
 * @param prazoPadraoDias prazo padrão global (null/undefined = sem prazo)
 * @param existentes    todas as bonificações já gravadas (qualquer status)
 * @param hoje          data de hoje (AAAA-MM-DD, fuso de São Paulo)
 */
export function calcularBonificacoes(
    regras: RegraMotor[],
    reconhecimentos: ReconhecimentoMotor[],
    prazoPadraoDias: number | null | undefined,
    existentes: BonificacaoExistente[],
    hoje: string,
): ResultadoMotor {
    const jaExistem = new Set(existentes.map(b => b.marco_chave))
    const novas: NovaBonificacao[] = []

    const criar = (regra: RegraMotor, rec: ReconhecimentoMotor, marco: number, chave: string, motivo: string, liberadaEm: string) => {
        if (jaExistem.has(chave)) return
        jaExistem.add(chave)
        const s = sujeitoDe(rec)
        const dias = regra.prazo_dias ?? prazoPadraoDias ?? null
        novas.push({
            regra_id: regra.id,
            reconhecimento_id: rec.id,
            marco_chave: chave,
            marco,
            projeto_id: s.projeto_id,
            projeto_nome: s.projeto_nome,
            pessoa_nome: s.pessoa_nome,
            nucleo_impacto: rec.nucleo_impacto || null,
            tipo_nome: regra.reconhecimento_tipos?.nome || '',
            regra_nome: regra.nome,
            motivo,
            tipo_premiacao: regra.tipo_premiacao,
            valor: Number(regra.valor || 0),
            descricao_premiacao: regra.descricao_premiacao,
            status: 'disponivel',
            liberada_em: liberadaEm,
            // 0 e vazio significam "sem prazo".
            prazo_limite: dias ? adicionarDias(liberadaEm, Number(dias)) : null,
        })
    }

    for (const regra of regras) {
        if (regra.criterio === 'simbolico') continue
        const exigeAdiantado = !!(regra.requer_rg_adiantada || regra.requer_projeto_adiantado)
        const doTipo = reconhecimentos.filter(r => r.tipo_id === regra.tipo_id)
        const elegiveis = doTipo.filter(r => !exigeAdiantado || ehAdiantado(r))

        if (regra.criterio === 'por_reconhecimento') {
            for (const rec of elegiveis) {
                criar(regra, rec, 1, chaveMarcoPorReconhecimento(regra.id, rec.id), regra.nome, rec.data)
            }
            continue
        }

        // acumulado
        const grupos = new Map<string, ReconhecimentoMotor[]>()
        for (const rec of elegiveis) {
            const k = sujeitoDe(rec).key
            grupos.set(k, [...(grupos.get(k) || []), rec])
        }
        for (const lista of grupos.values()) {
            lista.sort((a, b) => a.data.localeCompare(b.data))
            const q = Math.max(1, Number(regra.quantidade_necessaria || 1))
            const ciclo = Number(regra.ciclo || 0)
            for (let m = q; m <= lista.length; m += ciclo > 0 ? ciclo : Number.MAX_SAFE_INTEGER) {
                const gatilho = lista[m - 1]
                const rotulo = exigeAdiantado ? 'reconhecimentos adiantados' : 'reconhecimentos'
                criar(regra, gatilho, m, chaveMarcoAcumulado(regra.id, gatilho, m), `${m} ${rotulo}`, gatilho.data)
                if (ciclo <= 0) break
            }
        }
    }

    // Só expira o que já existia antes desta execução (as novas não entram).
    const expirar = existentes
        .filter(b => b.status === 'disponivel' && b.prazo_limite && b.prazo_limite < hoje)
        .map(b => ({ id: b.id, prazo_limite: b.prazo_limite as string }))

    return { novas, expirar }
}

// Dias entre hoje e o prazo (negativo = vencido). null quando não há prazo.
export function diasRestantes(prazo: string | null | undefined, hoje: string): number | null {
    if (!prazo) return null
    const [a, m, d] = prazo.split('-').map(Number)
    const [ha, hm, hd] = hoje.split('-').map(Number)
    return Math.round((Date.UTC(a, m - 1, d) - Date.UTC(ha, hm - 1, hd)) / 86400000)
}
