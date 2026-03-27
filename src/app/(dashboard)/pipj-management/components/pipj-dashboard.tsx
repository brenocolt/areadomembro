"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"

const BAR_COLOR_Emerald = '#10b981'
const BAR_COLOR_Violet = '#8b5cf6'

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-white/10 shadow-lg text-sm">
                <p className="font-bold text-slate-800 dark:text-white mb-1">{label || payload[0].payload.name}</p>
                <p className="text-emerald-600 dark:text-emerald-400">
                    <span className="font-semibold">R$ {Number(payload[0].value).toFixed(2).replace('.', ',')}</span>
                </p>
            </div>
        )
    }
    return null
}

export function PipjDashboard() {
    const [loading, setLoading] = useState(true)
    const [rankingData, setRankingData] = useState<any[]>([])
    const [launchHistory, setLaunchHistory] = useState<any[]>([])

    useEffect(() => {
        async function fetchData() {
            setLoading(true)

            // 1: Ranking of people with most PIPJ
            const { data: colabs } = await supabase
                .from('colaboradores')
                .select('nome, saldo_pipj')
                .order('saldo_pipj', { ascending: false })
                .limit(10)

            if (colabs) {
                setRankingData(
                    colabs.map((c: any) => ({
                        name: c.nome ? c.nome.split(' ').slice(0, 2).join(' ') : 'Desconhecido',
                        value: Number(c.saldo_pipj) || 0
                    }))
                )
            }

            // 2: Monthly launch history
            const { data: lancamentos } = await supabase
                .from('lancamentos_pipj')
                .select('mes, ano, total_lancado, total_colaboradores')
                .order('ano', { ascending: true })
                .order('mes', { ascending: true })
                .limit(12)

            if (lancamentos) {
                const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
                setLaunchHistory(
                    lancamentos.map((l: any) => ({
                        name: `${months[l.mes - 1]}/${String(l.ano).slice(2)}`,
                        value: Number(l.total_lancado) || 0
                    }))
                )
            }

            setLoading(false)
        }

        fetchData()
        window.addEventListener('refreshPipjData', fetchData)
        return () => window.removeEventListener('refreshPipjData', fetchData)
    }, [])

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
                <div className="col-span-1 md:col-span-2 h-[350px] bg-slate-100 dark:bg-white/5 rounded-3xl" />
                <div className="h-[350px] bg-slate-100 dark:bg-white/5 rounded-3xl" />
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ranking */}
            <Card className="col-span-1 md:col-span-2 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-white/5">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white text-center">
                        Ranking dos Colaboradores com Maior Saldo PIPJ
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={rankingData} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                                angle={-25}
                                textAnchor="end"
                            />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} width={60} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value" fill={BAR_COLOR_Emerald} radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            {/* Monthly launch history */}
            <Card className="col-span-1 md:col-span-2 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-white/5">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white text-center">
                        Histórico de Lançamentos PIPJ por Mês
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 h-[300px]">
                    {launchHistory.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={launchHistory} margin={{ top: 10, right: 30, left: 10, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                                />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} width={60} />
                                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                                <Bar dataKey="value" fill={BAR_COLOR_Violet} radius={[4, 4, 0, 0]} maxBarSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500 text-sm">
                            Nenhum lançamento PIPJ registrado ainda.
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
