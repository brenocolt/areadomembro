import { MilesHeader } from "./components/miles-header"
import { MilesStats } from "./components/miles-stats"
import { TopRedeemers } from "./components/top-redeemers"
import { ExchangeRequests } from "./components/exchange-requests"
import { AdditionRequests } from "./components/addition-requests"
import { MilesDashboard } from "./components/miles-dashboard"
import { MilesHistory } from "./components/miles-history"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function MilesManagementPage() {
    return (
        <div className="space-y-6">
            <MilesHeader />

            <Tabs defaultValue="overview" className="w-full space-y-6">
                <TabsList className="bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
                    <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white font-semibold">
                        Visão Geral
                    </TabsTrigger>
                    <TabsTrigger value="history" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white font-semibold">
                        Histórico
                    </TabsTrigger>
                    <TabsTrigger value="dashboard" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white font-semibold">
                        Dashboard
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6 border-none p-0 outline-none">
                    <MilesStats />

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        <div className="lg:col-span-4 flex flex-col h-full">
                            <TopRedeemers />
                        </div>
                        <div className="lg:col-span-8 flex flex-col h-full">
                            <Tabs defaultValue="trocas" className="w-full h-full flex flex-col">
                                <TabsList className="grid w-full grid-cols-2 mb-4 bg-slate-100 dark:bg-slate-800/50 rounded-xl p-1">
                                    <TabsTrigger value="trocas" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-cyan-600 dark:data-[state=active]:bg-[#0f172a] dark:data-[state=active]:text-cyan-400">Solicitações de Troca</TabsTrigger>
                                    <TabsTrigger value="adicoes" className="rounded-lg data-[state=active]:bg-white data-[state=active]:text-cyan-600 dark:data-[state=active]:bg-[#0f172a] dark:data-[state=active]:text-cyan-400">Solicitações de Adição</TabsTrigger>
                                </TabsList>
                                <TabsContent value="trocas" className="flex-1 mt-0">
                                    <ExchangeRequests />
                                </TabsContent>
                                <TabsContent value="adicoes" className="flex-1 mt-0">
                                    <AdditionRequests />
                                </TabsContent>
                            </Tabs>
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="history" className="space-y-6 border-none p-0 outline-none">
                    <MilesHistory />
                </TabsContent>

                <TabsContent value="dashboard" className="space-y-6 border-none p-0 outline-none">
                    <MilesDashboard />
                </TabsContent>
            </Tabs>
        </div>
    )
}
