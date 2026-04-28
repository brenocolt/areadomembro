"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { ArrowDownLeft, ArrowUpRight, AlertTriangle, ChevronDown, Briefcase, TrendingUp, Award, MinusCircle, CalendarOff } from "lucide-react"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"

const STATUS_MAP: Record<string, { label: string; className: string }> = {
    CREDITADO: { label: 'Creditado', className: 'bg-green-50 text-green-700 border-green-200' },
    APROVADO: { label: 'Aprovado', className: 'bg-blue-50 text-blue-700 border-blue-200' },
    PENDENTE: { label: 'Pendente', className: 'bg-amber-50 text-amber-700 border-amber-200' },
    PROCESSANDO: { label: 'Processando', className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    PAGO: { label: 'Pago', className: 'bg-green-50 text-green-700 border-green-200' },
    REJEITADO: { label: 'Rejeitado', className: 'bg-red-50 text-red-700 border-red-200' },
}

function BreakdownRow({ detalhes }: { detalhes: any }) {
    if (!detalhes || Object.keys(detalhes).length === 0) {
        return (
            <TableRow className="bg-slate-50/80 dark:bg-slate-900/40">
                <TableCell colSpan={6} className="pl-16 py-3 text-xs text-slate-400 italic">
                    Detalhes do cálculo não disponíveis para este lançamento.
                </TableCell>
            </TableRow>
        )
    }

    const items = [
        { icon: Briefcase, label: `Base do cargo`, value: detalhes.base_cargo, color: 'text-slate-700 dark:text-slate-300', positive: true },
        { icon: TrendingUp, label: `Bônus por projetos (${detalhes.qtd_projetos || 0} projetos)`, value: detalhes.bonus_projetos, color: 'text-cyan-600 dark:text-cyan-400', positive: true, hide: !detalhes.bonus_projetos },
        { icon: Award, label: `Bônus por nível (${detalhes.nivel || '—'})`, value: detalhes.bonus_nivel, color: 'text-indigo-600 dark:text-indigo-400', positive: true, hide: !detalhes.bonus_nivel },
        { icon: MinusCircle, label: `Desconto punições (${detalhes.pontos_negativos || 0} pontos)`, value: detalhes.desconto_punicao, color: 'text-red-500', positive: false, hide: !detalhes.desconto_punicao },
        { icon: CalendarOff, label: `Desconto ausências (${detalhes.dias_ausencia || 0} dias de ${detalhes.dias_uteis_mes || '—'} úteis)`, value: detalhes.desconto_ausencia, color: 'text-amber-600 dark:text-amber-400', positive: false, hide: !detalhes.desconto_ausencia },
        { icon: Briefcase, label: `Ajuste / Dedução (${detalhes.motivo_ajuste || 'Sem descrição'})`, value: Math.abs(detalhes.ajuste_manual || 0), color: (detalhes.ajuste_manual || 0) < 0 ? 'text-red-500' : 'text-green-500', positive: (detalhes.ajuste_manual || 0) >= 0, hide: !detalhes.ajuste_manual },
    ]

    return (
        <TableRow className="bg-gradient-to-r from-cyan-50/40 to-slate-50/40 dark:from-cyan-900/10 dark:to-slate-900/30 border-b border-cyan-100/50 dark:border-cyan-800/20">
            <TableCell colSpan={6} className="px-6 py-3">
                <div className="ml-11 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase text-slate-400 tracking-wider mb-2">Composição do cálculo</p>
                    {items.filter(i => !i.hide).map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between max-w-md">
                            <div className="flex items-center gap-2">
                                <item.icon className={`h-3.5 w-3.5 ${item.color}`} />
                                <span className="text-xs text-slate-600 dark:text-slate-400">{item.label}</span>
                            </div>
                            <span className={`text-xs font-bold ${item.color}`}>
                                {item.positive ? '+' : '-'} R$ {Number(item.value || 0).toFixed(2).replace('.', ',')}
                            </span>
                        </div>
                    ))}
                    <div className="border-t border-dashed border-slate-200 dark:border-slate-700 mt-2 pt-2 flex items-center justify-between max-w-md">
                        <span className="text-xs font-bold text-slate-700 dark:text-slate-200">Total creditado</span>
                        <span className="text-xs font-bold text-green-600 dark:text-green-400">
                            R$ {Number((detalhes.base_cargo || 0) + (detalhes.bonus_projetos || 0) + (detalhes.bonus_nivel || 0) - (detalhes.desconto_punicao || 0) - (detalhes.desconto_ausencia || 0) + (detalhes.ajuste_manual || 0)).toFixed(2).replace('.', ',')}
                        </span>
                    </div>
                </div>
            </TableCell>
        </TableRow>
    )
}

export function TransactionHistory() {
    const { colaboradorId } = useColaborador()
    const [transactions, setTransactions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedId, setExpandedId] = useState<string | null>(null)

    useEffect(() => {
        async function fetch() {
            const { data } = await supabase
                .from('transacoes_pipj')
                .select('*')
                .eq('colaborador_id', colaboradorId)
                .order('data', { ascending: false })
            if (data) setTransactions(data)
            setLoading(false)
        }
        fetch()
    }, [colaboradorId])

    const toggleExpand = (id: string, isEntry: boolean) => {
        if (!isEntry) return
        setExpandedId(prev => prev === id ? null : id)
    }

    return (
        <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
            <CardHeader className="border-b border-slate-50 dark:border-slate-800/50 pb-4">
                <CardTitle className="text-lg font-display">Histórico de Entradas</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                        <TableRow className="hover:bg-transparent border-b-slate-100 dark:border-b-slate-800">
                            <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9 pl-6">Período</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9">Semestre</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9">Cargo</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9 text-center">Tipo</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9 text-right">Valor</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9 text-right pr-6">Status</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {transactions.length > 0 ? transactions.map((t) => {
                            const isEntry = t.tipo === 'ENTRADA'
                            const status = STATUS_MAP[t.status] || { label: t.status, className: '' }
                            const isExpanded = expandedId === t.id
                            return (
                                <>
                                    <TableRow
                                        key={t.id}
                                        className={`border-b-slate-100 dark:border-b-slate-800 ${isEntry ? 'cursor-pointer hover:bg-cyan-50/30 dark:hover:bg-cyan-900/10' : 'hover:bg-slate-50/50 dark:hover:bg-slate-800/50'} ${isExpanded ? 'bg-cyan-50/20 dark:bg-cyan-900/10 border-b-0' : ''}`}
                                        onClick={() => toggleExpand(t.id, isEntry)}
                                    >
                                        <TableCell className="pl-6">
                                            <div className="flex items-center gap-3">
                                                <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${isEntry ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-500 dark:bg-red-900/20 dark:text-red-400'}`}>
                                                    {isEntry ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                                                </div>
                                                <div className="flex flex-col">
                                                    <span className="font-bold text-xs">{t.periodo || t.descricao_resgate || (isEntry ? 'Crédito' : 'Resgate')}</span>
                                                    <span className="text-[9px] text-slate-400">{new Date(t.data).toLocaleDateString('pt-BR')}</span>
                                                </div>
                                                {isEntry && (
                                                    <ChevronDown className={`h-3.5 w-3.5 text-slate-400 ml-1 transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                                )}
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs">{t.semestre || '—'}</TableCell>
                                        <TableCell className="text-xs">{t.cargo_no_periodo || '—'}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className={`text-[9px] font-bold ${isEntry ? 'border-green-200 text-green-700 bg-green-50' : 'border-red-200 text-red-600 bg-red-50'}`}>
                                                {isEntry ? 'Entrada' : 'Saída'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className={`text-right font-bold text-xs ${isEntry ? 'text-green-600' : 'text-red-500'}`}>
                                            {isEntry ? '+' : '-'} R$ {Number(t.valor).toFixed(2).replace('.', ',')}
                                        </TableCell>
                                        <TableCell className="text-right pr-6">
                                            <Badge variant="outline" className={`text-[9px] font-bold ${status.className}`}>{status.label}</Badge>
                                        </TableCell>
                                    </TableRow>
                                    {isExpanded && <BreakdownRow detalhes={t.detalhes_calculo} />}
                                </>
                            )
                        }) : (
                            <TableRow><TableCell colSpan={6} className="text-center text-xs text-slate-400 italic py-8">Nenhuma transação registrada</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}

export function PunishmentAlert() {
    const { colaborador, loading } = useColaborador()

    if (loading || !colaborador || colaborador.pontos_negativos === 0) return null

    return (
        <Card className="border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-900/5 border-none rounded-2xl shadow-sm">
            <CardContent className="p-4 flex items-center gap-4">
                <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-5 w-5" />
                </div>
                <div>
                    <span className="font-bold text-sm text-red-900 dark:text-white">Atenção: Pontos Negativos Ativos</span>
                    <p className="text-xs text-red-700 dark:text-red-300/80 mt-0.5">
                        Você possui <strong>{colaborador.pontos_negativos} ponto(s)</strong> negativo(s). Acesse a aba de Punições para mais detalhes.
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}
