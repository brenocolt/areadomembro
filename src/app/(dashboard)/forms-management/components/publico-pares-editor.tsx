"use client"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Plus, Trash2, AlertTriangle } from "lucide-react"
import { toast } from "sonner"
import { CARGOS } from "@/lib/cargos"
import { NUCLEOS } from "@/lib/nucleos"
import { contarNoPublico, type PublicoPar } from "@/lib/forms-publico"

interface Colaborador {
    id: string
    nome: string
    cargo_atual?: string | null
    nucleo_atual?: string | null
}

interface PublicoParesEditorProps {
    pares: PublicoPar[]
    onChange: (pares: PublicoPar[]) => void
    defaultLabel: string
    addLabel: string
    colaboradores: Colaborador[]
}

// Editor de uma lista de pares (Cargo, Núcleo) — usado nas duas seções da
// aba "Público" do formulário (Quem Responde / Quem Recebe). Lista vazia =
// a opção padrão ("Todos" ou "Ninguém", conforme `defaultLabel`); remover
// todos os pares volta para esse estado — não existe um botão separado
// "voltar para Todos/Ninguém".
//
// Cada grupo mostra quantas pessoas ele alcança de fato. Um grupo que casa
// com 0 pessoas é o motivo mais comum de um formulário direcionado não gerar
// nenhuma aba de preenchimento, então isso precisa ficar visível na hora da
// configuração, não só depois que alguém abre o formulário.
// Chave de comparação de um par — dois pares são o "mesmo grupo" quando
// cargo E núcleo coincidem. Repetir um grupo na mesma lista não faz sentido
// (é o mesmo recorte de pessoas duas vezes), então isso é bloqueado ao
// adicionar/editar.
const parKey = (p: PublicoPar) => `${p.cargo}|${p.nucleo}`

export function PublicoParesEditor({ pares, onChange, defaultLabel, addLabel, colaboradores }: PublicoParesEditorProps) {
    const addPar = () => {
        // Começa a partir da 1ª combinação (cargo, núcleo) que ainda não está
        // nesta lista, para não já nascer como um duplicado óbvio. Se todas as
        // combinações já estiverem em uso (caso extremo), cai no padrão de
        // sempre — quem for editar vai trocar o valor de qualquer forma.
        const usados = new Set(pares.map(parKey))
        for (const cargo of CARGOS) {
            for (const nucleo of NUCLEOS) {
                if (!usados.has(`${cargo}|${nucleo}`)) {
                    onChange([...pares, { cargo, nucleo }])
                    return
                }
            }
        }
        onChange([...pares, { cargo: CARGOS[0], nucleo: NUCLEOS[0] }])
    }
    const updatePar = (i: number, field: 'cargo' | 'nucleo', value: string) => {
        const proposto = { ...pares[i], [field]: value }
        const key = parKey(proposto)
        // Mesmo grupo (cargo + núcleo) já usado em outra linha desta mesma
        // lista: duas linhas idênticas não alcançam ninguém a mais e só
        // confundem quem está configurando o público.
        if (pares.some((p, idx) => idx !== i && parKey(p) === key)) {
            toast.warning('Esse grupo (cargo + núcleo) já foi adicionado a esta lista.')
            return
        }
        onChange(pares.map((p, idx) => idx === i ? proposto : p))
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

    const alcancadosTotal = contarNoPublico(colaboradores, pares)

    return (
        <div className="space-y-2 min-w-0">
            {pares.map((p, i) => {
                const alcancados = contarNoPublico(colaboradores, [p])
                return (
                    <div key={i} className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2 min-w-0">
                            <Select value={p.cargo} onValueChange={(v) => updatePar(i, 'cargo', v)}>
                                <SelectTrigger className="h-9 text-xs bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg flex-1 min-w-0">
                                    <SelectValue placeholder="Cargo" />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-xl">
                                    {CARGOS.map(c => (
                                        <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={p.nucleo} onValueChange={(v) => updatePar(i, 'nucleo', v)}>
                                <SelectTrigger className="h-9 text-xs bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg flex-1 min-w-0">
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
                        {alcancados.length === 0 ? (
                            <p className="text-[11px] text-amber-600 dark:text-amber-400 flex items-start gap-1 pl-1 min-w-0">
                                <AlertTriangle className="w-3 h-3 shrink-0 mt-0.5" />
                                <span className="min-w-0">Nenhum colaborador com esse cargo e núcleo — confira o cadastro em Gestão de Usuários.</span>
                            </p>
                        ) : (
                            // A lista de nomes quebra linha (line-clamp) em vez de
                            // ficar em linha única (truncate). `truncate` aplica
                            // white-space: nowrap, e a largura mínima do texto
                            // corrido subia por toda a árvore até estourar o
                            // max-width do diálogo, empurrando a aba "Público"
                            // inteira para fora do enquadramento.
                            <p className="text-[11px] text-slate-400 pl-1 min-w-0 break-words line-clamp-2" title={alcancados.map(c => c.nome).join(', ')}>
                                {alcancados.length} pessoa{alcancados.length !== 1 ? 's' : ''}: {alcancados.map(c => c.nome).join(', ')}
                            </p>
                        )}
                    </div>
                )
            })}
            <div className="flex items-center justify-between gap-2 pt-1">
                <Button type="button" variant="outline" size="sm" onClick={addPar} className="h-8 rounded-lg text-xs font-bold border-dashed border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-900/20">
                    <Plus className="w-3.5 h-3.5 mr-1" /> Adicionar outro grupo
                </Button>
                <span className="text-[11px] font-bold text-slate-500 dark:text-slate-400">
                    Total: {alcancadosTotal.length} pessoa{alcancadosTotal.length !== 1 ? 's' : ''}
                </span>
            </div>
        </div>
    )
}
