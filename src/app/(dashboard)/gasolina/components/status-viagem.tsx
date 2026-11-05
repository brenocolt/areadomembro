import { Badge } from "@/components/ui/badge"
import type { StatusViagem } from "@/lib/gasolina"

const CORES: Record<StatusViagem, string> = {
    "Pendente": "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
    "Em solicitação": "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300",
    "Reembolsado": "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300",
    "Vencido": "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400",
}

export function StatusViagemBadge({ status }: { status: StatusViagem }) {
    return <Badge variant="secondary" className={`border-none font-semibold ${CORES[status] ?? ""}`}>{status}</Badge>
}
