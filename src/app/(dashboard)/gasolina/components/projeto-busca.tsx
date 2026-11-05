"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Check, ChevronDown, Search, X } from "lucide-react"
import { Input } from "@/components/ui/input"

// "Prospecção" e "PROSPECCAO" casam; "conexao" acha "CONEXÃO".
function normalizar(texto: string): string {
    return texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim()
}

interface Props {
    opcoes: string[]
    valor: string
    onChange: (valor: string) => void
}

// Campo único de busca + escolha do projeto (lista do Monday). A lista abre
// logo abaixo do campo, dentro do próprio diálogo (sem popover sobreposto,
// que brigaria com o foco do Dialog). Teclado: ↑ ↓ navegam, Enter escolhe,
// Esc fecha.
export function ProjetoBusca({ opcoes, valor, onChange }: Props) {
    const [texto, setTexto] = useState(valor)
    const [aberto, setAberto] = useState(false)
    const [destaque, setDestaque] = useState(0)
    const listaRef = useRef<HTMLDivElement>(null)

    // Ao trocar o valor por fora (ex.: abrir a edição de outra viagem).
    useEffect(() => { setTexto(valor) }, [valor])

    const filtradas = useMemo(() => {
        const termo = normalizar(texto)
        // Com o projeto escolhido no campo, mostra a lista inteira ao reabrir.
        if (!termo || texto === valor) return opcoes
        const palavras = termo.split(/\s+/)
        return opcoes.filter(o => {
            const alvo = normalizar(o)
            return palavras.every(p => alvo.includes(p))
        })
    }, [opcoes, texto, valor])

    useEffect(() => { setDestaque(0) }, [texto])

    // Mantém o item destacado visível ao navegar com as setas.
    useEffect(() => {
        listaRef.current?.querySelector(`[data-indice="${destaque}"]`)?.scrollIntoView({ block: "nearest" })
    }, [destaque])

    function escolher(opcao: string) {
        onChange(opcao)
        setTexto(opcao)
        setAberto(false)
    }

    function aoTeclar(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === "ArrowDown") {
            e.preventDefault()
            setAberto(true)
            setDestaque(d => Math.min(d + 1, filtradas.length - 1))
        } else if (e.key === "ArrowUp") {
            e.preventDefault()
            setDestaque(d => Math.max(d - 1, 0))
        } else if (e.key === "Enter") {
            if (aberto && filtradas[destaque]) {
                e.preventDefault()
                escolher(filtradas[destaque])
            }
        } else if (e.key === "Escape" && aberto) {
            e.preventDefault()
            e.stopPropagation()   // fecha só a lista, não o diálogo
            setAberto(false)
            setTexto(valor)
        }
    }

    return (
        <div className="space-y-1">
            <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                    value={texto}
                    onChange={e => { setTexto(e.target.value); setAberto(true) }}
                    onFocus={e => { setAberto(true); e.target.select() }}
                    onClick={() => setAberto(true)}
                    onBlur={() => {
                        // Deixa o clique num item acontecer antes de fechar.
                        setTimeout(() => { setAberto(false); setTexto(t => (opcoes.includes(t) ? t : valor)) }, 150)
                    }}
                    onKeyDown={aoTeclar}
                    placeholder={opcoes.length ? `Digite para buscar entre ${opcoes.length} projetos` : "Nenhum projeto disponível"}
                    className="pl-9 pr-16"
                    role="combobox"
                    aria-expanded={aberto}
                    aria-autocomplete="list"
                />
                <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
                    {texto && (
                        <button type="button" title="Limpar" className="rounded p-1 text-slate-400 hover:text-slate-600"
                            onMouseDown={e => e.preventDefault()}
                            onClick={() => { setTexto(""); onChange(""); setAberto(true) }}>
                            <X className="h-4 w-4" />
                        </button>
                    )}
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                </div>
            </div>

            {aberto && (
                <div ref={listaRef} role="listbox"
                    className="max-h-56 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 p-1 shadow-sm">
                    {filtradas.length === 0 ? (
                        <p className="px-3 py-2 text-sm text-slate-500">Nenhum projeto com &quot;{texto}&quot;.</p>
                    ) : filtradas.map((opcao, i) => (
                        <button
                            key={opcao}
                            type="button"
                            role="option"
                            aria-selected={opcao === valor}
                            data-indice={i}
                            onMouseDown={e => e.preventDefault()}
                            onMouseEnter={() => setDestaque(i)}
                            onClick={() => escolher(opcao)}
                            className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm ${i === destaque ? "bg-amber-50 dark:bg-amber-500/10" : ""}`}
                        >
                            <span>{opcao}</span>
                            {opcao === valor && <Check className="h-4 w-4 shrink-0 text-amber-500" />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    )
}
