"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"

const COLORS = {
    comunicacao: "#8B5CF6",
    suporte: "#06B6D4",
    relacionamento: "#F59E0B",
    lideranca: "#10B981",
    resolutividade: "#EC4899",
}

const FIELDS = ['comunicacao', 'suporte', 'relacionamento', 'lideranca', 'resolutividade'] as const

function avgField(rows: any[], field: string): number | null {
    const vals = rows
        .map(r => r[field])
        .filter(v => v !== null && v !== undefined && !isNaN(Number(v)))
        .map(Number)
    if (vals.length === 0) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
}

export function NPSGerenteChart() {
    const { colaboradorId } = useColaborador()
    const [data, setData] = useState<any[]>([])

    useEffect(() => {
        if (!colaboradorId) {
            setData([])
            return
        }
        async function fetchData() {
            const { data: nps } = await supabase
                .from('avaliacoes_nps')
                .select('mes, ano, comunicacao, suporte, relacionamento, lideranca, resolutividade, tipo_avaliacao')
                .eq('colaborador_id', colaboradorId)
                .eq('tipo_avaliacao', 'gerente')
                .order('ano', { ascending: true })
                .order('mes', { ascending: true })

            if (!nps) { setData([]); return }

            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

            // Agrupar por (ano, mes) e calcular a média de cada competência
            const groups = new Map<string, any[]>()
            for (const row of nps) {
                const key = `${row.ano}-${String(row.mes).padStart(2, '0')}`
                if (!groups.has(key)) groups.set(key, [])
                groups.get(key)!.push(row)
            }

            const chartData = Array.from(groups.entries()).map(([key, rows]) => {
                const [ano, mes] = key.split('-').map(Number)
                const point: any = { name: `${months[mes - 1]}/${ano}` }
                for (const f of FIELDS) {
                    const label = {
                        comunicacao: 'Comunicação',
                        suporte: 'Suporte',
                        relacionamento: 'Relacionamento',
                        lideranca: 'Liderança',
                        resolutividade: 'Resolutividade',
                    }[f]!
                    const v = avgField(rows, f)
                    point[label] = v !== null ? Number(v.toFixed(2)) : null
                }
                return point
            })

            setData(chartData)
        }
        fetchData()
    }, [colaboradorId])

    return (
        <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
            <CardHeader>
                <CardTitle className="font-display">Evolução das Métricas</CardTitle>
                <CardDescription>Acompanhamento mensal das avaliações de gerência (média de todas as avaliações)</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[340px] w-full">
                    {data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center px-4">
                            <p className="text-sm font-semibold">Sem dados de NPS para exibir.</p>
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis domain={[0, 5]} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px' }}
                                    cursor={{ stroke: '#8B5CF6', strokeWidth: 2 }}
                                />
                                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '12px' }} />
                                <Line type="monotone" dataKey="Comunicação" stroke={COLORS.comunicacao} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.comunicacao }} activeDot={{ r: 6 }} connectNulls />
                                <Line type="monotone" dataKey="Suporte" stroke={COLORS.suporte} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.suporte }} activeDot={{ r: 6 }} connectNulls />
                                <Line type="monotone" dataKey="Relacionamento" stroke={COLORS.relacionamento} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.relacionamento }} activeDot={{ r: 6 }} connectNulls />
                                <Line type="monotone" dataKey="Liderança" stroke={COLORS.lideranca} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.lideranca }} activeDot={{ r: 6 }} connectNulls />
                                <Line type="monotone" dataKey="Resolutividade" stroke={COLORS.resolutividade} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.resolutividade }} activeDot={{ r: 6 }} connectNulls />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
