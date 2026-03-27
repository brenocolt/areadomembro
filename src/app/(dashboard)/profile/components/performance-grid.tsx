"use client"

import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useColaborador, useSupabaseQuery } from "@/hooks/use-supabase"

export function PerformanceGrid() {
    const { colaboradorId } = useColaborador()
    const { data: npsData, loading } = useSupabaseQuery<any>('avaliacoes_nps', {
        column: 'colaborador_id',
        value: colaboradorId,
        orderBy: 'mes',
        ascending: true,
        select: 'mes, ano, comunicacao, dedicacao, confianca, pontualidade, organizacao, proatividade, qualidade_entregas, dominio_tecnico'
    })

    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

    const renderCell = (value: any) => {
        const num = Number(value)
        if (!value || isNaN(num)) return <span className="text-slate-300">-</span>
        const color = num >= 9 ? 'text-green-600' : num >= 7 ? 'text-blue-600' : 'text-amber-600'
        return <span className={`font-bold ${color}`}>{num.toFixed(1)}</span>
    }

    return (
        <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] overflow-hidden rounded-2xl mt-6">
            <div className="bg-[#0b1120] dark:bg-slate-900 px-4 py-3 flex items-center justify-between border-b border-white/5">
                <h3 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2 font-display">
                    Indicadores de Desempenho Interno
                </h3>
                <div className="flex gap-2">
                    <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-green-500"></div><span className="text-[10px] text-slate-400">Alto</span></div>
                    <div className="flex items-center gap-1"><div className="h-2 w-2 rounded-full bg-yellow-500"></div><span className="text-[10px] text-slate-400">Médio</span></div>
                </div>
            </div>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                        <TableRow className="hover:bg-transparent border-b-slate-100 dark:border-b-slate-800">
                            <TableHead className="text-[9px] font-bold uppercase text-slate-500 h-8 w-[80px]">Mês</TableHead>
                            <TableHead className="text-[9px] font-bold uppercase text-slate-500 h-8 text-center">Comunicação</TableHead>
                            <TableHead className="text-[9px] font-bold uppercase text-slate-500 h-8 text-center">Dedicação</TableHead>
                            <TableHead className="text-[9px] font-bold uppercase text-slate-500 h-8 text-center">Confiança</TableHead>
                            <TableHead className="text-[9px] font-bold uppercase text-slate-500 h-8 text-center">Pontualidade</TableHead>
                            <TableHead className="text-[9px] font-bold uppercase text-slate-500 h-8 text-center">Organização</TableHead>
                            <TableHead className="text-[9px] font-bold uppercase text-slate-500 h-8 text-center">Proatividade</TableHead>
                            <TableHead className="text-[9px] font-bold uppercase text-slate-500 h-8 text-center">Qualidade</TableHead>
                            <TableHead className="text-[9px] font-bold uppercase text-slate-500 h-8 text-center">Domínio Técnico</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {npsData.length > 0 ? npsData.map((row: any, i: number) => (
                            <TableRow key={i} className="border-b-slate-100 dark:border-b-slate-800">
                                <TableCell className="text-xs font-bold text-slate-400 uppercase bg-slate-50/50">{months[row.mes - 1]}</TableCell>
                                <TableCell className="text-center text-xs">{renderCell(row.comunicacao)}</TableCell>
                                <TableCell className="text-center text-xs">{renderCell(row.dedicacao)}</TableCell>
                                <TableCell className="text-center text-xs">{renderCell(row.confianca)}</TableCell>
                                <TableCell className="text-center text-xs">{renderCell(row.pontualidade)}</TableCell>
                                <TableCell className="text-center text-xs">{renderCell(row.organizacao)}</TableCell>
                                <TableCell className="text-center text-xs">{renderCell(row.proatividade)}</TableCell>
                                <TableCell className="text-center text-xs">{renderCell(row.qualidade_entregas)}</TableCell>
                                <TableCell className="text-center text-xs">{renderCell(row.dominio_tecnico)}</TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={9} className="text-center text-xs text-slate-400 italic py-8">Nenhuma avaliação registrada</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>
        </Card>
    )
}
