"use client"

import { NPSChart } from "./components/nps-chart";
import { DetailedPerformance } from "./components/detailed-performance";
import { useColaborador, useSupabaseQuery } from "@/hooks/use-supabase";
import { ImportNpsDialog } from "@/components/import-nps-dialog";
import { MessageSquare, FolderKanban, Zap, Award } from "lucide-react"

export default function PerformancePage() {
    const { colaboradorId, loading: loadingColab, colaborador } = useColaborador()
    const { data: npsData } = useSupabaseQuery<any>('avaliacoes_nps', {
        column: 'colaborador_id',
        value: colaboradorId,
        orderBy: 'ano',
        ascending: false,
        limit: 12,
        select: 'nps_geral, comunicacao, organizacao, proatividade, qualidade_entregas'
    })

    const avg = (field: string) => {
        if (npsData.length === 0) return '—'
        return (npsData.reduce((sum: number, n: any) => sum + Number(n[field] || 0), 0) / npsData.length).toFixed(1)
    }

    const projetos = colaborador?.projetos || 0

    const metrics = [
        { title: "Comunicação", value: avg('comunicacao'), icon: MessageSquare, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-500/10" },
        { title: "Organização", value: avg('organizacao'), icon: FolderKanban, color: "text-cyan-500", bg: "bg-cyan-50 dark:bg-cyan-500/10" },
        { title: "Proatividade", value: avg('proatividade'), icon: Zap, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
        { title: "Qualidade", value: avg('qualidade_entregas'), icon: Award, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center text-sm text-muted-foreground">
                    <span>Dashboard</span>
                    <span className="mx-2">›</span>
                    <span className="font-semibold text-primary dark:text-white">Performance & NPS</span>
                </div>
                <ImportNpsDialog />
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

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <CardStat title="Média Geral" value={avg('nps_geral')} trend={`${npsData.length} avaliações`} color="text-green-500" />
                <CardStat title="Total Avaliações" value={String(npsData.length)} trend="Registradas no sistema" color="text-blue-500" />
                <CardStat title="Projetos Alocados" value={String(projetos)} trend={`Impacta no cálculo de PIPJ (+R$${projetos > 0 ? (15 * projetos) : 0}/mês)`} color="text-violet-500" />
            </div>

            <NPSChart />

            <DetailedPerformance />
        </div>
    )
}

function CardStat({ title, value, trend, color }: { title: string, value: string, trend: string, color: string }) {
    return (
        <div className="bg-white dark:bg-[#0F172A] p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-none">
            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">{title}</p>
            <div className={`text-4xl font-display font-bold mt-2 ${color}`}>{value}</div>
            <p className="text-xs text-slate-500 mt-2 font-medium">{trend}</p>
        </div>
    )
}
