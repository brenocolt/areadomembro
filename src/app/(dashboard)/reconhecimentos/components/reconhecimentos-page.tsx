"use client"

import { useMemo, useState } from "react"
import { Award, ClipboardList, History, LayoutGrid, Plus, Settings } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { sujeitoDe } from "@/lib/reconhecimentos/apresentacao"
import type { Reconhecimento } from "@/lib/reconhecimentos/tipos"
import { useReconhecimentos } from "../use-reconhecimentos"
import { AbaConfiguracoes } from "./aba-configuracoes"
import { AbaHistorico } from "./aba-historico"
import { AbaRegistrar } from "./aba-registrar"
import { BarraDeFiltros, FILTROS_VAZIOS, filtrarBonificacoes, filtrarReconhecimentos, type Filtros } from "./filtros"
import { Kanban } from "./kanban"
import { PainelBonificacao } from "./painel-bonificacao"
import { ReconhecimentoDialog } from "./reconhecimento-dialog"
import { VisaoGeral } from "./visao-geral"

export function ReconhecimentosPage() {
    const { dados, projetos, colaboradores, carregando, erro, recarregar } = useReconhecimentos()
    const [aba, setAba] = useState("visao-geral")
    const [filtros, setFiltros] = useState<Filtros>(FILTROS_VAZIOS)
    const [dialogAberto, setDialogAberto] = useState(false)
    const [editando, setEditando] = useState<Reconhecimento | null>(null)
    const [abertaId, setAbertaId] = useState<string | null>(null)
    const [versao, setVersao] = useState(0)

    const nucleoDoColaborador = useMemo(() => new Map(colaboradores.map(c => [c.id, c.nucleo])), [colaboradores])
    const nomes = useMemo(() => {
        if (!dados) return []
        const s = new Set<string>()
        for (const x of [...dados.bonificacoes, ...dados.reconhecimentos]) s.add(sujeitoDe(x))
        return [...s].sort((a, b) => a.localeCompare(b, "pt-BR"))
    }, [dados])

    const bonificacoes = useMemo(() => (dados ? filtrarBonificacoes(dados.bonificacoes, filtros, dados.tipos, nucleoDoColaborador) : []), [dados, filtros, nucleoDoColaborador])
    // Indicadores da visão geral ignoram o filtro de status (os cartões já são por status).
    const paraIndicadores = useMemo(() => (dados ? filtrarBonificacoes(dados.bonificacoes, filtros, dados.tipos, nucleoDoColaborador, { ignorarStatus: true }) : []), [dados, filtros, nucleoDoColaborador])
    const reconhecimentos = useMemo(() => (dados ? filtrarReconhecimentos(dados.reconhecimentos, filtros, dados.tipos, nucleoDoColaborador) : []), [dados, filtros, nucleoDoColaborador])

    const alterado = () => { setVersao(v => v + 1); void recarregar() }
    const novo = () => { setEditando(null); setDialogAberto(true) }
    const editar = (r: Reconhecimento) => { setEditando(r); setDialogAberto(true) }

    if (erro && !dados) {
        return (
            <div className="mx-auto max-w-xl p-8 text-center" role="alert">
                <h1 className="text-xl font-bold">Reconhecimentos e Bonificações</h1>
                <p className="mt-3 text-sm text-muted-foreground">{erro.message}</p>
                <Button className="mt-4" variant="outline" onClick={() => void recarregar()}>Tentar novamente</Button>
            </div>
        )
    }
    if (!dados) return <div className="p-8 text-sm text-muted-foreground" role="status">{carregando ? "Carregando..." : ""}</div>

    const nucleosElegiveis = dados.nucleos.filter(n => n.elegivel).map(n => n.nucleo)
    const comFiltros = aba === "visao-geral" || aba === "registrar" || aba === "bonificacoes"

    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Reconhecimentos e Bonificações</h1>
                    <p className="text-sm text-muted-foreground">Registre reconhecimentos, acompanhe as bonificações geradas e controle a entrega por colaborador.</p>
                </div>
                <Button onClick={novo}><Plus className="mr-2 h-4 w-4" />Registrar reconhecimento</Button>
            </div>

            <Tabs value={aba} onValueChange={setAba}>
                <TabsList className="h-auto flex-wrap justify-start">
                    <TabsTrigger value="visao-geral"><Award className="mr-1.5 h-4 w-4" />Visão Geral</TabsTrigger>
                    <TabsTrigger value="registrar"><ClipboardList className="mr-1.5 h-4 w-4" />Registrar</TabsTrigger>
                    <TabsTrigger value="bonificacoes"><LayoutGrid className="mr-1.5 h-4 w-4" />Bonificações</TabsTrigger>
                    <TabsTrigger value="historico"><History className="mr-1.5 h-4 w-4" />Histórico</TabsTrigger>
                    <TabsTrigger value="configuracoes"><Settings className="mr-1.5 h-4 w-4" />Configurações</TabsTrigger>
                </TabsList>

                {comFiltros && (
                    <div className="mt-4">
                        <BarraDeFiltros filtros={filtros} onChange={setFiltros} tipos={dados.tipos} nomesPessoasProjetos={nomes} mostrarStatus={aba === "bonificacoes"} />
                    </div>
                )}

                <TabsContent value="visao-geral" className="mt-4"><VisaoGeral bonificacoes={paraIndicadores} onAbrir={setAbertaId} /></TabsContent>
                <TabsContent value="registrar" className="mt-4"><AbaRegistrar dados={dados} reconhecimentos={reconhecimentos} onNovo={novo} onEditar={editar} onAlterado={alterado} /></TabsContent>
                <TabsContent value="bonificacoes" className="mt-4"><Kanban bonificacoes={bonificacoes} entregas={dados.entregas} onAbrir={setAbertaId} /></TabsContent>
                <TabsContent value="historico" className="mt-4"><AbaHistorico dados={dados} versao={versao} /></TabsContent>
                <TabsContent value="configuracoes" className="mt-4"><AbaConfiguracoes dados={dados} onAlterado={alterado} /></TabsContent>
            </Tabs>

            <ReconhecimentoDialog open={dialogAberto} onOpenChange={setDialogAberto} tipos={dados.tipos} projetos={projetos} colaboradores={colaboradores}
                nucleosElegiveis={nucleosElegiveis} editando={editando} onSalvo={alterado} />
            <PainelBonificacao bonificacaoId={abertaId} onFechar={() => setAbertaId(null)} dados={dados} colaboradores={colaboradores} onAlterado={alterado} />
        </div>
    )
}
