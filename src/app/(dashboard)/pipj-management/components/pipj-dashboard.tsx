"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { CARGO_FANTASMA } from "@/lib/cargos"
import { Trophy } from "lucide-react"
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts"

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

const MESES_ABREV = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

export function PipjDashboard() {
    const [loading, setLoading] = useState(true)
    const [rankingData, setRankingData] = useState<any[]>([])
    const [launchHistory, setLaunchHistory] = useState<any[]>([])

    useEffect(() => {
        async function fetchData() {
            setLoading(true)

            // 1: Ranking of people with most PIPJ (lista completa, sem limite —
            // o card mostra os 10 primeiros com scroll pra ver o resto).
            const { data: colabs } = await supabase
                .from('colaboradores')
                .select('nome, saldo_pipj, cargo_atual')
                .eq('status', 'Ativo')
                .neq('cargo_atual', CARGO_FANTASMA)
                .order('saldo_pipj', { ascending: false })

            if (colabs) {
                setRankingData(
                    colabs.map((c: any) => ({
                        name: c.nome ? c.nome.split(' ').slice(0, 2).join(' ') : 'Desconhecido',
                        cargo: c.cargo_atual,
                        value: Number(c.saldo_pipj) || 0
                    }))
                )
            }

            // 2: Monthly launch history — calculado ao vivo a partir de
            // transacoes_pipj, agrupado pelo "periodo" (mês de referência
            // escolhido no lançamento, não a data em que a transação foi
            // gravada). ENTRADA soma, SAIDA (reversão) subtrai, então um
            // lançamento revertido some do mês. Isso usa exatamente a mesma
            // fonte e regra do gráfico "Valores Lançados de PIPJ por
            // Colaborador", garantindo que os dois batam. Saques não têm
            // "periodo" preenchido, então não entram aqui.
            const { data: transacoes } = await supabase
                .from('transacoes_pipj')
                .select('periodo, tipo, valor, colaboradores(status, cargo_atual)')
                .not('periodo', 'is', null)

            const somaPorPeriodo = new Map<string, number>()
            for (const t of (transacoes || []) as any[]) {
                const colab = t.colaboradores
                if (!colab || colab.status === 'Desligado' || colab.cargo_atual === CARGO_FANTASMA) continue
                const sinal = t.tipo === 'ENTRADA' ? 1 : -1
                somaPorPeriodo.set(t.periodo, (somaPorPeriodo.get(t.periodo) || 0) + sinal * Number(t.valor || 0))
            }

            const periodosOrdenados = Array.from(somaPorPeriodo.keys()).sort((a, b) => {
                const [ma, ya] = a.split('/').map(Number)
                const [mb, yb] = b.split('/').map(Number)
                return ya !== yb ? ya - yb : ma - mb
            })

            setLaunchHistory(
                periodosOrdenados.slice(-12).map(periodo => {
                    const [m, y] = periodo.split('/').map(Number)
                    return {
                        name: `${MESES_ABREV[m - 1]}/${String(y).slice(2)}`,
                        value: Math.round((somaPorPeriodo.get(periodo) || 0) * 100) / 100,
                    }
                })
            )

            setLoading(false)
        }

        fetchData()
        window.addEventListener('refreshPipjData', fetchData)
        return () => window.removeEventListener('refreshPipjData', fetchData)
    }, [])

    if (loading) {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
                <div className="col-span-1 md:col-span-2 h-[420px] bg-slate-100 dark:bg-white/5 rounded-3xl" />
                <div className="h-[350px] bg-slate-100 dark:bg-white/5 rounded-3xl" />
            </div>
        )
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Ranking */}
            <Card className="col-span-1 md:col-span-2 bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-white/5">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center justify-center gap-2">
                        <Trophy className="h-4 w-4 text-amber-500" />
                        Ranking dos Colaboradores com Maior Saldo PIPJ
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {rankingData.length === 0 ? (
                        <div className="flex items-center justify-center h-40 text-slate-400 dark:text-slate-500 text-sm">
                            Nenhum colaborador encontrado.
                        </div>
                    ) : (
                        <div className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
                            {rankingData.map((r, i) => (
                                <div key={i} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0
                                            ${i === 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                                                i === 1 ? 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300' :
                                                    i === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                                                        'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'}`}>
                                            {i + 1}
                                        </div>
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">{r.name}</p>
                                            <p className="text-xs text-slate-400">{r.cargo}</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                        R$ {r.value.toFixed(2).replace('.', ',')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
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
