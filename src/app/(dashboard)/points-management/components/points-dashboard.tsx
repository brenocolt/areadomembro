"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid
} from "recharts"

const PIE_COLORS = ['#10b981', '#f59e0b', '#ef4444'] // Emerald, Amber, Rose
const BAR_COLOR = '#00b4d8'

const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        return (
            <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-white/10 shadow-lg text-sm">
                <p className="font-bold text-slate-800 dark:text-white mb-1">{label || payload[0].name}</p>
                <p className="text-sky-600 dark:text-sky-400">
                    <span className="font-semibold">{payload[0].value}</span> pontos/colaboradores
                </p>
            </div>
        )
    }
    return null
}

export function PointsDashboard() {
    const [loading, setLoading] = useState(true)
    const [pieData, setPieData] = useState<any[]>([])
    const [nucleoData, setNucleoData] = useState<any[]>([])
    const [ocorrenciasData, setOcorrenciasData] = useState<any[]>([])
    const [remocoesData, setRemocoesData] = useState<any[]>([])

    useEffect(() => {
        async function fetchData() {
            setLoading(true)

            // 1 & 2: Colaboradores stats
            const { data: cols } = await supabase.from('colaboradores').select('nucleo_atual, pontos_negativos')

            if (cols) {
                // Pie data
                let zero = 0, oneToThree = 0, fourPlus = 0

                // Nucleo data
                const nucleoMap: Record<string, number> = {}

                cols.forEach(c => {
                    const pts = c.pontos_negativos || 0
                    if (pts === 0) zero++
                    else if (pts <= 3) oneToThree++
                    else fourPlus++

                    if (c.nucleo_atual) {
                        nucleoMap[c.nucleo_atual] = (nucleoMap[c.nucleo_atual] || 0) + pts
                    }
                })

                setPieData([
                    { name: '0 Pontos', value: zero },
                    { name: '1 a 3 Pontos', value: oneToThree },
                    { name: '4+ Pontos', value: fourPlus }
                ])

                setNucleoData(
                    Object.entries(nucleoMap)
                        .map(([name, value]) => ({ name, value }))
                        .sort((a, b) => b.value - a.value)
                )
            }

            // 3: Ocorrências stats
            const { data: ocs } = await supabase.from('ocorrencias').select('motivo, pontuacao')
            if (ocs) {
                const map: Record<string, number> = {}
                ocs.forEach(o => {
                    if (o.motivo && o.pontuacao) {
                        // Shorten long descriptions
                        const shortMotivo = o.motivo.length > 30 ? o.motivo.substring(0, 30) + '...' : o.motivo
                        map[shortMotivo] = (map[shortMotivo] || 0) + o.pontuacao
                    }
                })
                setOcorrenciasData(
                    Object.entries(map)
                        .map(([name, value]) => ({ name, value }))
                        .sort((a, b) => b.value - a.value)
                        .slice(0, 5) // top 5
                )
            }

            // 4: Remoções stats (status = 'APROVADA')
            const { data: rems } = await supabase.from('solicitacoes_remocao').select('motivo, pontos_solicitados').eq('status', 'APROVADA')
            if (rems) {
                const map: Record<string, number> = {}
                rems.forEach(r => {
                    if (r.motivo && r.pontos_solicitados) {
                        // Limiting length to match the visual better
                        const match = r.motivo.split('-')[0].trim()
                        map[match] = (map[match] || 0) + r.pontos_solicitados
                    }
                })
                setRemocoesData(
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
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-[350px] bg-slate-100 dark:bg-white/5 rounded-3xl" />
                ))}
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-white/5">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white text-center">
                        Distribuição de Pontos
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={70}
                                outerRadius={100}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {pieData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                        </PieChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-white/5">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white text-center">
                        Núcleo com Mais Pontos
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 pb-2 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={nucleoData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                                angle={-25}
                                textAnchor="end"
                            />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} />
                            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                            <Bar dataKey="value" fill={BAR_COLOR} radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-white/5">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white text-center">
                        Motivos que Mais Recebem Pontos
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={ocorrenciasData} margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
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
                            <Bar dataKey="value" fill="#f43f5e" radius={[0, 4, 4, 0]} maxBarSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>

            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-white/5">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white text-center">
                        Motivos que Mais Retiram Pontos
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart layout="vertical" data={remocoesData} margin={{ top: 0, right: 30, left: 10, bottom: 0 }}>
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
                            <Bar dataKey="value" fill="#10b981" radius={[0, 4, 4, 0]} maxBarSize={30} />
                        </BarChart>
                    </ResponsiveContainer>
                </CardContent>
            </Card>
        </div>
    )
}
