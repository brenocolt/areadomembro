"use client"

import * as React from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type OpcaoMulti = { value: string; label: string; hint?: string }

interface Props {
    value: string[]
    onChange: (value: string[]) => void
    options: OpcaoMulti[]
    placeholder?: string
    searchPlaceholder?: string
    emptyText?: string
    className?: string
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

// Lista suspensa com busca (sem acento/caixa) e seleção de VÁRIOS itens; os escolhidos aparecem como etiquetas.
export function MultiSelectBusca({ value, onChange, options, placeholder = "Selecionar", searchPlaceholder = "Buscar...", emptyText = "Nenhum resultado", className }: Props) {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")

    const ordenadas = React.useMemo(() => [...options].sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" })), [options])
    const filtradas = React.useMemo(() => {
        const q = norm(query.trim())
        return q ? ordenadas.filter(o => norm(`${o.label} ${o.hint ?? ""}`).includes(q)) : ordenadas
    }, [ordenadas, query])
    const alternar = (v: string) => onChange(value.includes(v) ? value.filter(x => x !== v) : [...value, v])
    const selecionadas = options.filter(o => value.includes(o.value))

    return (
        <div className={cn("space-y-2", className)}>
            <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery("") }}>
                <PopoverTrigger asChild>
                    <button
                        type="button"
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    >
                        <span className={cn("truncate text-left", value.length === 0 && "text-muted-foreground")}>
                            {value.length === 0 ? placeholder : `${value.length} selecionado(s)`}
                        </span>
                        <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </button>
                </PopoverTrigger>
                <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0" align="start">
                    <div className="flex items-center border-b px-2">
                        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <input
                            autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder={searchPlaceholder}
                            className="flex h-9 w-full bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
                        />
                    </div>
                    <div className="max-h-64 overflow-auto p-1">
                        {filtradas.length === 0 ? (
                            <div className="py-4 text-center text-sm text-muted-foreground">{emptyText}</div>
                        ) : filtradas.map(o => {
                            const marcado = value.includes(o.value)
                            return (
                                <button
                                    key={o.value} type="button" role="option" aria-selected={marcado} onClick={() => alternar(o.value)}
                                    className={cn("flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground", marcado && "bg-accent/50")}
                                >
                                    <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border", marcado ? "border-primary bg-primary text-primary-foreground" : "border-input")}>
                                        {marcado && <Check className="h-3 w-3" />}
                                    </span>
                                    <span className="truncate">{o.label}</span>
                                    {o.hint && <span className="ml-auto truncate text-xs text-muted-foreground">{o.hint}</span>}
                                </button>
                            )
                        })}
                    </div>
                </PopoverContent>
            </Popover>
            {selecionadas.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {selecionadas.map(o => (
                        <Badge key={o.value} variant="secondary" className="gap-1 pr-1">
                            {o.label}
                            <button type="button" aria-label={`Remover ${o.label}`} onClick={() => alternar(o.value)} className="rounded-full p-0.5 hover:bg-muted">
                                <X className="h-3 w-3" />
                            </button>
                        </Badge>
                    ))}
                </div>
            )}
        </div>
    )
}
