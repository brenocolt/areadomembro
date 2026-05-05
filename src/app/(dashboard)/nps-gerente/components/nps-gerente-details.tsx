"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"

export function NPSGerenteDetails() {
    const { colaboradorId } = useColaborador()
    const [data, setData] = useState<any[]>([])

    useEffect(() => {
        async function fetch() {
            const { data: nps } = await supabase
                .from('avaliacoes_nps')
                .select('mes, ano, comunicacao, suporte, relacionamento, lideranca, resolutividade, nps_geral, tipo_avaliacao')
                .eq('colaborador_id', colaboradorId)
                .eq('tipo_avaliacao', 'gerente')
                .order('ano', { ascending: false })
                .order('mes', { ascending: false })
                .limit(6)

            if (nps) {
                const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
                setData(nps.reverse().map(n => ({ ...n, mesNome: `${months[n.mes - 1]} ${n.ano}` })))
            }
        }
        fetch()
    }, [colaboradorId])

    const getColor = (val: number) => {
        if (val >= 8) return 'bg-green-100 text-green-700 hover:bg-green-100 dark:bg-green-500/10 dark:text-green-400'
        if (val >= 6) return 'bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400'
        return 'bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-500/10 dark:text-red-400'
    }

    return (
        <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
            <CardHeader>
                <CardTitle className="font-display">Detalhamento por Competência</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                        <TableRow className="hover:bg-transparent border-b-slate-100 dark:border-b-slate-800">
                            <TableHead className="text-[10px] uppercase font-bold h-9 pl-6">Período</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Comunicação</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Suporte</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Relacionamento</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Liderança</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Resolutividade</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Média</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((row, i) => {
                            const avg = ((Number(row.comunicacao) + Number(row.suporte) + Number(row.relacionamento) + Number(row.lideranca) + Number(row.resolutividade)) / 5)
                            return (
                                <TableRow key={i} className="border-b-slate-100 dark:border-b-slate-800 hover:bg-slate-50/50">
                                    <TableCell className="font-bold pl-6 text-sm">{row.mesNome}</TableCell>
                                    <TableCell className="text-center">{Number(row.comunicacao).toFixed(1)}</TableCell>
                                    <TableCell className="text-center">{Number(row.suporte).toFixed(1)}</TableCell>
                                    <TableCell className="text-center">{Number(row.relacionamento).toFixed(1)}</TableCell>
                                    <TableCell className="text-center">{Number(row.lideranca).toFixed(1)}</TableCell>
                                    <TableCell className="text-center">{Number(row.resolutividade).toFixed(1)}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge className={getColor(avg)}>{avg.toFixed(1)}</Badge>
                                    </TableCell>
                                </TableRow>
                            )
                        })}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
