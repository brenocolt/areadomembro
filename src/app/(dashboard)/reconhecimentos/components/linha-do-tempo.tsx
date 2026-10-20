"use client"

import { Award, Gift, Settings2, UserCheck } from "lucide-react"
import { cn } from "@/lib/utils"
import { descreverEvento, type ContextoEvento, type EventoDescrito } from "@/lib/reconhecimentos/apresentacao"
import { formatarData } from "@/lib/reconhecimentos/datas"
import type { EventoHistorico } from "@/lib/reconhecimentos/tipos"

const ICONE: Record<EventoDescrito["categoria"], React.ComponentType<{ className?: string }>> = {
    reconhecimento: Award, bonificacao: Gift, entrega: UserCheck, configuracao: Settings2,
}
const COR: Record<EventoDescrito["categoria"], string> = {
    reconhecimento: "bg-primary/10 text-primary",
    bonificacao: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    entrega: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    configuracao: "bg-muted text-muted-foreground",
}

const hora = (iso: string) => new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" })

interface Props { eventos: EventoHistorico[]; contexto: ContextoEvento; vazio?: string }

// Linha do tempo (mais recente primeiro). Cada item mostra o quê, quem e quando.
export function LinhaDoTempo({ eventos, contexto, vazio = "Nenhum evento registrado." }: Props) {
    if (eventos.length === 0) return <p className="py-6 text-center text-sm text-muted-foreground">{vazio}</p>
    return (
        <ol className="space-y-3" data-testid="linha-do-tempo">
            {eventos.map(e => {
                const d = descreverEvento(e, contexto)
                const Icone = ICONE[d.categoria]
                return (
                    <li key={e.id} className="flex gap-3">
                        <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", COR[d.categoria])}><Icone className="h-3.5 w-3.5" /></span>
                        <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium leading-snug">{d.titulo}</p>
                            {d.detalhes.map((linha, i) => <p key={i} className="text-xs text-muted-foreground">{linha}</p>)}
                            <p className="mt-0.5 text-xs text-muted-foreground">{formatarData(e.created_at)} às {hora(e.created_at)} · {e.usuario_email}</p>
                        </div>
                    </li>
                )
            })}
        </ol>
    )
}
