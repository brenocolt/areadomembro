"use client"

import { Card, CardContent } from "@/components/ui/card"
import { AlertTriangle, Clock } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"

export function PointsStats() {
    const [totalPoints, setTotalPoints] = useState(0)
    const [pendingRequests, setPendingRequests] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetch() {
            // Total de pontos negativos de todos os colaboradores
            const { data: colabs } = await supabase
                .from('colaboradores')
                .select('pontos_negativos, users!inner(id)')
            const total = colabs?.reduce((sum, c) => sum + (c.pontos_negativos || 0), 0) || 0
            setTotalPoints(total)

            // Solicitações pendentes
            const { count } = await supabase
                .from('solicitacoes_remocao')
                .select('*', { count: 'exact', head: true })
                .eq('status', 'PENDENTE')
            setPendingRequests(count || 0)

            setLoading(false)
        }
        fetch()

        window.addEventListener('refreshPointsData', fetch)
        return () => window.removeEventListener('refreshPointsData', fetch)
    }, [])

    if (loading) return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[...Array(2)].map((_, i) => <Card key={i} className="h-36 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-3xl border-none" />)}
        </div>
    )

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none text-slate-900 dark:text-white rounded-3xl shadow-lg relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8">
                    <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-rose-500/10 to-transparent pointer-events-none" />
                    <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-3 rounded-2xl absolute right-8 top-8 group-hover:scale-110 transition-transform duration-300 backdrop-blur-md">
                        <AlertTriangle className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                    </div>

                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Total de Pontos Ativos</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-display font-black text-slate-900 dark:text-white tracking-tight">{new Intl.NumberFormat('pt-BR').format(totalPoints)}</span>
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-bold">pts</span>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none text-slate-900 dark:text-white rounded-3xl shadow-lg relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8">
                    <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-amber-500/10 to-transparent pointer-events-none" />
                    <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-3 rounded-2xl absolute right-8 top-8 group-hover:scale-110 transition-transform duration-300 backdrop-blur-md">
                        <Clock className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>

                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Solicitações Pendentes</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-5xl font-display font-black text-slate-900 dark:text-white tracking-tight">{String(pendingRequests).padStart(2, '0')}</span>
                        <span className="text-sm text-slate-500 dark:text-slate-400 font-bold">aguardando</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
