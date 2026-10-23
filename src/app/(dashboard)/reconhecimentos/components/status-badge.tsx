import { cn } from "@/lib/utils"
import { SITUACAO_CLASS, SITUACAO_LABEL, STATUS_CLASS, STATUS_LABEL } from "@/lib/reconhecimentos/constantes"

const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"

export const StatusBadge = ({ status }: { status: string }) => (
    <span className={cn(base, STATUS_CLASS[status])}>{STATUS_LABEL[status] ?? status}</span>
)

export const SituacaoBadge = ({ situacao }: { situacao: string }) => (
    <span className={cn(base, SITUACAO_CLASS[situacao])}>{SITUACAO_LABEL[situacao] ?? situacao}</span>
)
