"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, AlertTriangle } from "lucide-react"
import { useColaborador, useSupabaseQuery } from "@/hooks/use-supabase"

export function PerformanceCard() {
    const { colaborador, loading, colaboradorId } = useColaborador()
    const { data: npsData } = useSupabaseQuery<any>('avaliacoes_nps', {
        column: 'colaborador_id',
        value: colaboradorId,
        orderBy: 'ano',
        ascending: false,
        limit: 1,
        select: 'nps_geral'
    })

    if (loading) return <Card className="h-64 animate-pulse bg-slate-800 rounded-3xl border-none" />

    const nps = npsData.length > 0 ? Number(npsData[0].nps_geral) : 0
    const punishments = colaborador?.pontos_negativos || 0

    return (
        <Card className="bg-[#001a41] text-white border-none shadow-lg rounded-3xl overflow-hidden flex flex-col justify-center h-full">
            <CardContent className="p-8 relative">
                <div className="mb-6 mt-4">
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-200">Performance Geral (NPS)</span>
                    <div className="flex items-end gap-2 mt-1">
                        <span className="text-5xl font-display font-bold">{nps.toFixed(1)}</span>
                        <span className="text-xl text-blue-200 mb-1">/ 5</span>
                    </div>
                    <Progress value={nps * 20} className="mt-4 h-2 bg-blue-900" indicatorClassName="bg-accent" />
                </div>

                <div className="flex items-center justify-between bg-white/10 p-4 rounded-xl backdrop-blur-sm">
                    <div>
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-200 block">Punições Ativas</span>
                        <span className="text-xl font-bold">{punishments} pts</span>
                    </div>
                    {punishments === 0 ? (
                        <CheckCircle2 className="h-8 w-8 text-green-400" />
                    ) : (
                        <AlertTriangle className="h-8 w-8 text-red-500" />
                    )}
                </div>
            </CardContent >
        </Card >
    )
}
