"use client"

import { AlertTriangle, Building2, CalendarDays, Clock3 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/reconhecimentos/constantes"
import { formatarData, formatarMoeda, hojeISO, normalizar } from "@/lib/reconhecimentos/datas"
import { diasRestantes } from "@/lib/reconhecimentos/engine"
import type { Bonificacao } from "@/lib/reconhecimentos/tipos"

const COLUNAS = [
    { key: "disponivel", label: "Disponíveis" },
    { key: "entregue", label: "Entregues" },
    { key: "expirada", label: "Expiradas" },
    { key: "cancelada", label: "Canceladas" },
]

interface Props {
    bonificacoes: Bonificacao[]
    onSelect: (b: Bonificacao) => void
}

// Sem arrastar-e-soltar: o status só muda pelo painel de detalhe (como no original).
export function KanbanBonificacoes({ bonificacoes, onSelect }: Props) {
    const hoje = hojeISO()
    return (
        <div className="overflow-x-auto pb-2">
            <div className="grid min-w-[1040px] grid-cols-4 gap-4">
                {COLUNAS.map((col) => {
                    const itens = bonificacoes.filter((b) => b.status === col.key)
                    return (
                        <div key={col.key} className="flex h-[min(68vh,720px)] min-h-[520px] flex-col rounded-lg border border-border/60 bg-muted/30 p-3">
                            <div className="mb-3 flex items-center justify-between">
                                <h3 className="text-sm font-semibold">{col.label}</h3>
                                <Badge variant="secondary">{itens.length}</Badge>
                            </div>
                            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                                {itens.length === 0 && (
                                    <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma bonificação</p>
                                )}
                                {itens.map((b) => {
                                    const dias = diasRestantes(b.prazo_limite, hoje)
                                    const proximo = b.status === "disponivel" && dias !== null && dias <= 7
                                    return (
                                        <div
                                            key={b.id}
                                            onClick={() => onSelect(b)}
                                            className="cursor-pointer rounded-lg border border-border/60 bg-card p-3 shadow-sm transition-all hover:shadow-md"
                                        >
                                            <p className="truncate text-sm font-semibold">{b.projeto_nome || b.pessoa_nome}</p>
                                            <p className="mt-1 text-xs font-medium text-muted-foreground">
                                                {b.projeto_id && b.marco ? `${b.marco}º reconhecimento${normalizar(b.motivo).includes("adiantad") ? " adiantado" : ""}` : b.tipo_nome}
                                            </p>
                                            <p className="mt-1 text-sm font-medium text-primary">
                                                {b.descricao_premiacao || formatarMoeda(Number(b.valor))}
                                            </p>
                                            <div className="mt-2 space-y-1 text-xs text-muted-foreground">
                                                <span className="flex items-center gap-1">
                                                    <CalendarDays className="h-3 w-3" /> Liberada: {formatarData(b.liberada_em)}
                                                </span>
                                                {b.nucleo_impacto && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {b.nucleo_impacto}</span>}
                                                {b.prazo_limite && <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> Prazo: {formatarData(b.prazo_limite)}</span>}
                                            </div>
                                            {proximo && (
                                                <p className="mt-1 flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                                    <AlertTriangle className="h-3 w-3" />
                                                    {dias !== null && dias < 0 ? "Prazo vencido" : dias === 0 ? "Vence hoje" : `Vence em ${dias} dia(s)`}
                                                </p>
                                            )}
                                            <div className="mt-2 flex items-center gap-2">
                                                <Badge variant="secondary" className={STATUS_CLASS[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
