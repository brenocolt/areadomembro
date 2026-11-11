"use client"

import { useState } from "react"
import { Fuel } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useColaborador } from "@/hooks/use-supabase"
import { podeGerirGasolina } from "@/lib/access-control"
import { MeusCarros } from "./components/meus-carros"
import { MinhasViagens } from "./components/minhas-viagens"
import { VisaoGeral } from "./components/visao-geral"
import { Solicitacoes } from "./components/solicitacoes"
import { ImportarPlanilha } from "./components/importar-planilha"
import { ChavePixCard } from "./components/chave-pix-card"
import { GestaoPrecos } from "./components/gestao-precos"
import { GestaoCarros } from "./components/gestao-carros"
import { GestaoCentrosCusto } from "./components/gestao-centros-custo"

const TRIGGER = "rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white font-semibold"

export default function GasolinaPage() {
    const { colaborador, role } = useColaborador()
    const gestor = podeGerirGasolina(colaborador, role)
    // Recarrega a aba Solicitações quando um pedido sai da aba Viagens.
    const [versaoSolicitacoes, setVersaoSolicitacoes] = useState(0)
    // Visão geral (VP): uma lista por vez — solicitações ou viagens.
    const [listaVisaoGeral, setListaVisaoGeral] = useState<"solicitacoes" | "viagens">("solicitacoes")

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Fuel className="h-7 w-7 text-amber-500" />
                    Reembolso de <span className="text-amber-500">Gasolina</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Cadastre seus carros, lance suas viagens a serviço da Produtiva e solicite o reembolso.
                </p>
            </div>

            <Tabs defaultValue="viagens" className="w-full space-y-6">
                <TabsList className="bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl flex-wrap h-auto">
                    <TabsTrigger value="viagens" className={TRIGGER}>Viagens</TabsTrigger>
                    <TabsTrigger value="solicitacoes" className={TRIGGER}>Solicitações</TabsTrigger>
                    <TabsTrigger value="carros" className={TRIGGER}>Meus carros e Pix</TabsTrigger>
                    {gestor && <TabsTrigger value="visao-geral" className={TRIGGER}>Visão geral</TabsTrigger>}
                    {gestor && <TabsTrigger value="precos" className={TRIGGER}>Preço do mês</TabsTrigger>}
                    {gestor && <TabsTrigger value="carros-membros" className={TRIGGER}>Carros dos membros</TabsTrigger>}
                    {gestor && <TabsTrigger value="centros" className={TRIGGER}>Centros de custo</TabsTrigger>}
                    {gestor && <TabsTrigger value="importar" className={TRIGGER}>Importar planilha</TabsTrigger>}
                </TabsList>

                <TabsContent value="viagens" className="border-none p-0 outline-none">
                    <MinhasViagens onSolicitado={() => setVersaoSolicitacoes(v => v + 1)} />
                </TabsContent>

                <TabsContent value="solicitacoes" className="border-none p-0 outline-none">
                    <Solicitacoes versao={versaoSolicitacoes} />
                </TabsContent>

                <TabsContent value="carros" className="space-y-6 border-none p-0 outline-none">
                    <ChavePixCard />
                    <MeusCarros />
                </TabsContent>

                {gestor && (
                    <>
                        <TabsContent value="visao-geral" className="border-none p-0 outline-none">
                            <div className="space-y-4">
                                <div role="tablist" aria-label="O que ver na visão geral" className="inline-flex rounded-lg bg-slate-100 dark:bg-slate-800/50 p-1">
                                    {([["solicitacoes", "Solicitações"], ["viagens", "Viagens"]] as const).map(([valor, rotulo]) => (
                                        <button key={valor} type="button" role="tab" aria-selected={listaVisaoGeral === valor}
                                            onClick={() => setListaVisaoGeral(valor)}
                                            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${listaVisaoGeral === valor
                                                ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                                                : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
                                            {rotulo}
                                        </button>
                                    ))}
                                </div>
                                {listaVisaoGeral === "solicitacoes"
                                    ? <Solicitacoes todos versao={versaoSolicitacoes} />
                                    : <VisaoGeral />}
                            </div>
                        </TabsContent>
                        <TabsContent value="precos" className="border-none p-0 outline-none">
                            <GestaoPrecos />
                        </TabsContent>
                        <TabsContent value="carros-membros" className="border-none p-0 outline-none">
                            <GestaoCarros />
                        </TabsContent>
                        <TabsContent value="centros" className="border-none p-0 outline-none">
                            <GestaoCentrosCusto />
                        </TabsContent>
                        <TabsContent value="importar" className="border-none p-0 outline-none">
                            <ImportarPlanilha />
                        </TabsContent>
                    </>
                )}
            </Tabs>
        </div>
    )
}
