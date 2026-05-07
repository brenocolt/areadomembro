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
        if (!colaboradorId) {
            setData([])
            return
        }
        async function fetch() {
            const { data: nps } = await supabase
                .from('avaliacoes_nps')
                .select('mes, ano, comunicacao, suporte, relacionamento, lideranca, resolutividade, nps_geral, tipo_avaliacao')
                .eq('colaborador_id', colaboradorId)
                .eq('tipo_avaliacao', 'gerente')
                .order('ano', { ascending: false })
                .order('mes', { ascending: false })

            if (!nps) {
                setData([])
                return
            }

            const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
            const fields = ['comunicacao','suporte','relacionamento','lideranca','resolutividade','nps_geral'] as const

            const groups = new Map<string, any[]>()
            for (const row of nps) {
                const key = `${row.ano}-${row.mes}`
                if (!groups.has(key)) groups.set(key, [])
                groups.get(key)!.push(row)
            }

            const avgField = (rows: any[], field: string) => {
                const vals = rows.map(r => r[field]).filter(v => v !== null && v !== undefined && !isNaN(Number(v))).map(Number)
                if (vals.length === 0) return null
                return vals.reduce((a, b) => a + b, 0) / vals.length
            }

            const aggregated = Array.from(groups.entries()).map(([key, rows]) => {
                const [ano, mes] = key.split('-').map(Number)
                const result: any = { ano, mes, mesNome: `${months[mes - 1]} ${ano}`, avaliacoes: rows.length }
                for (const f of fields) result[f] = avgField(rows, f)
                return result
            })

            aggregated.sort((a, b) => (a.ano - b.ano) || (a.mes - b.mes))
            setData(aggregated.slice(-6))
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
                        {data.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={7} className="text-center text-sm text-slate-400 italic py-8">
                                    Sem avaliações registradas.
                                </TableCell>
                            </TableRow>
                        )}
                        {data.map((row, i) => {
                            const fmt = (v: number | null) => (v === null ? '—' : v.toFixed(1))
                            const fields = [row.comunicacao, row.suporte, row.relacionamento, row.lideranca, row.resolutividade].filter((v): v is number => v !== null)
                            const avg = fields.length === 0 ? null : fields.reduce((a, b) => a + b, 0) / fields.length
                            return (
                                <TableRow key={i} className="border-b-slate-100 dark:border-b-slate-800 hover:bg-slate-50/50">
                                    <TableCell className="font-bold pl-6 text-sm">
                                        {row.mesNome}
                                        <span className="ml-2 text-[10px] font-medium text-slate-400">
                                            ({row.avaliacoes} aval.)
                                        </span>
                                    </TableCell>
                                    <TableCell className="text-center">{fmt(row.comunicacao)}</TableCell>
                                    <TableCell className="text-center">{fmt(row.suporte)}</TableCell>
                                    <TableCell className="text-center">{fmt(row.relacionamento)}</TableCell>
                                    <TableCell className="text-center">{fmt(row.lideranca)}</TableCell>
                                    <TableCell className="text-center">{fmt(row.resolutividade)}</TableCell>
                                    <TableCell className="text-center">
                                        {avg === null ? <span className="text-slate-400">—</span> : <Badge className={getColor(avg)}>{avg.toFixed(1)}</Badge>}
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
