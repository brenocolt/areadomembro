"use client"

import { useEffect, useRef, useState } from "react"
import { MapPin } from "lucide-react"
import { Input } from "@/components/ui/input"
import { gasolinaApi } from "./api"

interface Sugestao { texto: string, principal: string, secundario: string }

interface Props {
    id?: string
    value: string
    onChange: (valor: string) => void
    placeholder?: string
    sugerir: boolean   // Google Maps ligado? Sem ele, é um campo de texto comum.
}

// Campo de endereço com sugestões do Google (Places). Espera a pessoa parar de
// digitar (400 ms) e só busca com 3+ letras, para gastar poucas consultas.
export function EnderecoInput({ id, value, onChange, placeholder, sugerir }: Props) {
    const [sugestoes, setSugestoes] = useState<Sugestao[]>([])
    const [aberto, setAberto] = useState(false)
    const [destaque, setDestaque] = useState(-1)
    const digitado = useRef(false)   // só busca depois que a pessoa digita (não ao abrir uma edição)

    useEffect(() => {
        if (!sugerir || !digitado.current || value.trim().length < 3) return
        let cancelado = false
        const t = setTimeout(() => {
            gasolinaApi<{ sugestoes: Sugestao[] }>(`/api/gasolina/mapas/enderecos?q=${encodeURIComponent(value.trim())}`)
                .then(r => { if (!cancelado) { setSugestoes(r.sugestoes); setDestaque(-1) } })
                .catch(() => { if (!cancelado) setSugestoes([]) })
        }, 400)
        return () => { cancelado = true; clearTimeout(t) }
    }, [value, sugerir])

    function escolher(s: Sugestao) {
        digitado.current = false
        onChange(s.texto)
        setSugestoes([])
        setAberto(false)
    }

    const mostrar = aberto && sugerir && value.trim().length >= 3 && sugestoes.length > 0

    return (
        <div className="relative">
            <Input
                id={id}
                value={value}
                placeholder={placeholder}
                autoComplete="off"
                onChange={e => {
                    digitado.current = true
                    setAberto(true)
                    if (e.target.value.trim().length < 3) setSugestoes([])
                    onChange(e.target.value)
                }}
                onFocus={() => setAberto(true)}
                onBlur={() => setTimeout(() => setAberto(false), 150)}
                onKeyDown={e => {
                    if (!mostrar) return
                    if (e.key === "ArrowDown") { e.preventDefault(); setDestaque(d => Math.min(d + 1, sugestoes.length - 1)) }
                    else if (e.key === "ArrowUp") { e.preventDefault(); setDestaque(d => Math.max(d - 1, 0)) }
                    else if (e.key === "Enter" && destaque >= 0) { e.preventDefault(); escolher(sugestoes[destaque]) }
                    else if (e.key === "Escape") setAberto(false)
                }}
            />
            {mostrar && (
                <ul className="absolute z-50 mt-1 w-full rounded-md border bg-white dark:bg-slate-900 shadow-lg overflow-hidden">
                    {sugestoes.map((s, i) => (
                        <li key={s.texto}>
                            <button
                                type="button"
                                className={`w-full text-left px-3 py-2 text-sm flex gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 ${i === destaque ? "bg-slate-100 dark:bg-slate-800" : ""}`}
                                onMouseDown={e => { e.preventDefault(); escolher(s) }}
                            >
                                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
                                <span className="min-w-0">
                                    <span className="block truncate font-medium">{s.principal}</span>
                                    {s.secundario && <span className="block truncate text-xs text-slate-500">{s.secundario}</span>}
                                </span>
                            </button>
                        </li>
                    ))}
                    <li className="px-3 py-1 text-[10px] text-right text-slate-400">Sugestões do Google</li>
                </ul>
            )}
        </div>
    )
}
