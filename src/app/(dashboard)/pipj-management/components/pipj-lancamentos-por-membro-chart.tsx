"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { CARGO_FANTASMA } from "@/lib/cargos"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
import { BarChart3, CalendarDays } from "lucide-react"

const MESES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

function getYearOptions() {
    const current = new Date().getFullYear()
    return [current - 1, current, current + 1]
}

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

export function PipjLancamentosPorMembroChart() {
    const now = new Date()
    const [mes, setMes] = useState(now.getMonth() + 1)
    const [ano, setAno] = useState(now.getFullYear())
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<{ name: string, value: number }[]>([])
    const [total, setTotal] = useState(0)

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            const periodo = `${String(mes).padStart(2, '0')}/${ano}`

            // Só transações geradas por lançamentos (têm "periodo" preenchido)
            // entram aqui — saques não têm periodo, então não entram na soma.
            // ENTRADA soma, SAIDA (reversão de lançamento) subtrai, então um
            // lançamento revertido some do gráfico daquele mês.
            const { data: transacoes } = await supabase
                .from('transacoes_pipj')
                .select('valor, tipo, colaborador_id, colaboradores(nome, status, cargo_atual)')
                .eq('periodo', periodo)

            const somaPorColab = new Map<string, { nome: string, valor: number }>()
            for (const t of (transacoes || []) as any[]) {
                const colab = t.colaboradores
                if (!colab || colab.status === 'Desligado' || colab.cargo_atual === CARGO_FANTASMA) continue
                const sinal = t.tipo === 'ENTRADA' ? 1 : -1
                const atual = somaPorColab.get(t.colaborador_id) || { nome: colab.nome || 'Desconhecido', valor: 0 }
                atual.valor += sinal * Number(t.valor || 0)
                somaPorColab.set(t.colaborador_id, atual)
            }

            const rows = Array.from(somaPorColab.values())
                .filter(r => r.valor !== 0)
                .sort((a, b) => b.valor - a.valor)
                .map(r => ({ name: r.nome.split(' ').slice(0, 2).join(' '), value: Math.round(r.valor * 100) / 100 }))

            setData(rows)
            setTotal(rows.reduce((s, r) => s + r.value, 0))
            setLoading(false)
        }

        fetchData()
        window.addEventListener('refreshPipjData', fetchData)
        return () => window.removeEventListener('refreshPipjData', fetchData)
    }, [mes, ano])

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <BarChart3 className="h-4 w-4 text-slate-500" />
                        Valores Lançados de PIPJ por Colaborador
                    </CardTitle>
                    <div className="flex items-center gap-2">
                        <CalendarDays className="h-4 w-4 text-slate-400 shrink-0" />
                        <Select value={String(mes)} onValueChange={v => setMes(Number(v))}>
                            <SelectTrigger className="h-8 w-32 text-xs bg-slate-50 dark:bg-slate-900 border-none rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {MESES.map((m, i) => (
                                    <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">{m}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <Select value={String(ano)} onValueChange={v => setAno(Number(v))}>
                            <SelectTrigger className="h-8 w-20 text-xs bg-slate-50 dark:bg-slate-900 border-none rounded-xl">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {getYearOptions().map(y => (
                                    <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                {!loading && (
                    <p className="text-xs text-slate-500 mt-1">
                        {data.length} colaborador(es) · Total: <span className="font-bold text-emerald-600 dark:text-emerald-400">R$ {total.toFixed(2).replace('.', ',')}</span>
                    </p>
                )}
            </CardHeader>
            <CardContent className="pt-6">
                {loading ? (
                    <div className="h-[320px] animate-pulse bg-slate-100 dark:bg-white/5 rounded-2xl" />
                ) : data.length === 0 ? (
                    <div className="flex items-center justify-center h-[320px] text-slate-400 dark:text-slate-500 text-sm">
                        Nenhum lançamento de PIPJ para {MESES[mes - 1]}/{ano}.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <div style={{ width: Math.max(data.length * 60, 600), height: 340 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data} margin={{ top: 10, right: 10, left: 10, bottom: 60 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#334155" opacity={0.2} />
                                    <XAxis
                                        dataKey="name"
                                        axisLine={false}
                                        tickLine={false}
                                        tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }}
                                        angle={-40}
                                        textAnchor="end"
                                        interval={0}
                                    />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} width={60} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: 'transparent' }} />
                                    <Bar dataKey="value" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={36} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
