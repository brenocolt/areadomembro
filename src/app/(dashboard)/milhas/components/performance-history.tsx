"use client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { TrendingUp } from "lucide-react"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"

export function PerformanceHistory() {
    const { colaboradorId } = useColaborador()
    const [history, setHistory] = useState<any[]>([])

    useEffect(() => {
        async function fetch() {
            const { data } = await supabase
                .from('avaliacoes_nps')
                .select('mes, ano, nps_geral')
                .eq('colaborador_id', colaboradorId)
                .order('ano', { ascending: false })
                .order('mes', { ascending: false })
                .limit(5)
            if (data) {
                const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
                setHistory(data.map(n => ({
                    period: `${months[n.mes - 1]} ${n.ano}`,
                    semester: `Semestre ${String(n.ano).slice(-2)}.${n.mes <= 6 ? '1' : '2'}`,
                    nps: Number(n.nps_geral),
                })))
            }
        }
        if (colaboradorId) fetch()
    }, [colaboradorId])

    return (
        <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl h-full">
            <CardHeader className="pb-2">
                <CardTitle className="font-display text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    Entradas & Desempenho
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                        <TableRow className="hover:bg-transparent">
                            <TableHead className="h-8 text-[10px] uppercase font-bold pl-6">Período</TableHead>
                            <TableHead className="h-8 text-[10px] uppercase font-bold text-center">NPS</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {history.length > 0 ? history.map((item, i) => (
                            <TableRow key={i} className="hover:bg-slate-50/50 border-slate-100 dark:border-slate-800">
                                <TableCell className="pl-6 py-3">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-xs">{item.period}</span>
                                        <span className="text-[9px] text-slate-400 uppercase">{item.semester}</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="secondary" className={`text-[10px] font-bold ${item.nps >= 9.5 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'}`}>
                                        {item.nps.toFixed(1)}
                                    </Badge>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={2} className="text-center text-xs text-slate-400 italic py-8">Nenhum registro</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}
