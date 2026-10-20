"use client"

import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Button } from "@/components/ui/button"
import { NUCLEOS, STATUS_BONIFICACAO, STATUS_LABEL } from "@/lib/reconhecimentos/constantes"
import { dataISODoInstante, normalizar } from "@/lib/reconhecimentos/datas"
import { sujeitoDe, textoPremiacao } from "@/lib/reconhecimentos/apresentacao"
import type { Bonificacao, Reconhecimento, TipoReconhecimento } from "@/lib/reconhecimentos/tipos"

export interface Filtros {
    busca: string
    de: string
    ate: string
    pessoaProjeto: string
    nucleo: string
    tipoId: string
    status: string
}

export const FILTROS_VAZIOS: Filtros = { busca: "", de: "", ate: "", pessoaProjeto: "", nucleo: "", tipoId: "", status: "" }
export const TODOS = "__todos__"

export const filtrosAtivos = (f: Filtros) => Object.values(f).some(v => v !== "")

type NucleoPorColaborador = Map<string, string | null>

function passaFiltrosComuns(f: Filtros, x: { projeto_nome: string | null; colaborador_id: string | null; colaborador_nome: string | null; nucleo: string | null; tipo_id?: string }, data: string, nucleos: NucleoPorColaborador) {
    if (f.de && data < f.de) return false
    if (f.ate && data > f.ate) return false
    if (f.pessoaProjeto && sujeitoDe(x) !== f.pessoaProjeto) return false
    if (f.nucleo) {
        const nucleo = x.nucleo ?? (x.colaborador_id ? nucleos.get(x.colaborador_id) ?? null : null)
        if (nucleo !== f.nucleo) return false
    }
    if (f.tipoId && x.tipo_id !== f.tipoId) return false
    return true
}

export function filtrarBonificacoes(lista: Bonificacao[], f: Filtros, tipos: TipoReconhecimento[], nucleos: NucleoPorColaborador, { ignorarStatus = false } = {}) {
    const nomeDoTipo = f.tipoId ? tipos.find(t => t.id === f.tipoId)?.nome : undefined
    const busca = normalizar(f.busca.trim())
    return lista.filter(b => {
        if (!passaFiltrosComuns({ ...f, tipoId: "" }, b, dataISODoInstante(b.liberada_em), nucleos)) return false
        if (nomeDoTipo && b.tipo_nome !== nomeDoTipo) return false
        if (!ignorarStatus && f.status && b.status !== f.status) return false
        if (busca && !normalizar(`${sujeitoDe(b)} ${b.tipo_nome} ${b.motivo} ${b.regra_nome} ${textoPremiacao(b)}`).includes(busca)) return false
        return true
    })
}

export function filtrarReconhecimentos(lista: Reconhecimento[], f: Filtros, tipos: TipoReconhecimento[], nucleos: NucleoPorColaborador) {
    const busca = normalizar(f.busca.trim())
    return lista.filter(r => {
        if (!passaFiltrosComuns(f, r, r.data_reconhecimento, nucleos)) return false
        if (busca) {
            const tipo = tipos.find(t => t.id === r.tipo_id)?.nome ?? ""
            if (!normalizar(`${sujeitoDe(r)} ${tipo} ${r.observacoes ?? ""} ${r.numero_rg ?? ""}`).includes(busca)) return false
        }
        return true
    })
}

interface Props {
    filtros: Filtros
    onChange: (f: Filtros) => void
    tipos: TipoReconhecimento[]
    nomesPessoasProjetos: string[]
    mostrarStatus?: boolean
}

export function BarraDeFiltros({ filtros, onChange, tipos, nomesPessoasProjetos, mostrarStatus = true }: Props) {
    const set = (parcial: Partial<Filtros>) => onChange({ ...filtros, ...parcial })
    const comTodos = (opcoes: { value: string; label: string }[], rotulo: string) => [{ value: TODOS, label: rotulo }, ...opcoes]
    return (
        <div className="rounded-lg border bg-card p-4" role="search" aria-label="Filtros">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
                <div className="space-y-1.5 sm:col-span-2 xl:col-span-2">
                    <Label htmlFor="rec-busca">Pesquisar</Label>
                    <div className="relative">
                        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input id="rec-busca" className="pl-9" placeholder="Nome, tipo, motivo..." value={filtros.busca} onChange={e => set({ busca: e.target.value })} />
                    </div>
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="rec-de">Período de</Label>
                    <Input id="rec-de" type="date" value={filtros.de} onChange={e => set({ de: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="rec-ate">até</Label>
                    <Input id="rec-ate" type="date" value={filtros.ate} onChange={e => set({ ate: e.target.value })} />
                </div>
                <div className="space-y-1.5">
                    <Label>Projeto / Pessoa</Label>
                    <SearchableSelect
                        value={filtros.pessoaProjeto || TODOS} onValueChange={v => set({ pessoaProjeto: v === TODOS ? "" : v })}
                        options={comTodos(nomesPessoasProjetos.map(n => ({ value: n, label: n })), "Todos")} placeholder="Todos"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label>Núcleo</Label>
                    <SearchableSelect
                        value={filtros.nucleo || TODOS} onValueChange={v => set({ nucleo: v === TODOS ? "" : v })}
                        options={comTodos(NUCLEOS.map(n => ({ value: n, label: n })), "Todos")} placeholder="Todos"
                    />
                </div>
                <div className="space-y-1.5">
                    <Label>Tipo</Label>
                    <SearchableSelect
                        value={filtros.tipoId || TODOS} onValueChange={v => set({ tipoId: v === TODOS ? "" : v })}
                        options={comTodos(tipos.map(t => ({ value: t.id, label: t.nome })), "Todos")} placeholder="Todos"
                    />
                </div>
                {mostrarStatus && (
                    <div className="space-y-1.5">
                        <Label>Status</Label>
                        <SearchableSelect
                            value={filtros.status || TODOS} onValueChange={v => set({ status: v === TODOS ? "" : v })}
                            options={comTodos(STATUS_BONIFICACAO.map(s => ({ value: s, label: STATUS_LABEL[s] })), "Todos")} placeholder="Todos"
                        />
                    </div>
                )}
            </div>
            {filtrosAtivos(filtros) && (
                <div className="mt-3 flex justify-end">
                    <Button variant="ghost" size="sm" onClick={() => onChange(FILTROS_VAZIOS)}>Limpar filtros</Button>
                </div>
            )}
        </div>
    )
}
