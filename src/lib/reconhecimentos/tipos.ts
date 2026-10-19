// Tipos das linhas devolvidas pela API da aba Reconhecimentos.
export interface TipoReconhecimento {
    id: string
    nome: string
    escopo: 'projeto' | 'pessoa'
    ativo: boolean
    ordem: number
}

export interface RegraBonificacao {
    id: string
    nome: string
    tipo_id: string | null
    criterio: string
    quantidade_necessaria: number
    ciclo: number
    requer_rg_adiantada: boolean
    requer_projeto_adiantado: boolean
    tipo_premiacao: string
    valor: number | string
    descricao_premiacao: string | null
    prazo_dias: number | null
    ativo: boolean
    ordem: number
    reconhecimento_tipos?: { nome: string; escopo: string } | null
}

export interface Reconhecimento {
    id: string
    tipo_id: string
    data: string
    projeto_id: string | null
    projeto_nome: string | null
    pessoa_nome: string | null
    adiantado: boolean
    rg_adiantada: boolean
    projeto_adiantado: boolean
    nucleo_impacto: string | null
    observacao: string | null
    criado_por: string | null
    created_at: string
    reconhecimento_tipos?: { nome: string; escopo: string } | null
}

export interface Bonificacao {
    id: string
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
    valor: number | string
    descricao_premiacao: string | null
    status: string
    liberada_em: string
    prazo_limite: string | null
    entregue_em: string | null
    entregue_por: string | null
    entregue_para: string | null
    observacao_entrega: string | null
    cancelada_em: string | null
    cancelada_por: string | null
    justificativa_cancelamento: string | null
    created_at: string
}

export interface EventoBonificacao {
    id: string
    bonificacao_id: string
    evento: string
    detalhe: string | null
    usuario: string | null
    created_at: string
}

export interface ConfigBonificacoes {
    id: string
    prazo_padrao_dias: number | null
}

export interface DadosReconhecimentos {
    tipos: TipoReconhecimento[]
    regras: RegraBonificacao[]
    reconhecimentos: Reconhecimento[]
    bonificacoes: Bonificacao[]
    config: ConfigBonificacoes | null
}

export interface ResultadoSincronizacao {
    novas: number
    expiradas: number
}

export const adiantadoReconhecimento = (r: Pick<Reconhecimento, 'adiantado' | 'rg_adiantada' | 'projeto_adiantado'>) =>
    !!(r.adiantado || r.rg_adiantada || r.projeto_adiantado)
