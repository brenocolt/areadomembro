"use client"

import { useCallback, useEffect, useState } from "react"
import { Check, ChevronDown, ChevronUp, Loader2, RefreshCw, RotateCcw, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { formatarData, formatarNumero, formatarReais, melhorCaminhoKm, type RotaViagem } from "@/lib/gasolina"
import { gasolinaApi } from "./api"

type Status = "Solicitado" | "Aprovado" | "Lançado" | "Pago" | "Recusado"

interface Solicitacao {
    id: string
    projeto: string
    qtd_viagens: number
    litros_total: number
    valor_total: number
    status: Status
    motivo_recusa: string | null
    criado_em: string
    atualizado_em: string
    centro?: { nome: string } | null
    colaborador?: { nome: string } | null
    viagens?: { id: string, data_viagem: string, origem_local: string, destino_local: string, distancia_km: number, litros: number | null, valor: number | null, status: string, rota?: RotaViagem | null }[]
}

const ETAPAS: Status[] = ["Solicitado", "Aprovado", "Lançado", "Pago"]

// Acompanhamento no estilo do kanban do Monday. `todos` = visão da VP.
export function Solicitacoes({ todos = false, versao = 0 }: { todos?: boolean, versao?: number }) {
    const [lista, setLista] = useState<Solicitacao[]>([])
    const [carregando, setCarregando] = useState(true)
    const [aberta, setAberta] = useState<string | null>(null)
    const [atualizando, setAtualizando] = useState(false)
    const [retomando, setRetomando] = useState<string | null>(null)

    const carregar = useCallback(async () => {
        try {
            const r = await gasolinaApi<{ solicitacoes: Solicitacao[] }>(`/api/gasolina/solicitacoes${todos ? "?todos=1" : ""}`)
            setLista(r.solicitacoes)
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setCarregando(false)
        }
    }, [todos])

    useEffect(() => { carregar() }, [carregar, versao])

    // Confere agora no Monday, sem esperar a sincronização automática.
    async function atualizar() {
        setAtualizando(true)
        try {
            const r = await gasolinaApi<{ atualizadas: number, aguarde?: boolean }>(
                `/api/gasolina/solicitacoes/sincronizar${todos ? "?todos=1" : ""}`, { method: "POST" })
            await carregar()
            if (r.aguarde) toast.info("Acabou de ser atualizado. Tente de novo em alguns segundos.")
            else toast.success(r.atualizadas ? `${r.atualizadas} solicitação(ões) com status novo.` : "Tudo em dia com o Monday.")
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setAtualizando(false)
        }
    }

    async function retomar(id: string) {
        setRetomando(id)
        try {
            const r = await gasolinaApi<{ retomadas: number, vencidas: number }>(`/api/gasolina/solicitacoes/${id}/retomar`, { method: "POST" })
            toast.success(r.vencidas
                ? `${r.retomadas} viagem(ns) voltaram para pendentes; ${r.vencidas} já tinham passado do prazo de 2 meses e ficaram vencidas.`
                : "As viagens voltaram para pendentes na aba Viagens. Corrija o que precisar e solicite de novo.")
            await carregar()
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setRetomando(null)
        }
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                    <CardTitle className="text-lg">{todos ? "Solicitações de todos os membros" : "Minhas solicitações"}</CardTitle>
                    <CardDescription className="mt-1">
                        O andamento acompanha o Processos de Pagamento: Solicitado → Aprovado → Lançado (pela terceirizada no banco) → Pago.
                        Atualiza sozinho a cada 2 minutos.
                    </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={atualizar} disabled={atualizando} className="shrink-0">
                    <RefreshCw className={`h-4 w-4 ${atualizando ? "animate-spin" : ""}`} /> Atualizar
                </Button>
            </CardHeader>
            <CardContent>
                {carregando ? (
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                ) : lista.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhuma solicitação ainda.</p>
                ) : (
                    <div className="space-y-3">
                        {lista.map(s => (
                            <div key={s.id} className="rounded-xl border border-slate-200 dark:border-white/10 p-4 space-y-3">
                                <div className="flex flex-wrap items-start justify-between gap-2">
                                    <div>
                                        <p className="font-semibold text-slate-900 dark:text-white">
                                            {todos && s.colaborador?.nome ? `${s.colaborador.nome} · ` : ""}{s.projeto}
                                        </p>
                                        <p className="text-xs text-slate-500">
                                            {s.centro?.nome ?? ""} · pedido em {formatarData(s.criado_em)} · {s.qtd_viagens} viagem(ns), {formatarNumero(s.litros_total, 2)} L
                                        </p>
                                    </div>
                                    <p className="text-lg font-bold text-slate-900 dark:text-white">{formatarReais(s.valor_total)}</p>
                                </div>

                                {s.status === "Recusado" ? (() => {
                                    const aRetomar = (s.viagens ?? []).filter(v => v.status === "Em solicitação").length
                                    return (
                                        <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg bg-red-50 dark:bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
                                            <span className="flex items-start gap-2 flex-1">
                                                <XCircle className="h-4 w-4 mt-0.5 shrink-0" />
                                                <span>
                                                    <b>Recusado.</b> {s.motivo_recusa || "Sem motivo informado."}{" "}
                                                    {aRetomar ? "Retome as viagens para corrigir e solicitar de novo." : "As viagens já voltaram para pendentes."}
                                                </span>
                                            </span>
                                            {aRetomar > 0 && !todos && (
                                                <Button size="sm" variant="outline" className="shrink-0 border-red-300 text-red-700 hover:bg-red-100 dark:border-red-500/40 dark:text-red-200"
                                                    onClick={() => retomar(s.id)} disabled={retomando === s.id}>
                                                    {retomando === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                                                    Retomar viagens
                                                </Button>
                                            )}
                                        </div>
                                    )
                                })() : (
                                    <div className="flex items-center gap-1 sm:gap-2">
                                        {ETAPAS.map((etapa, i) => {
                                            const atual = ETAPAS.indexOf(s.status)
                                            const feita = i <= atual
                                            return (
                                                <div key={etapa} className="flex flex-1 items-center gap-1 sm:gap-2 min-w-0">
                                                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${feita ? "bg-emerald-500 text-white" : "bg-slate-200 text-slate-500 dark:bg-white/10"}`}>
                                                        {feita ? <Check className="h-3.5 w-3.5" /> : i + 1}
                                                    </span>
                                                    <span className={`text-xs truncate ${i === atual ? "font-semibold text-slate-900 dark:text-white" : "text-slate-500"}`}>{etapa}</span>
                                                    {i < ETAPAS.length - 1 && <span className={`hidden sm:block h-px flex-1 ${i < atual ? "bg-emerald-500" : "bg-slate-200 dark:bg-white/10"}`} />}
                                                </div>
                                            )
                                        })}
                                    </div>
                                )}

                                {!!s.viagens?.length && (
                                    <button type="button" className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
                                        onClick={() => setAberta(a => a === s.id ? null : s.id)}>
                                        {aberta === s.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                                        {aberta === s.id ? "Esconder viagens" : "Ver viagens"}
                                    </button>
                                )}
                                {aberta === s.id && (
                                    <ul className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                                        {s.viagens!.map(v => (
                                            <li key={v.id} className="flex justify-between gap-3 py-2">
                                                <span>{formatarData(v.data_viagem)} · {v.origem_local} → {v.destino_local} <span className="text-xs text-slate-500">({formatarNumero(v.distancia_km, 1)} km{melhorCaminhoKm(v.rota) != null ? ` · melhor caminho ${formatarNumero(melhorCaminhoKm(v.rota), 1)} km` : ""})</span></span>
                                                <span className="whitespace-nowrap">{formatarReais(v.valor)}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
