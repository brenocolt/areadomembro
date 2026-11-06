import { Badge } from "@/components/ui/badge"
import type { StatusViagem } from "@/lib/gasolina"

const CORES: Record<StatusViagem, string> = {
    "Pendente": "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    "Em solicitação": "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
    "Reembolsado": "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    "Vencido": "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400",
}

const COR_RECUSADA = "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300"

// `recusada`: viagem de solicitação recusada ainda não retomada (ver viagemRecusada).
export function StatusViagemBadge({ status, recusada = false }: { status: StatusViagem, recusada?: boolean }) {
    return (
        <Badge variant="secondary" className={`border-none font-semibold ${recusada ? COR_RECUSADA : CORES[status] ?? ""}`}>
            {recusada ? "Recusada" : status}
        </Badge>
    )
}
