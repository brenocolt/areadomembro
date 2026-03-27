"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"

export function DetailedPerformance() {
    const { colaboradorId } = useColaborador()
    const [data, setData] = useState<any[]>([])

    useEffect(() => {
        async function fetch() {
            const { data: nps } = await supabase
                .from('avaliacoes_nps')
                .select('mes, ano, comunicacao, organizacao, proatividade, qualidade_entregas, nps_geral')
                .eq('colaborador_id', colaboradorId)
                .order('ano', { ascending: false })
                .order('mes', { ascending: false })
                .limit(6)

            if (nps) {
                const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
                setData(nps.reverse().map(n => ({ ...n, mesNome: months[n.mes - 1] })))
            }
        }
        fetch()
    }, [colaboradorId])

    return (
        <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
            <CardHeader>
                <CardTitle className="font-display">Detalhamento por Competência</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                        <TableRow className="hover:bg-transparent border-b-slate-100 dark:border-b-slate-800">
                            <TableHead className="text-[10px] uppercase font-bold h-9 pl-6">Mês</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Comunicação</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Organização</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Proatividade</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Qualidade</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Média Final</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.map((row, i) => (
                            <TableRow key={i} className="border-b-slate-100 dark:border-b-slate-800 hover:bg-slate-50/50">
                                <TableCell className="font-bold pl-6">{row.mesNome}</TableCell>
                                <TableCell className="text-center">{Number(row.comunicacao).toFixed(1)}</TableCell>
                                <TableCell className="text-center">{Number(row.organizacao).toFixed(1)}</TableCell>
                                <TableCell className="text-center">{Number(row.proatividade).toFixed(1)}</TableCell>
                                <TableCell className="text-center">{Number(row.qualidade_entregas).toFixed(1)}</TableCell>
                                <TableCell className="text-center">
                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{Number(row.nps_geral).toFixed(1)}</Badge>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
