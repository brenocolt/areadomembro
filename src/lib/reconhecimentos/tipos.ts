// Tipos das linhas devolvidas pela API da aba Reconhecimentos.
import type { Escopo, Gatilho, SituacaoEntrega, StatusBonificacao } from './constantes'

export interface TipoReconhecimento {
    id: string
    nome: string
    escopo: Escopo
    usa_periodo: boolean
    ativo: boolean
    ordem: number
}

export interface NucleoConfig {
    nucleo: string
    elegivel: boolean
}

export interface RegraBonificacao {
    id: string
    nome: string
    tipo_id: string
    gatilho: Gatilho
    a_partir_de: number | null
    repetir_a_cada: number | null
    tipo_premiacao: 'financeira' | 'item' | 'simbolica'
    valor: number | string | null
    descricao_premiacao: string
    prazo_dias: number | null
    vigente_desde: string
    ativo: boolean
}

export interface Reconhecimento {
    id: string
    tipo_id: string
    data_reconhecimento: string
    projeto_id: string | null
    projeto_nome: string | null
    colaborador_id: string | null
    colaborador_nome: string | null
    nucleo: string | null
    numero_rg: number | null
    periodo_referencia: string | null
    observacoes: string | null
    criado_por_email: string
    created_at: string
    updated_at: string
}

export interface Bonificacao {
    id: string
    regra_id: string | null
    reconhecimento_id: string | null
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
    tipo_premiacao: 'financeira' | 'item' | 'simbolica'
    valor: number | string | null
    descricao_premiacao: string
    status: StatusBonificacao
    liberada_em: string
    prazo_limite: string | null
    concluida_em: string | null
    concluida_por: string | null
    cancelada_em: string | null
    cancelada_por: string | null
    justificativa_cancelamento: string | null
    origem_alterada: boolean
    created_at: string
}

export interface Entrega {
    id: string
    bonificacao_id: string
    colaborador_id: string
    colaborador_nome: string
    situacao: SituacaoEntrega
    solicitada_em: string | null
    aprovada_em: string | null
    aprovada_por: string | null
    entregue_em: string | null
    entregue_por: string | null
    observacao: string | null
    criado_por_email: string | null
    created_at: string
}

export interface EventoHistorico {
    id: string
    entidade: 'reconhecimento' | 'bonificacao' | 'entrega' | 'regra' | 'tipo' | 'nucleo'
    entidade_id: string | null
    reconhecimento_id: string | null
    bonificacao_id: string | null
    acao: string
    alteracoes: Record<string, { de?: unknown; para?: unknown } | unknown> | null
    detalhe: string | null
    usuario_email: string
    created_at: string
}

export interface DadosReconhecimentos {
    tipos: TipoReconhecimento[]
    nucleos: NucleoConfig[]
    regras: RegraBonificacao[]
    reconhecimentos: Reconhecimento[]
    bonificacoes: Bonificacao[]
    entregas: Entrega[]
}

export interface ResultadoSincronizacao {
    geradas: number
    expiradas: number
}
