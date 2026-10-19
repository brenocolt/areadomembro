// Constantes da aba Reconhecimentos e Bonificações (valores do pacote de
// migração: dados-configuracao/*.csv). Sem dependências — usado no servidor
// (validação) e no cliente (rótulos).

export const NUCLEOS_IMPACTO = [
    'Gestão de Pessoas', 'Presidência', 'Vice-Presidência', 'Marketing', 'CIT', 'CIEP', 'CS',
] as const

export const STATUS_BONIFICACAO = ['disponivel', 'entregue', 'expirada', 'cancelada'] as const
export type StatusBonificacao = typeof STATUS_BONIFICACAO[number]

export const STATUS_LABEL: Record<string, string> = {
    disponivel: 'Disponível',
    entregue: 'Entregue',
    expirada: 'Expirada',
    cancelada: 'Cancelada',
}

export const STATUS_CLASS: Record<string, string> = {
    disponivel: 'bg-primary/10 text-primary',
    entregue: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    expirada: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    cancelada: 'bg-destructive/10 text-destructive',
}

export const CRITERIOS = [
    { value: 'por_reconhecimento', label: 'A cada reconhecimento' },
    { value: 'acumulado', label: 'Acumulado (marcos)' },
    { value: 'simbolico', label: 'Simbólico (sem bonificação)' },
] as const

export const PREMIACOES = [
    { value: 'financeira', label: 'Financeira' },
    { value: 'premio', label: 'Prêmio / voucher' },
    { value: 'simbolica', label: 'Simbólica' },
] as const

export const JUSTIFICATIVAS_CANCELAMENTO = [
    'Prazo ultrapassado', 'Lançamento incorreto', 'Critério não atendido', 'Duplicidade', 'Outro',
] as const

// Marca literal das RGs adiantadas anteriores ao sistema (única forma de o
// ajuste identificá-las — comportamento do original, limitação L-9).
export const OBS_RG_ANTERIOR = 'RG adiantada registrada antes do uso do sistema'

// Bonificações com estes status ainda aceitam entrega/cancelamento.
export const STATUS_ABERTOS: readonly string[] = ['disponivel', 'expirada']
