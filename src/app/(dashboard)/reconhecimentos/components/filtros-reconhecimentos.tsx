"use client"

import { Search } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { STATUS_LABEL } from "@/lib/reconhecimentos/constantes"
import type { TipoReconhecimento } from "@/lib/reconhecimentos/tipos"

export interface EstadoFiltros {
    busca: string
    de: string
    ate: string
    sujeito: string
    nucleo: string
    tipo: string
    status: string
}

export const FILTROS_INICIAIS: EstadoFiltros = {
    busca: "", de: "", ate: "", sujeito: "todos", nucleo: "todos", tipo: "todos", status: "todos",
}

interface Props {
    valor: EstadoFiltros
    onChange: (parcial: Partial<EstadoFiltros>) => void
    sujeitos: Array<[string, string]>
    nucleos: string[]
    tipos: TipoReconhecimento[]
    comStatus?: boolean
    compacto?: boolean
}

// Componente de módulo (não declarado dentro da página): o campo de pesquisa
// mantém o foco enquanto se digita.
export function FiltrosReconhecimentos({ valor, onChange, sujeitos, nucleos, tipos, comStatus = true, compacto = false }: Props) {
    const conteudo = (
        <div className={compacto ? "grid min-w-[1120px] grid-cols-[1.5fr_repeat(6,minmax(130px,1fr))] gap-2" : "grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4"}>
            <div className="space-y-1">
                <Label className="text-xs">Pesquisar</Label>
                <div className="flex items-center gap-2 rounded-md border border-input px-2">
                    <Search className="h-4 w-4 text-muted-foreground" />
                    <input
                        value={valor.busca}
                        onChange={(e) => onChange({ busca: e.target.value })}
                        placeholder="Projeto, pessoa ou reconhecimento"
                        className="h-9 w-full bg-transparent text-sm outline-none"
                    />
                </div>
            </div>
            <div className="space-y-1">
                <Label className="text-xs">Período de</Label>
                <Input type="date" value={valor.de} onChange={(e) => onChange({ de: e.target.value })} />
            </div>
            <div className="space-y-1">
                <Label className="text-xs">Período até</Label>
                <Input type="date" value={valor.ate} onChange={(e) => onChange({ ate: e.target.value })} />
            </div>
            <div className="space-y-1">
                <Label className="text-xs">Projeto/Pessoa</Label>
                <Select value={valor.sujeito} onValueChange={(v) => onChange({ sujeito: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        {sujeitos.map(([v, nome]) => <SelectItem key={v} value={v}>{nome}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <Label className="text-xs">Núcleo</Label>
                <Select value={valor.nucleo} onValueChange={(v) => onChange({ nucleo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos</SelectItem>
                        {nucleos.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1">
                <Label className="text-xs">Tipo</Label>
                <Select value={valor.tipo} onValueChange={(v) => onChange({ tipo: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="todos">Todos os tipos</SelectItem>
                        {tipos.map((t) => <SelectItem key={t.id} value={t.nome}>{t.nome}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            {comStatus && (
                <div className="space-y-1">
                    <Label className="text-xs">Status</Label>
                    <Select value={valor.status} onValueChange={(v) => onChange({ status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos os status</SelectItem>
                            {Object.entries(STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    )

    return compacto ? (
        <div className="overflow-x-auto rounded-md border border-border/60 bg-card p-3">{conteudo}</div>
    ) : (
        <Card><CardContent className="p-4">{conteudo}</CardContent></Card>
    )
}
