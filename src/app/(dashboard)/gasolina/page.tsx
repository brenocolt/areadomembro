"use client"

import { Fuel } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useColaborador } from "@/hooks/use-supabase"
import { podeGerirGasolina } from "@/lib/access-control"
import { MeusCarros } from "./components/meus-carros"
import { ChavePixCard } from "./components/chave-pix-card"
import { GestaoPrecos } from "./components/gestao-precos"
import { GestaoCarros } from "./components/gestao-carros"
import { GestaoCentrosCusto } from "./components/gestao-centros-custo"

const TRIGGER = "rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white font-semibold"

export default function GasolinaPage() {
    const { colaborador, role } = useColaborador()
    const gestor = podeGerirGasolina(colaborador, role)

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

            <Tabs defaultValue="carros" className="w-full space-y-6">
                <TabsList className="bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl flex-wrap h-auto">
                    <TabsTrigger value="carros" className={TRIGGER}>Meus carros e Pix</TabsTrigger>
                    {gestor && <TabsTrigger value="precos" className={TRIGGER}>Preço do mês</TabsTrigger>}
                    {gestor && <TabsTrigger value="carros-membros" className={TRIGGER}>Carros dos membros</TabsTrigger>}
                    {gestor && <TabsTrigger value="centros" className={TRIGGER}>Centros de custo</TabsTrigger>}
                </TabsList>

                <TabsContent value="carros" className="space-y-6 border-none p-0 outline-none">
                    <ChavePixCard />
                    <MeusCarros />
                </TabsContent>

                {gestor && (
                    <>
                        <TabsContent value="precos" className="border-none p-0 outline-none">
                            <GestaoPrecos />
                        </TabsContent>
                        <TabsContent value="carros-membros" className="border-none p-0 outline-none">
                            <GestaoCarros />
                        </TabsContent>
                        <TabsContent value="centros" className="border-none p-0 outline-none">
                            <GestaoCentrosCusto />
                        </TabsContent>
                    </>
                )}
            </Tabs>
        </div>
    )
}
