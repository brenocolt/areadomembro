import { PipjHeader } from "./components/pipj-header"
import { PipjStats } from "./components/pipj-stats"
import { PipjTopHolders } from "./components/pipj-top-holders"
import { PipjHistory } from "./components/pipj-history"
import { PipjDashboard } from "./components/pipj-dashboard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function PipjManagementPage() {
    return (
        <div className="space-y-6">
            <PipjHeader />

            <Tabs defaultValue="overview" className="w-full space-y-6">
                <TabsList className="bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
                    <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white font-semibold">
                        Visão Geral
                    </TabsTrigger>
                    <TabsTrigger value="dashboard" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white font-semibold">
                        Dashboard
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6 border-none p-0 outline-none">
                    <PipjStats />

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        <div className="lg:col-span-4 flex flex-col h-full">
                            <PipjTopHolders />
                        </div>
                        <div className="lg:col-span-8 flex flex-col h-full">
                            <PipjHistory />
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="dashboard" className="space-y-6 border-none p-0 outline-none">
                    <PipjDashboard />
                </TabsContent>
            </Tabs>
        </div>
    )
}
