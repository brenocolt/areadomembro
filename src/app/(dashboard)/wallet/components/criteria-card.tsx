"use client"

import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Briefcase, Trophy, AlertTriangle, BarChart3, Target } from "lucide-react"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"

export function CriteriaCard() {
    const { colaborador, loading, colaboradorId } = useColaborador()
    const [nps, setNps] = useState(0)
    const [npsLoading, setNpsLoading] = useState(true)

    useEffect(() => {
        async function fetchLatestNps() {
            if (!colaboradorId) { setNpsLoading(false); return }

            // NPS = média das avaliações do mês mais recente com dados
            // (mesma lógica de wallet/performance-card e /performance).
            const { data } = await supabase
                .from('avaliacoes_nps')
                .select('nps_geral, mes, ano')
                .eq('colaborador_id', colaboradorId)
                .order('ano', { ascending: false })
                .order('mes', { ascending: false })
                .limit(12)

            if (data && data.length > 0) {
                const latest = data[0]
                const rows = data.filter(d => d.mes === latest.mes && d.ano === latest.ano)
                const avg = rows.reduce((s, d) => s + Number(d.nps_geral || 0), 0) / rows.length
                setNps(avg)
            }
            setNpsLoading(false)
        }
        fetchLatestNps()
    }, [colaboradorId])

    if (loading || npsLoading) return <Card className="h-48 animate-pulse bg-slate-800 rounded-3xl border-none" />

    const cargo = colaborador?.cargo_atual || '—'
    const puntos = colaborador?.pontos_negativos || 0

    return (
        <Card className="bg-[#001a41] text-white border-none shadow-lg rounded-3xl overflow-hidden min-h-[200px] flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                    <Target className="w-5 h-5 text-blue-400" />
                    Critérios do Saldo PIPJ
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 p-6 pt-2 flex items-center">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
                    {/* Item 1: Cargo */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex flex-col justify-between hover:bg-white/10 transition-colors group h-24">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-blue-300">Cargo</span>
                            <Briefcase className="w-4 h-4 text-blue-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex items-center gap-2">
                            <span className="text-lg font-bold">{cargo}</span>
                            <div className="h-2 w-2 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.5)] animate-pulse" />
                        </div>
                    </div>

                    {/* Item 2: Núcleo */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex flex-col justify-between hover:bg-white/10 transition-colors group h-24">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-blue-300">Núcleo</span>
                            <Trophy className="w-4 h-4 text-yellow-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <span className="text-lg font-bold">{colaborador?.nucleo_atual || '—'}</span>
                    </div>

                    {/* Item 3: Pontos */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex flex-col justify-between hover:bg-white/10 transition-colors group h-24">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-blue-300">Punições</span>
                            <AlertTriangle className="w-4 h-4 text-red-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <span className="text-lg font-mono font-bold text-red-400">{puntos} pts</span>
                    </div>

                    {/* Item 4: NPS */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-md flex flex-col justify-between hover:bg-white/10 transition-colors group h-24">
                        <div className="flex justify-between items-start">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-blue-300">NPS Global</span>
                            <BarChart3 className="w-4 h-4 text-cyan-400 opacity-50 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-bold text-cyan-300">{nps.toFixed(1)}</span>
                            <span className="text-xs text-blue-300">/ 5</span>
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
