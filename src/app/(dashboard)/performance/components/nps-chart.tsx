"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"

const COLORS = {
    comunicacao: "#8B5CF6",
    dedicacao: "#F43F5E",
    confianca: "#3B82F6",
    pontualidade: "#6366F1",
    organizacao: "#06B6D4",
    proatividade: "#F59E0B",
    qualidade_entregas: "#10B981",
    dominio_tecnico: "#D946EF",
    nps_geral: "#EC4899",
}

const FIELDS = [
    'comunicacao', 'dedicacao', 'confianca', 'pontualidade',
    'organizacao', 'proatividade', 'qualidade_entregas', 'dominio_tecnico', 'nps_geral'
] as const

function avgField(rows: any[], field: string): number | null {
    const vals = rows
        .map(r => r[field])
        .filter(v => v !== null && v !== undefined && !isNaN(Number(v)))
        .map(Number)
    if (vals.length === 0) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
}

export function NPSChart() {
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
                .select('mes, ano, comunicacao, dedicacao, confianca, pontualidade, organizacao, proatividade, qualidade_entregas, dominio_tecnico, nps_geral')
                .eq('colaborador_id', colaboradorId)
                .order('ano', { ascending: true })
                .order('mes', { ascending: true })

            if (!nps) { setData([]); return }

            const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

            // Agrupar por (ano, mes) e calcular a média de cada campo
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
                    const v = avgField(rows, f)
                    const label = {
                        comunicacao: 'Comunicação',
                        dedicacao: 'Dedicação',
                        confianca: 'Confiança',
                        pontualidade: 'Pontualidade',
                        organizacao: 'Organização',
                        proatividade: 'Proatividade',
                        qualidade_entregas: 'Qualidade',
                        dominio_tecnico: 'Domínio Técnico',
                        nps_geral: 'Média Geral',
                    }[f]!
                    point[label] = v !== null ? Number(v.toFixed(2)) : null
                }
                return point
            })

            // Já está em ordem cronológica (sort asc no fetch)
            setData(chartData)
        }
        fetchData()
    }, [colaboradorId])

    return (
        <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
            <CardHeader>
                <CardTitle className="font-display">Evolução das Competências</CardTitle>
                <CardDescription>Acompanhamento mensal detalhado por competência (média de todas as avaliações)</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[340px] w-full">
                    {data.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 text-center px-4">
                            <p className="text-sm font-semibold">Sem dados de NPS para exibir.</p>
                            <p className="text-xs mt-1 max-w-md">Você ainda não recebeu avaliações registradas em <code className="px-1 bg-slate-100 dark:bg-slate-800 rounded">avaliacoes_nps</code>. Assim que importações ou novas respostas chegarem ao seu nome, o gráfico será preenchido automaticamente.</p>
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
                                <Line type="monotone" dataKey="Dedicação" stroke={COLORS.dedicacao} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.dedicacao }} activeDot={{ r: 6 }} connectNulls />
                                <Line type="monotone" dataKey="Confiança" stroke={COLORS.confianca} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.confianca }} activeDot={{ r: 6 }} connectNulls />
                                <Line type="monotone" dataKey="Pontualidade" stroke={COLORS.pontualidade} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.pontualidade }} activeDot={{ r: 6 }} connectNulls />
                                <Line type="monotone" dataKey="Organização" stroke={COLORS.organizacao} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.organizacao }} activeDot={{ r: 6 }} connectNulls />
                                <Line type="monotone" dataKey="Proatividade" stroke={COLORS.proatividade} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.proatividade }} activeDot={{ r: 6 }} connectNulls />
                                <Line type="monotone" dataKey="Qualidade" stroke={COLORS.qualidade_entregas} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.qualidade_entregas }} activeDot={{ r: 6 }} connectNulls />
                                <Line type="monotone" dataKey="Domínio Técnico" stroke={COLORS.dominio_tecnico} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.dominio_tecnico }} activeDot={{ r: 6 }} connectNulls />
                                <Line type="monotone" dataKey="Média Geral" stroke={COLORS.nps_geral} strokeWidth={3} strokeDasharray="6 3" dot={{ r: 5, fill: COLORS.nps_geral }} activeDot={{ r: 7 }} connectNulls />
                            </LineChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
