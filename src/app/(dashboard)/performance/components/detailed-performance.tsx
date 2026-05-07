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
        if (!colaboradorId) {
            setData([])
            return
        }
        async function fetch() {
            const { data: nps } = await supabase
                .from('avaliacoes_nps')
                .select('mes, ano, comunicacao, dedicacao, confianca, pontualidade, organizacao, proatividade, qualidade_entregas, dominio_tecnico, nps_geral')
                .eq('colaborador_id', colaboradorId)
                .order('ano', { ascending: false })
                .order('mes', { ascending: false })

            if (!nps) {
                setData([])
                return
            }

            const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
            const fields = ['comunicacao','dedicacao','confianca','pontualidade','organizacao','proatividade','qualidade_entregas','dominio_tecnico','nps_geral'] as const

            // Agrupa por (ano, mes) e calcula a média de cada competência (ignora nulos).
            const groups = new Map<string, any[]>()
            for (const row of nps) {
                const key = `${row.ano}-${row.mes}`
                if (!groups.has(key)) groups.set(key, [])
                groups.get(key)!.push(row)
            }

            const avg = (rows: any[], field: string) => {
                const vals = rows.map(r => r[field]).filter(v => v !== null && v !== undefined && !isNaN(Number(v))).map(Number)
                if (vals.length === 0) return null
                return vals.reduce((a, b) => a + b, 0) / vals.length
            }

            const aggregated = Array.from(groups.entries()).map(([key, rows]) => {
                const [ano, mes] = key.split('-').map(Number)
                const result: any = { ano, mes, mesNome: months[mes - 1], avaliacoes: rows.length }
                for (const f of fields) result[f] = avg(rows, f)
                return result
            })

            // Mostra só os 6 meses mais recentes, em ordem cronológica
            aggregated.sort((a, b) => (a.ano - b.ano) || (a.mes - b.mes))
            const recentes = aggregated.slice(-6)
            setData(recentes)
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
                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Dedicação</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Confiança</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Pontualidade</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Organização</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Proatividade</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Qualidade</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Domínio Téc.</TableHead>
                            <TableHead className="text-[10px] uppercase font-bold h-9 text-center">Média Final</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {data.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={10} className="text-center text-sm text-slate-400 italic py-8">
                                    Sem avaliações registradas.
                                </TableCell>
                            </TableRow>
                        )}
                        {data.map((row, i) => {
                            const fmt = (v: number | null) => (v === null ? '—' : v.toFixed(1))
                            return (
                                <TableRow key={i} className="border-b-slate-100 dark:border-b-slate-800 hover:bg-slate-50/50">
                                    <TableCell className="font-bold pl-6">
                                        {row.mesNome}
                                        <span className="ml-2 text-[10px] font-medium text-slate-400">
                                            ({row.avaliacoes} aval.)
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center">{fmt(row.comunicacao)}</TableCell>
                                    <TableCell className="text-center">{fmt(row.dedicacao)}</TableCell>
                                    <TableCell className="text-center">{fmt(row.confianca)}</TableCell>
                                    <TableCell className="text-center">{fmt(row.pontualidade)}</TableCell>
                                    <TableCell className="text-center">{fmt(row.organizacao)}</TableCell>
                                    <TableCell className="text-center">{fmt(row.proatividade)}</TableCell>
                                    <TableCell className="text-center">{fmt(row.qualidade_entregas)}</TableCell>
                                    <TableCell className="text-center">{fmt(row.dominio_tecnico)}</TableCell>
                                    <TableCell className="text-center">
                                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">{fmt(row.nps_geral)}</Badge>
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
