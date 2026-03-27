"use client"

import { NPSChart } from "./components/nps-chart";
import { DetailedPerformance } from "./components/detailed-performance";
import { useColaborador, useSupabaseQuery } from "@/hooks/use-supabase";

export default function PerformancePage() {
    const { colaboradorId, loading: loadingColab, colaborador } = useColaborador()
    const { data: npsData } = useSupabaseQuery<any>('avaliacoes_nps', {
        column: 'colaborador_id',
        value: colaboradorId,
        orderBy: 'ano',
        ascending: false,
        limit: 12,
        select: 'nps_geral'
    })

    const avgNps = npsData.length > 0
        ? (npsData.reduce((sum: number, n: any) => sum + Number(n.nps_geral), 0) / npsData.length).toFixed(1)
        : '—'

    const projetos = colaborador?.projetos || 0

    return (
        <div className="space-y-6">
            <div className="flex items-center text-sm text-muted-foreground mb-2">
                <span>Dashboard</span>
                <span className="mx-2">›</span>
                <span className="font-semibold text-primary dark:text-white">Performance & NPS</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <CardStat title="Média Geral" value={String(avgNps)} trend={`${npsData.length} avaliações`} color="text-green-500" />
                <CardStat title="Total Avaliações" value={String(npsData.length)} trend="Registradas no sistema" color="text-blue-500" />
                <CardStat title="Projetos em Andamento" value={String(projetos)} trend="Registrados no pré-cadastro" color="text-violet-500" />
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
