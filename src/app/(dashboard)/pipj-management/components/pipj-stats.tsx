"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Wallet, TrendingDown, ArrowDownCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"

export function PipjStats() {
    const [totalPipj, setTotalPipj] = useState(0)
    const [avgWithdrawal, setAvgWithdrawal] = useState(0)
    const [totalWithdrawals, setTotalWithdrawals] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchData() {
            setLoading(true)

            // 1. Total PIPJ (sum of all colaboradores saldo_pipj)
            const { data: colabs } = await supabase
                .from('colaboradores')
                .select('saldo_pipj')

            const total = colabs?.reduce((sum, c) => sum + Number(c.saldo_pipj || 0), 0) || 0
            setTotalPipj(total)

            // 2. Avg monthly withdrawal (transacoes_pipj tipo SAIDA grouped by month)
            const { data: saidas } = await supabase
                .from('transacoes_pipj')
                .select('valor, data')
                .eq('tipo', 'SAIDA')

            if (saidas && saidas.length > 0) {
                const monthMap = new Map<string, number>()
                saidas.forEach(s => {
                    const d = new Date(s.data)
                    const key = `${d.getFullYear()}-${d.getMonth()}`
                    monthMap.set(key, (monthMap.get(key) || 0) + Number(s.valor || 0))
                })
                const months = monthMap.size || 1
                const totalSaida = saidas.reduce((sum, s) => sum + Number(s.valor || 0), 0)
                setAvgWithdrawal(totalSaida / months)
                setTotalWithdrawals(totalSaida)
            }

            setLoading(false)
        }

        fetchData()

        window.addEventListener('refreshPipjData', fetchData)
        const sub = supabase.channel('colab_pipj_stats')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'colaboradores' }, fetchData)
            .subscribe()

        return () => {
            supabase.removeChannel(sub)
            window.removeEventListener('refreshPipjData', fetchData)
        }
    }, [])

    if (loading) return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => <Card key={i} className="h-36 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-3xl border-none" />)}
        </div>
    )

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Total PIPJ Card */}
            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none text-slate-900 dark:text-white rounded-3xl shadow-lg relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8">
                    <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />
                    <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-3 rounded-2xl absolute right-8 top-8 group-hover:scale-110 transition-transform duration-300 backdrop-blur-md">
                        <Wallet className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>

                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Total de PIPJ em Circulação</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-display font-black text-slate-900 dark:text-white tracking-tight">
                            R$ {totalPipj.toFixed(2).replace('.', ',')}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Avg Monthly Withdrawal Card */}
            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none text-slate-900 dark:text-white rounded-3xl shadow-lg relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8">
                    <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-rose-500/10 to-transparent pointer-events-none" />
                    <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-3 rounded-2xl absolute right-8 top-8 group-hover:scale-110 transition-transform duration-300 backdrop-blur-md">
                        <TrendingDown className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                    </div>

                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Média de Retirada Mensal</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-display font-black text-slate-900 dark:text-white tracking-tight">
                            R$ {avgWithdrawal.toFixed(2).replace('.', ',')}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Total Withdrawals Card */}
            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none text-slate-900 dark:text-white rounded-3xl shadow-lg relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8">
                    <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-amber-500/10 to-transparent pointer-events-none" />
                    <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-3 rounded-2xl absolute right-8 top-8 group-hover:scale-110 transition-transform duration-300 backdrop-blur-md">
                        <ArrowDownCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>

                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Total Retirado (Geral)</p>
                    <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-display font-black text-slate-900 dark:text-white tracking-tight">
                            R$ {totalWithdrawals.toFixed(2).replace('.', ',')}
                        </span>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
