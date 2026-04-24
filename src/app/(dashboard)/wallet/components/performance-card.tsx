"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { CheckCircle2, AlertTriangle, Star } from "lucide-react"
import { useColaborador, useSupabaseQuery } from "@/hooks/use-supabase"

export function PerformanceCard() {
    const { colaborador, loading, colaboradorId } = useColaborador()
    const { data: npsData } = useSupabaseQuery<any>('avaliacoes_nps', {
        column: 'colaborador_id',
        value: colaboradorId,
        orderBy: 'ano',
        ascending: false,
        limit: 1,
        select: 'nps_geral, mes, ano'
    })

    if (loading) return <Card className="h-64 animate-pulse bg-slate-800 rounded-3xl border-none" />

    const nps = npsData.length > 0 ? Number(npsData[0].nps_geral) : 0
    const punishments = colaborador?.pontos_negativos || 0
    const nomeUsuario = colaborador?.nome || '—'
    const primeiroNome = nomeUsuario.split(' ')[0]

    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
    const periodoNps = npsData.length > 0
        ? `${months[npsData[0].mes - 1]}/${npsData[0].ano}`
        : null

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

                    {/* Último NPS avaliado */}
                    {npsData.length > 0 && (
                        <div className="mt-4 flex items-center gap-2 bg-white/5 border border-white/10 rounded-xl px-3 py-2 backdrop-blur-sm">
                            <Star className="h-4 w-4 text-amber-400 fill-amber-400 shrink-0" />
                            <div className="min-w-0">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-300">Último NPS Avaliado</p>
                                <p className="text-sm font-bold text-white truncate">
                                    {primeiroNome} — <span className="text-cyan-300">{nps.toFixed(1)}</span>
                                    {periodoNps && <span className="text-blue-300 font-normal text-xs ml-1.5">({periodoNps})</span>}
                                </p>
                            </div>
                        </div>
                    )}
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
