"use client"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"

const COLORS = {
    comunicacao: "#8B5CF6",
    organizacao: "#06B6D4",
    proatividade: "#F59E0B",
    qualidade_entregas: "#10B981",
    nps_geral: "#EC4899",
}

export function NPSChart() {
    const { colaboradorId } = useColaborador()
    const [data, setData] = useState<any[]>([])

    useEffect(() => {
        async function fetch() {
            const { data: nps } = await supabase
                .from('avaliacoes_nps')
                .select('mes, ano, comunicacao, organizacao, proatividade, qualidade_entregas, nps_geral')
                .eq('colaborador_id', colaboradorId)
                .order('ano', { ascending: true })
                .order('mes', { ascending: true })

            if (nps) {
                const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
                setData(nps.map(n => ({
                    name: `${months[n.mes - 1]}/${n.ano}`,
                    Comunicação: Number(n.comunicacao),
                    Organização: Number(n.organizacao),
                    Proatividade: Number(n.proatividade),
                    Qualidade: Number(n.qualidade_entregas),
                    'Média Geral': Number(n.nps_geral),
                })))
            }
        }
        fetch()
    }, [colaboradorId])

    return (
        <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
            <CardHeader>
                <CardTitle className="font-display">Evolução das Competências</CardTitle>
                <CardDescription>Acompanhamento mensal detalhado por competência</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[340px] w-full">
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
                            <Line type="monotone" dataKey="Comunicação" stroke={COLORS.comunicacao} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.comunicacao }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="Organização" stroke={COLORS.organizacao} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.organizacao }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="Proatividade" stroke={COLORS.proatividade} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.proatividade }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="Qualidade" stroke={COLORS.qualidade_entregas} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.qualidade_entregas }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="Média Geral" stroke={COLORS.nps_geral} strokeWidth={3} strokeDasharray="6 3" dot={{ r: 5, fill: COLORS.nps_geral }} activeDot={{ r: 7 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
