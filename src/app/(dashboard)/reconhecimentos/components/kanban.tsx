"use client"

import { CalendarClock, Users } from "lucide-react"
import { cn } from "@/lib/utils"
import { STATUS_BONIFICACAO, STATUS_LABEL, type StatusBonificacao } from "@/lib/reconhecimentos/constantes"
import { diasRestantes, resumirEntregas } from "@/lib/reconhecimentos/motor"
import { formatarData, hojeISO } from "@/lib/reconhecimentos/datas"
import { sujeitoDe, textoPremiacao } from "@/lib/reconhecimentos/apresentacao"
import type { Bonificacao, Entrega } from "@/lib/reconhecimentos/tipos"
import { StatusBadge } from "./status-badge"

const COLUNA: Record<StatusBonificacao, string> = {
    disponivel: "border-t-primary", entregue: "border-t-emerald-500", expirada: "border-t-amber-500", cancelada: "border-t-destructive",
}
const PLURAL: Record<StatusBonificacao, string> = { disponivel: "Disponíveis", entregue: "Entregues", expirada: "Expiradas", cancelada: "Canceladas" }

interface Props { bonificacoes: Bonificacao[]; entregas: Entrega[]; onAbrir: (id: string) => void }

export function Kanban({ bonificacoes, entregas, onAbrir }: Props) {
    const hoje = hojeISO()
    return (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4" data-testid="kanban">
            {STATUS_BONIFICACAO.map(status => {
                const cartoes = bonificacoes.filter(b => b.status === status)
                return (
                    <section key={status} aria-label={PLURAL[status]} data-testid={`coluna-${status}`} className={cn("flex min-h-[200px] flex-col rounded-lg border border-t-4 bg-muted/30", COLUNA[status])}>
                        <header className="flex items-center justify-between px-3 py-3">
                            <h3 className="text-sm font-semibold">{PLURAL[status]}</h3>
                            <span className="rounded-full bg-background px-2 py-0.5 text-xs font-medium text-muted-foreground">{cartoes.length}</span>
                        </header>
                        <div className="flex flex-1 flex-col gap-3 px-3 pb-3">
                            {cartoes.length === 0 && <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma bonificação {STATUS_LABEL[status].toLowerCase()}.</p>}
                            {cartoes.map(b => {
                                const r = resumirEntregas(entregas.filter(e => e.bonificacao_id === b.id))
                                const dias = status === "disponivel" ? diasRestantes(b.prazo_limite, hoje) : null
                                return (
                                    <button key={b.id} type="button" onClick={() => onAbrir(b.id)} data-testid="cartao-bonificacao"
                                        className="rounded-lg border bg-card p-3 text-left shadow-sm transition hover:border-primary/50 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                        <div className="flex items-start justify-between gap-2">
                                            <p className="font-semibold leading-snug">{sujeitoDe(b)}</p>
                                            <StatusBadge status={b.status} />
                                        </div>
                                        <p className="mt-0.5 text-xs text-muted-foreground">{b.tipo_nome}</p>
                                        <p className="mt-2 text-sm">{b.motivo}</p>
                                        <p className="mt-1 text-sm font-medium text-primary">{textoPremiacao(b)}</p>
                                        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                            <p>Liberada: {formatarData(b.liberada_em)}</p>
                                            {b.prazo_limite && status === "disponivel" && (
                                                <p className={cn("flex items-center gap-1", dias !== null && dias <= 7 && "text-amber-600 dark:text-amber-400")}>
                                                    <CalendarClock className="h-3 w-3" /> Prazo: {formatarData(b.prazo_limite)}{dias !== null && dias >= 0 ? ` (${dias} dia${dias === 1 ? "" : "s"})` : ""}
                                                </p>
                                            )}
                                            {r.total > 0 && <p className="flex items-center gap-1"><Users className="h-3 w-3" /> {r.entregues} de {r.total} entregue{r.total === 1 ? "" : "s"}</p>}
                                            {b.origem_alterada && <p className="text-amber-600 dark:text-amber-400">Reconhecimento de origem alterado</p>}
                                        </div>
                                    </button>
                                )
                            })}
                        </div>
                    </section>
                )
            })}
        </div>
    )
}
