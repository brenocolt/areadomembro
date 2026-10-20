// Constantes da aba Reconhecimentos e Bonificações. Sem dependências além da lista de núcleos do portal.
import { NUCLEOS } from '../nucleos'

export { NUCLEOS }

export const ESCOPOS = ['projeto', 'colaborador', 'nucleo'] as const
export type Escopo = typeof ESCOPOS[number]
export const ESCOPO_LABEL: Record<Escopo, string> = { projeto: 'Projeto', colaborador: 'Colaborador', nucleo: 'Núcleo' }

export const STATUS_BONIFICACAO = ['disponivel', 'entregue', 'expirada', 'cancelada'] as const
export type StatusBonificacao = typeof STATUS_BONIFICACAO[number]
export const STATUS_LABEL: Record<string, string> = {
    disponivel: 'Disponível', entregue: 'Entregue', expirada: 'Expirada', cancelada: 'Cancelada',
}
export const STATUS_CLASS: Record<string, string> = {
    disponivel: 'bg-primary/10 text-primary',
    entregue: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    expirada: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    cancelada: 'bg-destructive/10 text-destructive',
}

export const SITUACOES_ENTREGA = ['solicitada', 'aprovada', 'entregue'] as const
export type SituacaoEntrega = typeof SITUACOES_ENTREGA[number]
export const SITUACAO_LABEL: Record<string, string> = { solicitada: 'Solicitada', aprovada: 'Aprovada', entregue: 'Entregue' }
export const SITUACAO_CLASS: Record<string, string> = {
    solicitada: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    aprovada: 'bg-primary/10 text-primary',
    entregue: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
}

export const GATILHOS = [
    { value: 'cada_reconhecimento', label: 'A cada reconhecimento' },
    { value: 'marcos_de_rg', label: 'Marcos de RG (pelo número da RG)' },
] as const
export type Gatilho = typeof GATILHOS[number]['value']

export const PREMIACOES = [
    { value: 'financeira', label: 'Financeira' },
    { value: 'item', label: 'Prêmio / item' },
    { value: 'simbolica', label: 'Simbólica' },
] as const

// Bonificações que ainda aceitam entregas.
export const STATUS_ACEITA_ENTREGAS: readonly string[] = ['disponivel', 'entregue']
