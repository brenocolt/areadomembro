"use client"

import * as React from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export type SearchableOption = { value: string; label: string }

interface Props {
    value?: string
    onValueChange: (value: string) => void
    options: SearchableOption[]
    placeholder?: string
    className?: string
    emptyText?: string
    searchPlaceholder?: string
}

const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()

// Select com busca (sem acento/caixa) e opções em ordem alfabética pt-BR.
export function SearchableSelect({
    value,
    onValueChange,
    options,
    placeholder = "Selecionar",
    className,
    emptyText = "Nenhum resultado",
    searchPlaceholder = "Buscar...",
}: Props) {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")

    const sorted = React.useMemo(
        () => [...options].sort((a, b) => a.label.localeCompare(b.label, "pt-BR", { sensitivity: "base" })),
        [options]
    )

    const filtered = React.useMemo(() => {
        if (!query.trim()) return sorted
        const q = norm(query)
        return sorted.filter((o) => norm(o.label).includes(q))
    }, [sorted, query])

    const selected = options.find((o) => o.value === value)

    return (
        <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) setQuery("") }}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
                        className
                    )}
                >
                    <span className={cn("truncate text-left", !selected && "text-muted-foreground")}>
                        {selected?.label ?? placeholder}
                    </span>
                    <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] min-w-[200px] p-0" align="start">
                <div className="flex items-center border-b px-2">
                    <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <input
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="flex h-9 w-full bg-transparent px-2 text-sm outline-none placeholder:text-muted-foreground"
                    />
                </div>
                <div className="max-h-64 overflow-auto p-1">
                    {filtered.length === 0 ? (
                        <div className="py-4 text-center text-sm text-muted-foreground">{emptyText}</div>
                    ) : (
                        filtered.map((o) => {
                            const isSel = o.value === value
                            return (
                                <button
                                    key={o.value}
                                    type="button"
                                    onClick={() => { onValueChange(o.value); setOpen(false); setQuery("") }}
                                    className={cn(
                                        "flex w-full items-center justify-between rounded-sm px-2 py-1.5 text-left text-sm hover:bg-accent hover:text-accent-foreground",
                                        isSel && "bg-accent/50"
                                    )}
                                >
                                    <span className="truncate">{o.label}</span>
                                    {isSel && <Check className="ml-2 h-4 w-4 shrink-0" />}
                                </button>
                            )
                        })
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
