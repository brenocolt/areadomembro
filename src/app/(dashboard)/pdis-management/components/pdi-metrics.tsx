import { Card, CardContent } from "@/components/ui/card"
import { Users, TrendingUp, AlertTriangle } from "lucide-react"

export function PdiMetrics({ metrics }: { metrics: any }) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-3xl">
                <CardContent className="p-6">
                    <p className="text-sm font-medium text-slate-500 mb-2">Total de Colaboradores</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-4xl font-bold text-slate-900 dark:text-white">{metrics?.total || 0}</h3>
                        <span className="text-xs font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            +5%
                        </span>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-3xl">
                <CardContent className="p-6">
                    <p className="text-sm font-medium text-slate-500 mb-2">Média de Conclusão</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-4xl font-bold text-slate-900 dark:text-white">{Math.round(metrics?.avgProgress || 0)}%</h3>
                        <span className="text-xs font-bold text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            +2%
                        </span>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-3xl">
                <CardContent className="p-6">
                    <p className="text-sm font-medium text-slate-500 mb-2">PDIs em Atraso</p>
                    <div className="flex items-baseline gap-2">
                        <h3 className="text-4xl font-bold text-slate-900 dark:text-white">{metrics?.delayed || 0}</h3>
                        <span className="text-xs font-bold text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-1.5 py-0.5 rounded flex items-center">
                            <TrendingUp className="h-3 w-3 mr-1 rotate-180" />
                            -3%
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
