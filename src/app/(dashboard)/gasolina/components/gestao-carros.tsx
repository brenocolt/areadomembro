"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Ban, CheckCircle2, Loader2, Pencil, RotateCcw, Save, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatarNumero, type GasolinaVeiculo } from "@/lib/gasolina"
import { gasolinaApi } from "./api"

type VeiculoGestao = GasolinaVeiculo & {
    colaborador?: { nome: string } | null
    alterado_por?: { nome: string } | null
}

// Invalidar (tentativa de fraude) / reativar o carro de um membro.
function SituacaoCarro({ v, onMudou }: { v: VeiculoGestao, onMudou: () => void }) {
    const [aberto, setAberto] = useState(false)
    const [motivo, setMotivo] = useState("")
    const [enviando, setEnviando] = useState(false)

    async function enviar(reativar: boolean) {
        setEnviando(true)
        try {
            await gasolinaApi(`/api/gasolina/veiculos/${v.id}/invalidar`, reativar
                ? { method: "DELETE" }
                : { method: "POST", body: JSON.stringify({ motivo }) })
            toast.success(reativar ? "Carro reativado." : "Carro invalidado. O membro vai ver o motivo.")
            setAberto(false)
            setMotivo("")
            onMudou()
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setEnviando(false)
        }
    }

    if (v.invalidado_em) {
        return (
            <div className="space-y-1 max-w-[220px]">
                <span className="inline-block rounded-full bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300 px-2 py-0.5 text-xs font-semibold">Invalidado</span>
                <p className="text-xs text-slate-500">{v.motivo_invalidacao}</p>
                <Button size="sm" variant="outline" className="h-7" onClick={() => enviar(true)} disabled={enviando}>
                    {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Reativar
                </Button>
            </div>
        )
    }
    async function aprovar() {
        setEnviando(true)
        try {
            await gasolinaApi(`/api/gasolina/veiculos/${v.id}/aprovar`, { method: "POST" })
            toast.success("Carro aprovado. O membro já pode lançar viagens com ele.")
            onMudou()
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setEnviando(false)
        }
    }

    if (!aberto) {
        return (
            <div className="space-y-1">
                {!v.aprovado_em && (
                    <>
                        <span className="inline-block rounded-full bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300 px-2 py-0.5 text-xs font-semibold">Aguardando aprovação</span>
                        <div>
                            <Button size="sm" className="h-7 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={aprovar} disabled={enviando}>
                                {enviando ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />} Aprovar
                            </Button>
                        </div>
                    </>
                )}
                <Button size="sm" variant="ghost" className="h-7 text-red-600 hover:text-red-700" onClick={() => setAberto(true)}>
                    <Ban className="h-3.5 w-3.5" /> Invalidar
                </Button>
            </div>
        )
    }
    return (
        <div className="space-y-2 min-w-[220px]">
            <Textarea id={`motivo-${v.id}`} value={motivo} onChange={e => setMotivo(e.target.value)} rows={2} maxLength={500}
                placeholder="Motivo (o membro vai ver). Ex.: foto do painel adulterada." />
            <div className="flex gap-1">
                <Button size="sm" className="h-7 bg-red-600 hover:bg-red-700 text-white" onClick={() => enviar(false)} disabled={enviando || motivo.trim().length < 5}>
                    {enviando && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Confirmar invalidação
                </Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => { setAberto(false); setMotivo("") }}>Cancelar</Button>
            </div>
            <p className="text-xs text-slate-500">O carro deixa de valer para novas viagens, e as pendentes feitas com ele ficam fora das solicitações.</p>
        </div>
    )
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
        // Os que aguardam aprovação aparecem primeiro.
        const pendente = (v: VeiculoGestao) => (!v.aprovado_em && !v.invalidado_em ? 0 : 1)
        const lista = [...veiculos].sort((a, b) => pendente(a) - pendente(b) || (a.colaborador?.nome ?? "").localeCompare(b.colaborador?.nome ?? ""))
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
                    Carro novo só pode ser usado depois que a VP aprovar. Em caso de tentativa de fraude, invalide o carro: ele deixa de poder ser usado e o membro vê o motivo.
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
                                <TableHead>Situação</TableHead>
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
                                        {v.foto_painel_url ? (
                                            <a href={v.foto_painel_url} target="_blank" rel="noreferrer">
                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                <img src={v.foto_painel_url} alt="Painel" className="h-12 w-16 rounded object-cover bg-slate-100" />
                                            </a>
                                        ) : (
                                            <span className="text-xs text-slate-500">Sem foto (planilha)</span>
                                        )}
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
                                                {!v.invalidado_em && <Button size="icon" variant="ghost" className="h-8 w-8" title="Alterar autonomia"
                                                    onClick={() => { setEditando(v.id); setValor(String(v.autonomia_km_l).replace(".", ",")) }}>
                                                    <Pencil className="h-4 w-4" />
                                                </Button>}
                                            </div>
                                        )}
                                        {v.autonomia_alterada_em && (
                                            <span className="block text-xs text-amber-600">
                                                Informada: {formatarNumero(v.autonomia_informada, 1)} · ajustada por {v.alterado_por?.nome ?? "VP"}
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell><SituacaoCarro v={v} onMudou={carregar} /></TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )
}
