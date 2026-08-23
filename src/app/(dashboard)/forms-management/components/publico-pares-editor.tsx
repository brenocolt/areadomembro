"use client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Plus, Trash2 } from "lucide-react"
import { CARGOS } from "@/lib/cargos"
import { NUCLEOS } from "@/lib/nucleos"
import type { PublicoPar } from "@/lib/forms-publico"

interface PublicoParesEditorProps {
    pares: PublicoPar[]
    onChange: (pares: PublicoPar[]) => void
    defaultLabel: string
    addLabel: string
}

// Editor de uma lista de pares (Cargo, Núcleo) — usado nas duas seções da
// aba "Público" do formulário (Quem Responde / Quem Recebe). Lista vazia =
// a opção padrão ("Todos" ou "Ninguém", conforme `defaultLabel`); remover
// todos os pares volta para esse estado — não existe um botão separado
// "voltar para Todos/Ninguém".
export function PublicoParesEditor({ pares, onChange, defaultLabel, addLabel }: PublicoParesEditorProps) {
    const addPar = () => onChange([...pares, { cargo: CARGOS[0], nucleo: NUCLEOS[0] }])
    const updatePar = (i: number, field: 'cargo' | 'nucleo', value: string) => {
        onChange(pares.map((p, idx) => idx === i ? { ...p, [field]: value } : p))
    }
    const removePar = (i: number) => onChange(pares.filter((_, idx) => idx !== i))

    if (pares.length === 0) {
        return (
            <div className="flex items-center justify-between gap-3 bg-slate-50 dark:bg-slate-800/50 border border-dashed border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3">
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400">{defaultLabel}</span>
                <Button type="button" variant="outline" size="sm" onClick={addPar} className="h-8 rounded-lg text-xs font-bold border-dashed shrink-0">
                    <Plus className="w-3.5 h-3.5 mr-1" /> {addLabel}
                </Button>
            </div>
        )
    }

    return (
        <div className="space-y-2">
            {pares.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                    <Select value={p.cargo} onValueChange={(v) => updatePar(i, 'cargo', v)}>
                        <SelectTrigger className="h-9 text-xs bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg flex-1">
                            <SelectValue placeholder="Cargo" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-xl">
                            {CARGOS.map(c => (
                                <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Select value={p.nucleo} onValueChange={(v) => updatePar(i, 'nucleo', v)}>
                        <SelectTrigger className="h-9 text-xs bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg flex-1">
                            <SelectValue placeholder="Núcleo" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-xl">
                            {NUCLEOS.map(n => (
                                <SelectItem key={n} value={n} className="text-xs">{n}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <button type="button" onClick={() => removePar(i)} className="text-slate-400 hover:text-rose-500 shrink-0" title="Remover">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            ))}
            <Button type="button" variant="outline" size="sm" onClick={addPar} className="h-8 rounded-lg text-xs font-bold border-dashed border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20">
                <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar outro grupo
            </Button>
        </div>
    )
}
