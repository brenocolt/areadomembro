"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"

const BAR_COLOR_Cyan = '#06b6d4'
const BAR_COLOR_Emerald = '#10b981'
const BAR_COLOR_Rose = '#f43f5e'

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-white/10 shadow-lg text-sm">
                <p className="font-bold text-slate-800 dark:text-white mb-1">{label || payload[0].payload.name}</p>
                <p className="text-cyan-600 dark:text-cyan-400">
                    <span className="font-semibold">{payload[0].value.toLocaleString('pt-BR')}</span> milhas
                </p>
            </div>
        )
    }
    return null
}

export function MilesDashboard() {
    const [loading, setLoading] = useState(true)
    const [rankingData, setRankingData] = useState<any[]>([])
    const [aquisicaoData, setAquisicaoData] = useState<any[]>([])
    const [retiradaData, setRetiradaData] = useState<any[]>([])

    useEffect(() => {
        async function fetchData() {
            setLoading(true)

            // 1: Ranking of people with most miles
            const { data: saldoData } = await supabase
                .from('milhas_saldo')
                .select('saldo_disponivel, colaboradores(nome)')
                .order('saldo_disponivel', { ascending: false })
                .limit(10)

            if (saldoData) {
                setRankingData(
                    saldoData.map((d: any) => ({
                        name: d.colaboradores?.nome ? d.colaboradores.nome.split(' ').slice(0, 2).join(' ') : 'Desconhecido',
                        value: d.saldo_disponivel || 0
                    }))
                )
            }

            // 2: Principal motivo de aquisição (`solicitacoes_saque` -> 'adicao_milhas' aprovada)
            const { data: adicoes } = await supabase
                .from('solicitacoes_saque')
                .select('atividade, quantidade')
                .eq('tipo', 'adicao_milhas')
                .eq('status', 'APROVADO')

            if (adicoes) {
                const map: Record<string, number> = {}
                adicoes.forEach((a: any) => {
                    if (a.atividade && a.quantidade) {
                        const shortAtividade = a.atividade.length > 25 ? a.atividade.substring(0, 25) + '...' : a.atividade
                        map[shortAtividade] = (map[shortAtividade] || 0) + a.quantidade
                    }
                })
                setAquisicaoData(
                    Object.entries(map)
                        .map(([name, value]) => ({ name, value }))
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 5) // top 5
                )
            }

            // 3: Principal motivo de retirada de milhas (`milhas_trocas` aprovada ou concluida)
            const { data: retiradas } = await supabase
                .from('milhas_trocas')
                .select('item_nome, milhas_gastas')
                .in('status', ['APROVADA', 'CONCLUIDA'])

            if (retiradas) {
                const map: Record<string, number> = {}
                retiradas.forEach((r: any) => {
                    if (r.item_nome && r.milhas_gastas) {
                        const shortItem = r.item_nome.length > 25 ? r.item_nome.substring(0, 25) + '...' : r.item_nome
                        map[shortItem] = (map[shortItem] || 0) + r.milhas_gastas
                    }
                })
                setRetiradaData(
                    Object.entries(map)
                        .map(([name, value]) => ({ name, value }))
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 5) // top 5
                )
            }

            setLoading(false)
        }

        fetchData()
    }, [])

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
                <div className="col-span-1 md:col-span-2 h-[350px] bg-slate-100 dark:bg-white/5 rounded-3xl" />
                <div className="h-[350px] bg-slate-100 dark:bg-white/5 rounded-3xl" />
                <div className="h-[350px] bg-slate-100 dark:bg-white/5 rounded-3xl" />
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="col-span-1 md:col-span-2 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-white/5">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white text-center">
                        Ranking dos Colaboradores com Mais Milhas
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
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} width={50} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value" fill={BAR_COLOR_Cyan} radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-white/5">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white text-center">
                        Principais Motivos de Aquisição de Milhas
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={aquisicaoData} margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.2} />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} />
                            <YAxis
                                dataKey="name"
                                type="category"
                                axisLine={false}
                                tickLine={false}
                                width={120}
                                tick={{ fontSize: 9, fontWeight: 600, fill: '#64748b' }}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value" fill={BAR_COLOR_Emerald} radius={[0, 4, 4, 0]} maxBarSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-white/5">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white text-center">
                        Principais Motivos de Retirada de Milhas
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={retiradaData} margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#334155" opacity={0.2} />
                            <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} />
                            <YAxis
                                dataKey="name"
                                type="category"
                                axisLine={false}
                                tickLine={false}
                                width={120}
                                tick={{ fontSize: 9, fontWeight: 600, fill: '#64748b' }}
                            />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value" fill={BAR_COLOR_Rose} radius={[0, 4, 4, 0]} maxBarSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    )
}
