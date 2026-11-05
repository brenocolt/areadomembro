"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2, Pencil, Save, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatarNumero, type GasolinaVeiculo } from "@/lib/gasolina"
import { gasolinaApi } from "./api"

type VeiculoGestao = GasolinaVeiculo & {
    colaborador?: { nome: string } | null
    alterado_por?: { nome: string } | null
}

// VP confere a foto do painel e corrige a autonomia quando necessário.
export function GestaoCarros() {
    const [veiculos, setVeiculos] = useState<VeiculoGestao[]>([])
    const [carregando, setCarregando] = useState(true)
    const [busca, setBusca] = useState("")
    const [editando, setEditando] = useState<string | null>(null)
    const [valor, setValor] = useState("")
    const [salvando, setSalvando] = useState(false)

    const carregar = useCallback(async () => {
        try {
            const r = await gasolinaApi<{ veiculos: VeiculoGestao[] }>("/api/gasolina/veiculos?todos=1")
            setVeiculos(r.veiculos)
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setCarregando(false)
        }
    }, [])

    useEffect(() => { carregar() }, [carregar])

    const filtrados = useMemo(() => {
        const termo = busca.trim().toLowerCase()
        const lista = [...veiculos].sort((a, b) => (a.colaborador?.nome ?? "").localeCompare(b.colaborador?.nome ?? ""))
        if (!termo) return lista
        return lista.filter(v => `${v.colaborador?.nome ?? ""} ${v.modelo}`.toLowerCase().includes(termo))
    }, [veiculos, busca])

    async function salvar(id: string) {
        setSalvando(true)
        try {
            const r = await gasolinaApi<{ recalculadas: number }>(`/api/gasolina/veiculos/${id}`, { method: "PATCH", body: JSON.stringify({ autonomia_km_l: valor }) })
            toast.success(`Autonomia alterada.${r.recalculadas ? ` ${r.recalculadas} viagem(ns) pendente(s) recalculada(s).` : ""}`)
            setEditando(null)
            carregar()
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setSalvando(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Carros dos membros</CardTitle>
                <CardDescription>
                    Confira a foto do painel e corrija a autonomia se ela não bater. A correção vale para as viagens ainda pendentes.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <Input placeholder="Buscar por membro ou modelo" value={busca} onChange={e => setBusca(e.target.value)} className="sm:max-w-xs" />
                {carregando ? (
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                ) : filtrados.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum carro encontrado.</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Membro</TableHead>
                                <TableHead>Carro</TableHead>
                                <TableHead>Foto</TableHead>
                                <TableHead>Autonomia</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filtrados.map(v => (
                                <TableRow key={v.id}>
                                    <TableCell className="font-medium">{v.colaborador?.nome ?? "—"}</TableCell>
                                    <TableCell>
                                        {v.modelo}
                                        <span className="block text-xs text-slate-500">{[v.ano, v.combustivel].filter(Boolean).join(" · ")}</span>
                                    </TableCell>
                                    <TableCell>
                                        <a href={v.foto_painel_url} target="_blank" rel="noreferrer">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={v.foto_painel_url} alt="Painel" className="h-12 w-16 rounded object-cover bg-slate-100" />
                                        </a>
                                    </TableCell>
                                    <TableCell>
                                        {editando === v.id ? (
                                            <div className="flex items-center gap-1">
                                                <Input value={valor} onChange={e => setValor(e.target.value)} inputMode="decimal" className="w-20 h-8"
                                                    onKeyDown={e => { if (e.key === "Enter") salvar(v.id) }} autoFocus />
                                                <Button size="icon" className="h-8 w-8" onClick={() => salvar(v.id)} disabled={salvando} title="Salvar">
                                                    {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                                </Button>
                                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditando(null)} title="Cancelar">
                                                    <X className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-1">
                                                <span className="font-semibold">{formatarNumero(v.autonomia_km_l, 1)} km/L</span>
                                                <Button size="icon" variant="ghost" className="h-8 w-8" title="Alterar autonomia"
                                                    onClick={() => { setEditando(v.id); setValor(String(v.autonomia_km_l).replace(".", ",")) }}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        )}
                                        {v.autonomia_alterada_em && (
                                            <span className="block text-xs text-amber-600">
                                                Informada: {formatarNumero(v.autonomia_informada, 1)} · ajustada por {v.alterado_por?.nome ?? "VP"}
                                            </span>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )
}
