"use client"

import { NPSGerenteChart } from "./components/nps-gerente-chart"
import { NPSGerenteDetails } from "./components/nps-gerente-details"
import { useColaborador, useSupabaseQuery } from "@/hooks/use-supabase"
import { MessageSquare, HeartHandshake, LifeBuoy, Crown } from "lucide-react"

export default function NPSGerentePage() {
    const { colaboradorId, loading: loadingColab } = useColaborador()
    const { data: npsData } = useSupabaseQuery<any>('avaliacoes_nps', {
        column: 'colaborador_id',
        value: colaboradorId,
        orderBy: 'ano',
        ascending: false,
        limit: 12,
    })

    const avg = (field: string) => {
        if (npsData.length === 0) return '—'
        return (npsData.reduce((sum: number, n: any) => sum + Number(n[field] || 0), 0) / npsData.length).toFixed(1)
    }

    const metrics = [
        { title: "Comunicação", value: avg('comunicacao'), icon: MessageSquare, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-500/10" },
        { title: "Suporte", value: avg('suporte'), icon: LifeBuoy, color: "text-cyan-500", bg: "bg-cyan-50 dark:bg-cyan-500/10" },
        { title: "Relacionamento", value: avg('relacionamento'), icon: HeartHandshake, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
        { title: "Liderança", value: avg('lideranca'), icon: Crown, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center text-sm text-muted-foreground mb-2">
                <span>Dashboard</span>
                <span className="mx-2">›</span>
                <span className="font-semibold text-primary dark:text-white">NPS Gerente</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {metrics.map((m) => (
                    <div key={m.title} className="bg-white dark:bg-[#0F172A] p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-none">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2 rounded-xl ${m.bg}`}>
                                <m.icon className={`h-4 w-4 ${m.color}`} />
                            </div>
                            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">{m.title}</p>
                        </div>
                        <div className={`text-3xl font-display font-bold ${m.color}`}>{m.value}</div>
                        <p className="text-xs text-slate-500 mt-1.5 font-medium">{npsData.length} avaliações</p>
                    </div>
                ))}
            </div>

            <NPSGerenteChart />

            <NPSGerenteDetails />
        </div>
    )
}
