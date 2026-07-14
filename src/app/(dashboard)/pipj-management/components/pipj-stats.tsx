"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Wallet, TrendingDown, ArrowDownCircle, ShieldAlert } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { CARGO_FANTASMA } from "@/lib/cargos"
import { useState, useEffect } from "react"

const LIMITE_MENSAL = 4000

export function PipjStats() {
    const [totalPipj, setTotalPipj] = useState(0)
    const [avgWithdrawal, setAvgWithdrawal] = useState(0)
    const [totalWithdrawals, setTotalWithdrawals] = useState(0)
    const [aprovadosMes, setAprovadosMes] = useState(0)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchData() {
            setLoading(true)

            const now = new Date()

            const [colabsRes, saidasRes, aprovadosRes] = await Promise.all([
                supabase.from('colaboradores').select('saldo_pipj').eq('status', 'Ativo').neq('cargo_atual', CARGO_FANTASMA),
                supabase.from('transacoes_pipj').select('valor, data').eq('tipo', 'SAIDA'),
                supabase
                    .from('solicitacoes_saque')
                    .select('valor')
                    .eq('status', 'APROVADO')
                    .gte('data_solicitacao', new Date(now.getFullYear(), now.getMonth(), 1).toISOString())
                    .lte('data_solicitacao', new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString()),
            ])

            const total = colabsRes.data?.reduce((s, c) => s + Number(c.saldo_pipj || 0), 0) || 0
            setTotalPipj(total)

            if (saidasRes.data && saidasRes.data.length > 0) {
                const monthMap = new Map<string, number>()
                saidasRes.data.forEach((s: any) => {
                    const d = new Date(s.data)
                    const key = `${d.getFullYear()}-${d.getMonth()}`
                    monthMap.set(key, (monthMap.get(key) || 0) + Number(s.valor || 0))
                })
                const months = monthMap.size || 1
                const totalSaida = saidasRes.data.reduce((s: number, t: any) => s + Number(t.valor || 0), 0)
                setAvgWithdrawal(totalSaida / months)
                setTotalWithdrawals(totalSaida)
            }

            const aprovado = aprovadosRes.data?.reduce((s: number, r: any) => s + Number(r.valor || 0), 0) || 0
            setAprovadosMes(aprovado)

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => <Card key={i} className="h-36 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-3xl border-none" />)}
        </div>
    )

    const disponivel = Math.max(0, LIMITE_MENSAL - aprovadosMes)
    const percentUsado = Math.min(100, (aprovadosMes / LIMITE_MENSAL) * 100)
    const limiteCritico = percentUsado >= 80

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total PIPJ */}
            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none text-slate-900 dark:text-white rounded-3xl shadow-lg relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8">
                    <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-emerald-500/10 to-transparent pointer-events-none" />
                    <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-3 rounded-2xl absolute right-8 top-8 group-hover:scale-110 transition-transform duration-300 backdrop-blur-md">
                        <Wallet className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Total de PIPJ em Circulação</p>
                    <span className="text-3xl font-display font-black text-slate-900 dark:text-white tracking-tight">
                        R$ {totalPipj.toFixed(2).replace('.', ',')}
                    </span>
                </CardContent>
            </Card>

            {/* Limite Mensal */}
            <Card className={`bg-white dark:bg-[#0f172a] border text-slate-900 dark:text-white rounded-3xl shadow-lg relative overflow-hidden group hover:shadow-xl transition-all duration-300 ${limiteCritico ? 'border-rose-200 dark:border-rose-500/30' : 'border-slate-200 dark:border-none'}`}>
                <CardContent className="p-8">
                    <div className={`absolute right-0 top-0 h-full w-32 bg-gradient-to-l ${limiteCritico ? 'from-rose-500/10' : 'from-violet-500/10'} to-transparent pointer-events-none`} />
                    <div className={`bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-3 rounded-2xl absolute right-8 top-8 group-hover:scale-110 transition-transform duration-300 backdrop-blur-md`}>
                        <ShieldAlert className={`h-6 w-6 ${limiteCritico ? 'text-rose-500' : 'text-violet-600 dark:text-violet-400'}`} />
                    </div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Limite Mensal de Aprovações</p>
                    <div className="space-y-2">
                        <div className="flex items-baseline gap-1.5">
                            <span className={`text-3xl font-display font-black tracking-tight ${limiteCritico ? 'text-rose-500' : 'text-slate-900 dark:text-white'}`}>
                                R$ {disponivel.toFixed(2).replace('.', ',')}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">disponível</span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-white/10 rounded-full h-1.5 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${limiteCritico ? 'bg-rose-500' : percentUsado >= 50 ? 'bg-amber-500' : 'bg-violet-500'}`}
                                style={{ width: `${percentUsado}%` }}
                            />
                        </div>
                        <p className="text-[10px] text-slate-400">
                            R$ {aprovadosMes.toFixed(2).replace('.', ',')} aprovado de R$ {LIMITE_MENSAL.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} este mês
                        </p>
                    </div>
                </CardContent>
            </Card>

            {/* Avg Monthly Withdrawal */}
            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none text-slate-900 dark:text-white rounded-3xl shadow-lg relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8">
                    <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-rose-500/10 to-transparent pointer-events-none" />
                    <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-3 rounded-2xl absolute right-8 top-8 group-hover:scale-110 transition-transform duration-300 backdrop-blur-md">
                        <TrendingDown className="h-6 w-6 text-rose-600 dark:text-rose-400" />
                    </div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Média de Retirada Mensal</p>
                    <span className="text-3xl font-display font-black text-slate-900 dark:text-white tracking-tight">
                        R$ {avgWithdrawal.toFixed(2).replace('.', ',')}
                    </span>
                </CardContent>
            </Card>

            {/* Total Withdrawals */}
            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none text-slate-900 dark:text-white rounded-3xl shadow-lg relative overflow-hidden group hover:shadow-xl transition-all duration-300">
                <CardContent className="p-8">
                    <div className="absolute right-0 top-0 h-full w-32 bg-gradient-to-l from-amber-500/10 to-transparent pointer-events-none" />
                    <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-3 rounded-2xl absolute right-8 top-8 group-hover:scale-110 transition-transform duration-300 backdrop-blur-md">
                        <ArrowDownCircle className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                    </div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Total Retirado (Geral)</p>
                    <span className="text-3xl font-display font-black text-slate-900 dark:text-white tracking-tight">
                        R$ {totalWithdrawals.toFixed(2).replace('.', ',')}
                    </span>
                </CardContent>
            </Card>
        </div>
    )
}
