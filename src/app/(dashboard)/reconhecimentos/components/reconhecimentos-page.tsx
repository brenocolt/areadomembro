"use client"

import { useMemo, useState } from "react"
import {
    Award, Calculator, CheckCircle2, ClipboardList, Gift, History, LayoutGrid, Plus, Settings, Trash2, XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, mensagemDeErro } from "@/lib/reconhecimentos/cliente"
import { STATUS_CLASS, STATUS_LABEL } from "@/lib/reconhecimentos/constantes"
import { dataISODoInstante, formatarData, formatarMoeda, hojeISO, normalizar } from "@/lib/reconhecimentos/datas"
import { adiantadoReconhecimento, type Bonificacao } from "@/lib/reconhecimentos/tipos"
import { useReconhecimentosDados } from "../use-reconhecimentos"
import { FILTROS_INICIAIS, FiltrosReconhecimentos, type EstadoFiltros } from "./filtros-reconhecimentos"
import { RegistrarDialog } from "./registrar-dialog"
import { AjustarRgsDialog } from "./ajustar-rgs-dialog"
import { KanbanBonificacoes } from "./kanban-bonificacoes"
import { BonificacaoDetalhe } from "./bonificacao-detalhe"
import { ConfiguracoesRegras } from "./configuracoes-regras"

const GATILHO_ABA = "gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"

export function ReconhecimentosPage() {
    const { dados, carregando, erro, recarregar } = useReconhecimentosDados()
    const { tipos, regras, reconhecimentos, bonificacoes, config } = dados

    const [registrarOpen, setRegistrarOpen] = useState(false)
    const [ajustarOpen, setAjustarOpen] = useState(false)
    const [selecionadaId, setSelecionadaId] = useState<string | null>(null)
    const [filtros, setFiltros] = useState<EstadoFiltros>(FILTROS_INICIAIS)
    const atualizarFiltros = (parcial: Partial<EstadoFiltros>) => setFiltros((f) => ({ ...f, ...parcial }))

    // A bonificação aberta é sempre a versão mais recente da lista.
    const selecionada = useMemo(() => bonificacoes.find((b) => b.id === selecionadaId) ?? null, [bonificacoes, selecionadaId])

    const bonifFiltradas = useMemo(() => {
        const q = normalizar(filtros.busca)
        return bonificacoes.filter((b) => {
            if (q && !normalizar(`${b.projeto_nome} ${b.pessoa_nome} ${b.tipo_nome} ${b.regra_nome} ${b.motivo}`).includes(q)) return false
            if (filtros.de && b.liberada_em < filtros.de) return false
            if (filtros.ate && b.liberada_em > filtros.ate) return false
            if (filtros.sujeito !== "todos") {
                const sujeito = b.projeto_id ? `projeto:${b.projeto_id}` : `pessoa:${b.pessoa_nome}`
                if (sujeito !== filtros.sujeito) return false
            }
            if (filtros.nucleo !== "todos" && b.nucleo_impacto !== filtros.nucleo) return false
            if (filtros.tipo !== "todos" && b.tipo_nome !== filtros.tipo) return false
            if (filtros.status !== "todos" && b.status !== filtros.status) return false
            return true
        })
    }, [bonificacoes, filtros])

    const recFiltrados = useMemo(() => {
        const q = normalizar(filtros.busca)
        return reconhecimentos.filter((r) => {
            const nomeTipo = r.reconhecimento_tipos?.nome || ""
            if (q && !normalizar(`${r.projeto_nome} ${r.pessoa_nome} ${nomeTipo}`).includes(q)) return false
            if (filtros.de && r.data < filtros.de) return false
            if (filtros.ate && r.data > filtros.ate) return false
            if (filtros.sujeito !== "todos") {
                const sujeito = r.projeto_id ? `projeto:${r.projeto_id}` : `pessoa:${r.pessoa_nome}`
                if (sujeito !== filtros.sujeito) return false
            }
            if (filtros.nucleo !== "todos" && r.nucleo_impacto !== filtros.nucleo) return false
            if (filtros.tipo !== "todos" && nomeTipo !== filtros.tipo) return false
            return true
        })
    }, [reconhecimentos, filtros])

    const sujeitos = useMemo(() => {
        const mapa = new Map<string, string>()
        for (const item of [...reconhecimentos, ...bonificacoes]) {
            if (item.projeto_id && item.projeto_nome) mapa.set(`projeto:${item.projeto_id}`, item.projeto_nome)
            if (!item.projeto_id && item.pessoa_nome) mapa.set(`pessoa:${item.pessoa_nome}`, item.pessoa_nome)
        }
        return [...mapa.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR"))
    }, [reconhecimentos, bonificacoes])

    const nucleos = useMemo(() => {
        const valores = new Set<string>()
        for (const item of [...reconhecimentos, ...bonificacoes]) {
            if (item.nucleo_impacto) valores.add(item.nucleo_impacto)
        }
        return [...valores].sort((a, b) => a.localeCompare(b, "pt-BR"))
    }, [reconhecimentos, bonificacoes])

    // Mês corrente no fuso de São Paulo.
    const mesAtual = hojeISO().slice(0, 7)
    const cards = [
        { label: "Liberadas no mês", valor: bonifFiltradas.filter((b) => String(b.liberada_em).slice(0, 7) === mesAtual).length, icon: Award, cor: "text-primary bg-primary/10" },
        { label: "Disponíveis", valor: bonifFiltradas.filter((b) => b.status === "disponivel").length, icon: Gift, cor: "text-accent-foreground bg-accent/20" },
        { label: "Entregues", valor: bonifFiltradas.filter((b) => b.status === "entregue").length, icon: CheckCircle2, cor: "text-emerald-600 bg-emerald-500/10" },
        { label: "Canceladas / expiradas", valor: bonifFiltradas.filter((b) => b.status === "cancelada" || b.status === "expirada").length, icon: XCircle, cor: "text-destructive bg-destructive/10" },
    ]

    const excluirReconhecimento = async (id: string) => {
        try {
            await api(`/api/reconhecimentos/${id}`, "DELETE")
            toast.success("Reconhecimento removido (bonificações já geradas são mantidas no histórico)")
            recarregar()
        } catch (e) {
            toast.error(mensagemDeErro(e, "Erro ao remover"))
        }
    }

    const linhaTempo = useMemo(() => {
        type Item = { chave: string; nome: string; data: string; descricao: string }
        const itens: Item[] = []
        for (const r of recFiltrados) {
            const nome = r.projeto_nome || r.pessoa_nome || "Sem identificação"
            itens.push({
                chave: nome,
                nome,
                data: r.data,
                descricao: `${r.reconhecimento_tipos?.nome || "Reconhecimento"}${adiantadoReconhecimento(r) ? " — Adiantado" : r.projeto_id ? " — Normal" : ""}${r.nucleo_impacto ? ` — ${r.nucleo_impacto}` : ""}`,
            })
        }
        for (const b of bonifFiltradas) {
            const nome = b.projeto_nome || b.pessoa_nome || "Sem identificação"
            itens.push({ chave: nome, nome, data: b.liberada_em, descricao: `Bonificação liberada — ${b.descricao_premiacao || formatarMoeda(Number(b.valor))} (${b.motivo})` })
            if (b.entregue_em) itens.push({ chave: nome, nome, data: dataISODoInstante(b.entregue_em), descricao: "Bonificação entregue" })
            if (b.cancelada_em) itens.push({ chave: nome, nome, data: dataISODoInstante(b.cancelada_em), descricao: `Bonificação cancelada — ${b.justificativa_cancelamento || ""}` })
        }
        const grupos = new Map<string, Item[]>()
        for (const i of itens) grupos.set(i.chave, [...(grupos.get(i.chave) || []), i])
        return [...grupos.entries()]
            .map(([nome, lista]) => [nome, lista.sort((a, b) => a.data.localeCompare(b.data))] as const)
            .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
    }, [recFiltrados, bonifFiltradas])

    const propsFiltros = { valor: filtros, onChange: atualizarFiltros, sujeitos, nucleos, tipos }

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h1 className="font-display text-2xl font-bold text-foreground">Reconhecimentos e Bonificações</h1>
                    <p className="text-sm text-muted-foreground">Registre reconhecimentos e acompanhe as bonificações geradas automaticamente</p>
                </div>
                <Button onClick={() => setRegistrarOpen(true)}>
                    <Plus className="mr-1 h-4 w-4" /> Registrar reconhecimento
                </Button>
            </div>

            {erro && (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                    {erro.message}
                </div>
            )}

            <Tabs defaultValue="visao" className="space-y-6">
                <TabsList className="flex-wrap border border-border/60 bg-card">
                    <TabsTrigger value="visao" className={GATILHO_ABA}><Award className="h-4 w-4" />Visão Geral</TabsTrigger>
                    <TabsTrigger value="registrar" className={GATILHO_ABA}><ClipboardList className="h-4 w-4" />Registrar</TabsTrigger>
                    <TabsTrigger value="bonificacoes" className={GATILHO_ABA}><LayoutGrid className="h-4 w-4" />Bonificações</TabsTrigger>
                    <TabsTrigger value="historico" className={GATILHO_ABA}><History className="h-4 w-4" />Histórico</TabsTrigger>
                    <TabsTrigger value="config" className={GATILHO_ABA}><Settings className="h-4 w-4" />Configurações</TabsTrigger>
                </TabsList>

                <TabsContent value="visao" className="space-y-6">
                    <FiltrosReconhecimentos {...propsFiltros} />
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        {cards.map((c) => (
                            <div key={c.label} className="rounded-xl border border-border/60 bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                                <div className="mb-3 flex items-center gap-3">
                                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.cor}`}>
                                        <c.icon className="h-5 w-5" />
                                    </div>
                                    <span className="text-sm font-medium text-muted-foreground">{c.label}</span>
                                </div>
                                <p className="font-display text-3xl font-bold">{c.valor}</p>
                            </div>
                        ))}
                    </div>

                    <Card>
                        <CardHeader><CardTitle className="text-base">Bonificações recentes</CardTitle></CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Projeto / Pessoa</TableHead>
                                        <TableHead>Reconhecimento</TableHead>
                                        <TableHead>Motivo</TableHead>
                                        <TableHead>Premiação</TableHead>
                                        <TableHead>Liberada</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {bonifFiltradas.slice(0, 10).map((b: Bonificacao) => (
                                        <TableRow key={b.id} className="cursor-pointer" onClick={() => setSelecionadaId(b.id)}>
                                            <TableCell className="font-medium">{b.projeto_nome || b.pessoa_nome}</TableCell>
                                            <TableCell>{b.tipo_nome}</TableCell>
                                            <TableCell>{b.motivo}</TableCell>
                                            <TableCell>{b.descricao_premiacao || formatarMoeda(Number(b.valor))}</TableCell>
                                            <TableCell>{formatarData(b.liberada_em)}</TableCell>
                                            <TableCell>
                                                <Badge variant="secondary" className={STATUS_CLASS[b.status]}>{STATUS_LABEL[b.status]}</Badge>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {bonifFiltradas.length === 0 && (
                                        <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">{carregando ? "Carregando..." : "Nenhuma bonificação encontrada"}</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="registrar" className="space-y-6">
                    <Card>
                        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
                            <CardTitle className="text-base">Reconhecimentos registrados</CardTitle>
                            <div className="flex items-center gap-2">
                                <Button variant="outline" onClick={() => setAjustarOpen(true)}><Calculator className="mr-1 h-4 w-4" />Ajustar RGs anteriores</Button>
                                <Button onClick={() => setRegistrarOpen(true)}><Plus className="mr-1 h-4 w-4" />Registrar reconhecimento</Button>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Data</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Projeto / Pessoa</TableHead>
                                        <TableHead>Adiantado?</TableHead>
                                        <TableHead>Núcleo</TableHead>
                                        <TableHead>Observação</TableHead>
                                        <TableHead />
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {reconhecimentos.map((r) => (
                                        <TableRow key={r.id}>
                                            <TableCell>{formatarData(r.data)}</TableCell>
                                            <TableCell>{r.reconhecimento_tipos?.nome}</TableCell>
                                            <TableCell className="font-medium">{r.projeto_nome || r.pessoa_nome}</TableCell>
                                            <TableCell>{r.projeto_id ? (adiantadoReconhecimento(r) ? "Sim" : "Não") : "—"}</TableCell>
                                            <TableCell>{r.nucleo_impacto || "—"}</TableCell>
                                            <TableCell className="max-w-xs truncate text-muted-foreground">{r.observacao}</TableCell>
                                            <TableCell className="text-right">
                                                <Button size="icon" variant="ghost" onClick={() => excluirReconhecimento(r.id)} aria-label="Excluir reconhecimento">
                                                    <Trash2 className="h-4 w-4 text-destructive" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {reconhecimentos.length === 0 && (
                                        <TableRow><TableCell colSpan={7} className="py-8 text-center text-muted-foreground">{carregando ? "Carregando..." : "Nenhum reconhecimento registrado"}</TableCell></TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="bonificacoes" className="space-y-6">
                    <FiltrosReconhecimentos {...propsFiltros} compacto />
                    <KanbanBonificacoes bonificacoes={bonifFiltradas} onSelect={(b) => setSelecionadaId(b.id)} />
                </TabsContent>

                <TabsContent value="historico" className="space-y-6">
                    <FiltrosReconhecimentos {...propsFiltros} />
                    <Card>
                        <CardHeader><CardTitle className="text-base">Linha do tempo</CardTitle></CardHeader>
                        <CardContent className="space-y-6">
                            {linhaTempo.length === 0 && <p className="py-8 text-center text-muted-foreground">Nenhum registro encontrado</p>}
                            {linhaTempo.map(([nome, itens]) => (
                                <div key={nome}>
                                    <h4 className="mb-2 font-semibold">{nome}</h4>
                                    <ul className="space-y-1.5 border-l border-border pl-4 text-sm">
                                        {itens.map((i, idx) => (
                                            <li key={idx} className="text-muted-foreground">
                                                <span className="tabular-nums text-foreground">{formatarData(i.data)}</span> — {i.descricao}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="config">
                    <ConfiguracoesRegras tipos={tipos} regras={regras} config={config} onAtualizado={recarregar} />
                </TabsContent>
            </Tabs>

            <RegistrarDialog open={registrarOpen} onOpenChange={setRegistrarOpen} tipos={tipos} reconhecimentos={reconhecimentos} onSalvo={recarregar} />
            <AjustarRgsDialog open={ajustarOpen} onOpenChange={setAjustarOpen} reconhecimentos={reconhecimentos} onSalvo={recarregar} />
            <BonificacaoDetalhe
                bonificacao={selecionada}
                reconhecimentos={reconhecimentos}
                onOpenChange={(o) => { if (!o) setSelecionadaId(null) }}
                onAtualizado={recarregar}
            />
        </div>
    )
}
