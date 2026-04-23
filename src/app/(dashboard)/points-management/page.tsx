import { PointsHeader } from "./components/points-header"
import { PointsStats } from "./components/points-stats"
import { TopOffenders } from "./components/top-offenders"
import { RemovalRequests } from "./components/removal-requests"
import { RecentHistory } from "./components/recent-history"
import { RemovalHistory } from "./components/removal-history"
import { PointsDashboard } from "./components/points-dashboard"
import { PointsRecurrence } from "./components/points-recurrence"
import { AllFlagsView } from "./components/all-flags-view"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function PointsManagementPage() {
    return (
        <div className="space-y-6">
            <PointsHeader />

            <Tabs defaultValue="overview" className="w-full space-y-6">
                <TabsList className="bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl">
                    <TabsTrigger value="overview" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white font-semibold">
                        Visão Geral
                    </TabsTrigger>
                    <TabsTrigger value="dashboard" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white font-semibold">
                        Dashboard
                    </TabsTrigger>
                    <TabsTrigger value="recurrence" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white font-semibold">
                        Recorrência
                    </TabsTrigger>
                    <TabsTrigger value="flags" className="rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white font-semibold">
                        Flags
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6 border-none p-0 outline-none">
                    <PointsStats />

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                        <div className="lg:col-span-4 flex flex-col h-full">
                            <TopOffenders />
                        </div>
                        <div className="lg:col-span-8 flex flex-col h-full">
                            <RemovalRequests />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <RecentHistory />
                        <RemovalHistory />
                    </div>
                </TabsContent>

                <TabsContent value="dashboard" className="space-y-6 border-none p-0 outline-none">
                    <PointsDashboard />
                </TabsContent>

                <TabsContent value="recurrence" className="space-y-6 border-none p-0 outline-none">
                    <PointsRecurrence />
                </TabsContent>

                <TabsContent value="flags" className="space-y-6 border-none p-0 outline-none">
                    <AllFlagsView />
                </TabsContent>
            </Tabs>
        </div>
    )
}

