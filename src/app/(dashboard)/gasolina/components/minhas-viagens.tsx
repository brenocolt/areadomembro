"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { AlertCircle, Clock, Loader2, MapPin, Pencil, Plus, RotateCcw, Route, Send, Trash2, X, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
    diasAte, formatarData, formatarMes, formatarNumero, formatarReais, inicioDoMes, prazoDaViagem, viagemRecusada,
    type GasolinaCentroCusto, type GasolinaVeiculo, type GasolinaViagem,
} from "@/lib/gasolina"
import { gasolinaApi } from "./api"
import { StatusViagemBadge } from "./status-viagem"
import { ViagemDialog } from "./viagem-dialog"
import { SolicitarDialog } from "./solicitar-dialog"

// Avisos de recusa que o membro fechou (só neste navegador; as viagens
// continuam "Recusada" e podem ser retomadas pela aba Solicitações).
const CHAVE_AVISOS_OCULTOS = "gasolina:avisos-recusa-ocultos"
function lerAvisosOcultos(): string[] {
    try { return JSON.parse(localStorage.getItem(CHAVE_AVISOS_OCULTOS) ?? "[]") } catch { return [] }
}

type ViagemLista = GasolinaViagem & { veiculo?: { modelo: string } | null, centro?: { nome: string } | null }

interface ResumoProjeto {
    centroId: string
    projeto: string
    centro: string
    valorPendente: number
    litrosPendentes: number
    aguardandoPreco: number
    litrosTotal: number
}

export function MinhasViagens({ onSolicitado }: { onSolicitado?: () => void }) {
    const [viagens, setViagens] = useState<ViagemLista[]>([])
    const [veiculos, setVeiculos] = useState<GasolinaVeiculo[]>([])
    const [centros, setCentros] = useState<GasolinaCentroCusto[]>([])
    const [carregando, setCarregando] = useState(true)
    const [dialogAberto, setDialogAberto] = useState(false)
    const [editando, setEditando] = useState<GasolinaViagem | null>(null)
    const [excluindo, setExcluindo] = useState<string | null>(null)
    const [solicitando, setSolicitando] = useState<{ centroId: string, centroNome: string, projeto: string } | null>(null)
    const [retomando, setRetomando] = useState<string | null>(null)
    const [avisosOcultos, setAvisosOcultos] = useState<string[]>(() => (typeof window === "undefined" ? [] : lerAvisosOcultos()))

    function fecharAviso(id: string) {
        const novos = [...new Set([...avisosOcultos, id])].slice(-200)
        setAvisosOcultos(novos)
        try { localStorage.setItem(CHAVE_AVISOS_OCULTOS, JSON.stringify(novos)) } catch { /* sem armazenamento: só some até recarregar */ }
    }

    const carregar = useCallback(async () => {
        try {
            const [v, c, cc] = await Promise.all([
                gasolinaApi<{ viagens: ViagemLista[] }>("/api/gasolina/viagens"),
                gasolinaApi<{ veiculos: GasolinaVeiculo[] }>("/api/gasolina/veiculos"),
                gasolinaApi<{ centros: GasolinaCentroCusto[] }>("/api/gasolina/centros-custo"),
            ])
            setViagens(v.viagens)
            setVeiculos(c.veiculos)
            setCentros(cc.centros.filter(x => x.ativo))
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setCarregando(false)
        }
    }, [])

    useEffect(() => { carregar() }, [carregar])

    // Totais por projeto, como o topo da planilha (PARA REEMBOLSAR R$ / L e TOTAL GASTO L).
    const resumo = useMemo(() => {
        const mapa = new Map<string, ResumoProjeto>()
        for (const v of viagens) {
            const chave = `${v.centro_custo_id}|${v.projeto}`
            const r = mapa.get(chave) ?? { centroId: v.centro_custo_id ?? "", projeto: v.projeto, centro: v.centro?.nome ?? "", valorPendente: 0, litrosPendentes: 0, aguardandoPreco: 0, litrosTotal: 0 }
            r.litrosTotal += Number(v.litros ?? 0)
            if (v.status === "Pendente") {
                r.litrosPendentes += Number(v.litros ?? 0)
                if (v.valor == null) r.aguardandoPreco++
                else r.valorPendente += Number(v.valor)
            }
            mapa.set(chave, r)
        }
        return [...mapa.values()].sort((a, b) => b.valorPendente - a.valorPendente || a.projeto.localeCompare(b.projeto))
    }, [viagens])

    const totalPendente = resumo.reduce((s, r) => s + r.valorPendente, 0)
    // Carros invalidados pela VP não aparecem para escolha.
    const veiculosAtivos = useMemo(() => veiculos.filter(v => v.ativo), [veiculos])

    // Solicitações recusadas com viagens ainda não retomadas.
    const recusadas = useMemo(() => {
        const mapa = new Map<string, { id: string, projeto: string, motivo: string | null, qtd: number }>()
        for (const v of viagens) {
            if (!viagemRecusada(v) || !v.solicitacao) continue
            const r = mapa.get(v.solicitacao.id) ?? { id: v.solicitacao.id, projeto: v.projeto, motivo: v.solicitacao.motivo_recusa, qtd: 0 }
            r.qtd++
            mapa.set(r.id, r)
        }
        return [...mapa.values()]
    }, [viagens])

    async function retomar(id: string) {
        setRetomando(id)
        try {
            const r = await gasolinaApi<{ retomadas: number, vencidas: number }>(`/api/gasolina/solicitacoes/${id}/retomar`, { method: "POST" })
            toast.success(r.vencidas
                ? `${r.retomadas} viagem(ns) voltaram para pendentes; ${r.vencidas} já tinham passado do prazo de 2 meses e ficaram vencidas.`
                : "As viagens voltaram para pendentes. Corrija o que precisar e solicite de novo.")
            await carregar()
            onSolicitado?.()
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setRetomando(null)
        }
    }

    function abrirNova() {
        if (veiculosAtivos.length === 0) {
            toast.error('Cadastre um carro na aba "Meus carros e Pix" antes de lançar viagens.')
            return
        }
        setEditando(null)
        setDialogAberto(true)
    }

    async function excluir(v: ViagemLista) {
        if (!confirm(`Excluir a viagem de ${formatarData(v.data_viagem)} (${v.origem_local} → ${v.destino_local})?`)) return
        setExcluindo(v.id)
        try {
            await gasolinaApi(`/api/gasolina/viagens/${v.id}`, { method: "DELETE" })
            toast.success("Viagem excluída.")
            setViagens(lista => lista.filter(x => x.id !== v.id))
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setExcluindo(null)
        }
    }

    if (carregando) return <Loader2 className="h-5 w-5 animate-spin text-slate-400" />

    return (
        <div className="space-y-6">
            {recusadas.filter(r => !avisosOcultos.includes(r.id)).map(r => (
                <div key={r.id} className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
                    <XCircle className="h-5 w-5 shrink-0 hidden sm:block" />
                    <div className="flex-1">
                        <p><b>Solicitação recusada — {r.projeto}</b> ({r.qtd} viagem{r.qtd === 1 ? "" : "s"})</p>
                        <p>Motivo: {r.motivo || "não informado."}</p>
                    </div>
                    <Button size="sm" variant="outline" className="shrink-0 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-500/40 dark:text-red-200"
                        onClick={() => retomar(r.id)} disabled={retomando === r.id}>
                        {retomando === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                        Retomar viagens
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 self-end sm:self-auto text-red-700 hover:bg-red-100 dark:text-red-200 dark:hover:bg-red-500/20"
                        onClick={() => fecharAviso(r.id)} title="Excluir aviso" aria-label="Excluir aviso">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            ))}

            <Card>
                <CardHeader className="flex flex-row items-start justify-between gap-4">
                    <div>
                        <CardTitle className="text-lg">Para reembolsar</CardTitle>
                        <CardDescription className="mt-1">
                            Viagens pendentes por projeto. Só entram no reembolso as viagens de meses que já têm o preço da gasolina definido pela VP.
                        </CardDescription>
                    </div>
                    <Button onClick={abrirNova} className="bg-amber-500 hover:bg-amber-600 text-white font-semibold shrink-0">
                        <Plus className="h-4 w-4" /> Lançar viagem
                    </Button>
                </CardHeader>
                <CardContent>
                    {resumo.length === 0 ? (
                        <p className="text-sm text-slate-500">Nenhuma viagem lançada ainda.</p>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {formatarReais(totalPendente)} <span className="text-sm font-normal text-slate-500">pendentes no total</span>
                            </p>
                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                {resumo.map(r => (
                                    <div key={`${r.centro}|${r.projeto}`} className="rounded-xl border border-slate-200 dark:border-white/10 p-4 space-y-1">
                                        <p className="font-semibold text-slate-900 dark:text-white">{r.projeto}</p>
                                        <p className="text-xs text-slate-500">{r.centro}</p>
                                        <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{formatarReais(r.valorPendente)}</p>
                                        <p className="text-xs text-slate-500">
                                            {formatarNumero(r.litrosPendentes, 2)} L pendentes · {formatarNumero(r.litrosTotal, 2)} L no total
                                        </p>
                                        {r.aguardandoPreco > 0 && (
                                            <p className="text-xs text-sky-600 dark:text-sky-400 flex items-center gap-1">
                                                <Clock className="h-3 w-3" /> {r.aguardandoPreco} viagem(ns) aguardando o preço do mês
                                            </p>
                                        )}
                                        {r.valorPendente > 0 && r.centroId && (
                                            <Button size="sm" className="mt-2 w-full bg-amber-500 hover:bg-amber-600 text-white"
                                                onClick={() => setSolicitando({ centroId: r.centroId, centroNome: r.centro, projeto: r.projeto })}>
                                                <Send className="h-4 w-4" /> Solicitar reembolso
                                            </Button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2"><Route className="h-5 w-5 text-amber-500" /> Minhas viagens</CardTitle>
                </CardHeader>
                <CardContent>
                    {viagens.length === 0 ? (
                        <p className="text-sm text-slate-500">Quando você lançar uma viagem, ela aparece aqui.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data</TableHead>
                                    <TableHead>Projeto</TableHead>
                                    <TableHead className="hidden md:table-cell">Trajeto</TableHead>
                                    <TableHead className="hidden sm:table-cell">Km / Litros</TableHead>
                                    <TableHead>Valor</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="w-20" />
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {viagens.map(v => <LinhaViagem key={v.id} v={v} excluindo={excluindo === v.id}
                                    onEditar={() => { setEditando(v); setDialogAberto(true) }} onExcluir={() => excluir(v)} />)}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <ViagemDialog open={dialogAberto} onOpenChange={setDialogAberto} viagem={editando}
                veiculos={veiculosAtivos} centros={centros} onSalva={carregar} />
            <SolicitarDialog alvo={solicitando} onOpenChange={o => { if (!o) setSolicitando(null) }}
                onSolicitado={() => { carregar(); onSolicitado?.() }} />
        </div>
    )
}

function LinhaViagem({ v, excluindo, onEditar, onExcluir }: { v: ViagemLista, excluindo: boolean, onEditar: () => void, onExcluir: () => void }) {
    const dias = v.status === "Pendente" ? diasAte(prazoDaViagem(v.data_viagem)) : null
    return (
        <TableRow>
            <TableCell className="whitespace-nowrap">{formatarData(v.data_viagem)}</TableCell>
            <TableCell>
                <span className="font-medium">{v.projeto}</span>
                <span className="block text-xs text-slate-500">{v.veiculo?.modelo ?? "—"}</span>
            </TableCell>
            <TableCell className="hidden md:table-cell text-sm">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3 shrink-0 text-slate-400" />{v.origem_local} → {v.destino_local}</span>
                {v.paradas?.length > 0 && <span className="block text-xs text-slate-500">Paradas: {v.paradas.join(", ")}</span>}
                {v.rota?.ida_e_volta && <span className="block text-xs text-slate-500">Ida e volta</span>}
            </TableCell>
            <TableCell className="hidden sm:table-cell text-sm whitespace-nowrap">
                {formatarNumero(v.distancia_km, 1)} km
                <span className="block text-xs text-slate-500">{v.litros != null ? `${formatarNumero(v.litros, 2)} L` : "—"}</span>
            </TableCell>
            <TableCell className="whitespace-nowrap">
                {v.valor != null ? formatarReais(v.valor) : (
                    <span className="text-xs text-sky-600 dark:text-sky-400" title="A VP ainda não lançou o preço desse mês">
                        Aguardando preço de {formatarMes(inicioDoMes(v.data_viagem))}
                    </span>
                )}
            </TableCell>
            <TableCell>
                <StatusViagemBadge status={v.status} recusada={viagemRecusada(v)} />
                {viagemRecusada(v) && v.solicitacao?.motivo_recusa && (
                    <span className="block text-xs mt-1 text-red-600 dark:text-red-400 max-w-[180px]" title={v.solicitacao.motivo_recusa}>
                        {v.solicitacao.motivo_recusa.length > 60 ? `${v.solicitacao.motivo_recusa.slice(0, 60)}…` : v.solicitacao.motivo_recusa}
                    </span>
                )}
                {dias !== null && (
                    <span className={`flex items-center gap-1 text-xs mt-1 ${dias <= 7 ? "text-red-600" : "text-slate-500"}`}>
                        {dias <= 7 && <AlertCircle className="h-3 w-3" />}
                        {dias <= 0 ? "Vence hoje" : `Vence em ${dias} dia${dias === 1 ? "" : "s"}`}
                    </span>
                )}
            </TableCell>
            <TableCell>
                {v.status === "Pendente" && (
                    <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEditar} title="Editar"><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-600" onClick={onExcluir} disabled={excluindo} title="Excluir">
                            {excluindo ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                    </div>
                )}
            </TableCell>
        </TableRow>
    )
}
