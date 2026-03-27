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
}

export function NPSGerenteChart() {
    const { colaboradorId } = useColaborador()
    const [data, setData] = useState<any[]>([])

    useEffect(() => {
        async function fetch() {
            const { data: nps } = await supabase
                .from('avaliacoes_nps')
                .select('mes, ano, comunicacao, suporte, relacionamento, lideranca')
                .eq('colaborador_id', colaboradorId)
                .order('ano', { ascending: true })
                .order('mes', { ascending: true })

            if (nps) {
                const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
                setData(nps.map(n => ({
                    name: `${months[n.mes - 1]}/${n.ano}`,
                    Comunicação: Number(n.comunicacao),
                    Suporte: Number(n.suporte),
                    Relacionamento: Number(n.relacionamento),
                    Liderança: Number(n.lideranca),
                })))
            }
        }
        fetch()
    }, [colaboradorId])

    return (
        <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
            <CardHeader>
                <CardTitle className="font-display">Evolução das Métricas</CardTitle>
                <CardDescription>Acompanhamento mensal das avaliações de gerência</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="h-[340px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                            <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                            <YAxis domain={[0, 10]} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                            <Tooltip
                                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px' }}
                                cursor={{ stroke: '#8B5CF6', strokeWidth: 2 }}
                            />
                            <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '12px' }} />
                            <Line type="monotone" dataKey="Comunicação" stroke={COLORS.comunicacao} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.comunicacao }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="Suporte" stroke={COLORS.suporte} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.suporte }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="Relacionamento" stroke={COLORS.relacionamento} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.relacionamento }} activeDot={{ r: 6 }} />
                            <Line type="monotone" dataKey="Liderança" stroke={COLORS.lideranca} strokeWidth={2.5} dot={{ r: 4, fill: COLORS.lideranca }} activeDot={{ r: 6 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </CardContent>
        </Card>
    )
}
