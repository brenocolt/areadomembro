"use client"
import { useState, useEffect } from "react"
import { PdiMetrics } from "./components/pdi-metrics"
import { PdiList } from "./components/pdi-list"
import { Button } from "@/components/ui/button"
import { PlusCircle, Search, Target } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Input } from "@/components/ui/input"
import { CreatePdiDialog } from "./components/create-pdi-dialog"

export default function PdisManagementPage() {
    const [stats, setStats] = useState({ total: 0, avgProgress: 0, delayed: 0 })

    useEffect(() => {
        async function fetchStats() {
            const { data: plans } = await supabase.from('pdi_planos').select('id, progresso, status, data_prazo')
            const { count: totalUsers } = await supabase.from('colaboradores').select('*', { count: 'exact', head: true })

            if (plans) {
                const now = new Date()
                const delayed = plans.filter((p: any) => {
                    const isCompleted = Number(p.progresso || 0) === 100
                    const isOverdue = p.data_prazo ? new Date(p.data_prazo) < now : false
                    return !isCompleted && isOverdue
                }).length
                const totalProgress = plans.reduce((acc: number, curr: any) => acc + (Number(curr.progresso) || 0), 0)
                const avgProgress = plans.length > 0 ? totalProgress / plans.length : 0

                setStats({
                    total: totalUsers || 0,
                    avgProgress,
                    delayed
                })
            }
        }
        fetchStats()
    }, [])

    return (
        <div className="flex flex-col gap-8 pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-cyan-50 dark:bg-cyan-500/10 p-2.5 rounded-2xl border border-cyan-100 dark:border-cyan-500/20">
                        <Target className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestão de PDIs</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Acompanhe o desenvolvimento individual da sua equipe.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar colaborador..."
                            className="bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 pl-9 rounded-xl h-10"
                        />
                    </div>
                    <CreatePdiDialog />
                </div>
            </div>

            <PdiMetrics metrics={stats} />

            <div className="bg-white dark:bg-[#0F172A] rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800/50">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Planos de Desenvolvimento</h2>
                        <p className="text-sm text-slate-500">Acompanhe o progresso individual da sua equipe.</p>
                    </div>
                </div>

                <PdiList />
            </div>
        </div>
    )
}
