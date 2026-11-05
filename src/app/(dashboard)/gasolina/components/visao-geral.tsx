"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { STATUS_VIAGEM, formatarData, formatarNumero, formatarReais, type GasolinaViagem } from "@/lib/gasolina"
import { gasolinaApi } from "./api"
import { StatusViagemBadge } from "./status-viagem"

type ViagemGestao = GasolinaViagem & {
    colaborador?: { nome: string } | null
    veiculo?: { modelo: string } | null
}

// VP: todas as viagens de todos os membros, com filtros.
export function VisaoGeral() {
    const [viagens, setViagens] = useState<ViagemGestao[]>([])
    const [carregando, setCarregando] = useState(true)
    const [status, setStatus] = useState("todos")
    const [mes, setMes] = useState("")
    const [busca, setBusca] = useState("")

    const carregar = useCallback(async () => {
        setCarregando(true)
        try {
            const qs = new URLSearchParams({ todos: "1" })
            if (status !== "todos") qs.set("status", status)
            if (mes) qs.set("mes", mes)
            const r = await gasolinaApi<{ viagens: ViagemGestao[] }>(`/api/gasolina/viagens?${qs}`)
            setViagens(r.viagens)
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setCarregando(false)
        }
    }, [status, mes])

    useEffect(() => { carregar() }, [carregar])

    const filtradas = useMemo(() => {
        const termo = busca.trim().toLowerCase()
        if (!termo) return viagens
        return viagens.filter(v => `${v.colaborador?.nome ?? ""} ${v.projeto}`.toLowerCase().includes(termo))
    }, [viagens, busca])

    const total = filtradas.reduce((s, v) => s + Number(v.valor ?? 0), 0)
    const litros = filtradas.reduce((s, v) => s + Number(v.litros ?? 0), 0)

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Visão geral das viagens</CardTitle>
                <CardDescription>Todas as viagens lançadas pelos membros.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2">
                    <Input placeholder="Buscar por membro ou projeto" value={busca} onChange={e => setBusca(e.target.value)} className="sm:max-w-xs" />
                    <Select value={status} onValueChange={setStatus}>
                        <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todos">Todos os status</SelectItem>
                            {STATUS_VIAGEM.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    <Input type="month" value={mes} onChange={e => setMes(e.target.value)} className="sm:w-44" title="Mês da viagem" />
                </div>

                {carregando ? (
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                ) : filtradas.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhuma viagem encontrada.</p>
                ) : (
                    <>
                        <p className="text-sm text-slate-500">
                            {filtradas.length} viagem(ns) · {formatarNumero(litros, 2)} L · <span className="font-semibold text-slate-900 dark:text-white">{formatarReais(total)}</span>
                        </p>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Membro</TableHead>
                                    <TableHead>Projeto</TableHead>
                                    <TableHead className="hidden md:table-cell">Trajeto</TableHead>
                                    <TableHead className="hidden sm:table-cell">Km / L</TableHead>
                                    <TableHead>Valor</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filtradas.map(v => (
                                    <TableRow key={v.id}>
                                        <TableCell className="whitespace-nowrap">{formatarData(v.data_viagem)}</TableCell>
                                        <TableCell className="font-medium">{v.colaborador?.nome ?? "—"}</TableCell>
                                        <TableCell>
                                            {v.projeto}
                                            <span className="block text-xs text-slate-500">{v.veiculo?.modelo ?? ""}{v.origem === "planilha" ? " · importada da planilha" : ""}</span>
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell text-sm">{v.origem_local} → {v.destino_local}</TableCell>
                                        <TableCell className="hidden sm:table-cell text-sm whitespace-nowrap">
                                            {formatarNumero(v.distancia_km, 1)} km
                                            <span className="block text-xs text-slate-500">{v.litros != null ? `${formatarNumero(v.litros, 2)} L` : "—"}</span>
                                        </TableCell>
                                        <TableCell className="whitespace-nowrap">{v.valor != null ? formatarReais(v.valor) : <span className="text-xs text-slate-500">sem preço</span>}</TableCell>
                                        <TableCell><StatusViagemBadge status={v.status} /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </>
                )}
            </CardContent>
        </Card>
    )
}
