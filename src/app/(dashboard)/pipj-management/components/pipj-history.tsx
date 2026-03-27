"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { ArrowUpRight, ArrowDownLeft, Clock, Banknote } from "lucide-react"

export function PipjHistory() {
    const [transactions, setTransactions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchData() {
            setLoading(true)

            const { data } = await supabase
                .from('transacoes_pipj')
                .select('*, colaboradores(nome)')
                .order('data', { ascending: false })
                .limit(20)

            if (data) setTransactions(data)
            setLoading(false)
        }

        fetchData()
        window.addEventListener('refreshPipjData', fetchData)

        const sub = supabase.channel('transacoes_pipj_history')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transacoes_pipj' }, fetchData)
            .subscribe()

        return () => {
            supabase.removeChannel(sub)
            window.removeEventListener('refreshPipjData', fetchData)
        }
    }, [])

    if (loading) return <Card className="h-96 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-3xl border-none" />

    return (
        <div className="space-y-6">
            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-white/5">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                        Movimentações Recentes
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {transactions.length === 0 ? (
                        <div className="flex items-center justify-center h-40 text-slate-400 dark:text-slate-500 text-sm">
                            Nenhuma movimentação registrada.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {transactions.map((tx) => {
                                const isEntrada = tx.tipo === 'ENTRADA'
                                return (
                                    <div key={tx.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl ${isEntrada ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-rose-50 dark:bg-rose-900/20'}`}>
                                                {isEntrada
                                                    ? <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                                    : <ArrowDownLeft className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                                                }
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                    {tx.colaboradores?.nome || 'Desconhecido'}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {tx.descricao || (isEntrada ? 'Crédito PIPJ' : 'Retirada PIPJ')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-bold ${isEntrada ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                {isEntrada ? '+' : '-'}R$ {Number(tx.valor).toFixed(2).replace('.', ',')}
                                            </p>
                                            <div className="flex items-center gap-1 text-xs text-slate-400">
                                                <Clock className="h-3 w-3" />
                                                {new Date(tx.data).toLocaleDateString('pt-BR')}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>

            <SaqueRequestsList />
        </div>
    )
}

const STATUS_COLORS: Record<string, string> = {
    PENDENTE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
    APROVADO: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    REJEITADO: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
}

function parseBankingInfo(descricao: string) {
    const parts = descricao.split(' | ')
    const motivo = parts[0] || descricao
    let dados: any = null
    try {
        if (parts[1]) dados = JSON.parse(parts[1])
    } catch { /* ignore */ }
    return { motivo, dados }
}

function SaqueRequestsList() {
    const [saques, setSaques] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            const { data } = await supabase
                .from('solicitacoes_saque')
                .select('*, colaboradores(nome)')
                .order('data_solicitacao', { ascending: false })
                .limit(30)
            if (data) setSaques(data)
            setLoading(false)
        }
        fetchData()

        const sub = supabase.channel('solicitacoes_saque_management')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes_saque' }, fetchData)
            .subscribe()
        return () => { supabase.removeChannel(sub) }
    }, [])

    if (loading) return <Card className="h-48 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-3xl border-none" />

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-primary" />
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                        Solicitações de Saque
                    </CardTitle>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {saques.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-slate-400 dark:text-slate-500 text-sm">
                        Nenhuma solicitação de saque registrada.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {saques.map((s) => {
                            const { motivo, dados } = parseBankingInfo(s.descricao || '')
                            return (
                                <div key={s.id} className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                {s.colaboradores?.nome || 'Desconhecido'}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{motivo}</p>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-1">
                                            <span className="text-lg font-bold text-primary dark:text-white">
                                                R$ {Number(s.valor).toFixed(2).replace('.', ',')}
                                            </span>
                                            <Badge className={STATUS_COLORS[s.status] || 'bg-slate-100 text-slate-600'}>
                                                {s.status || 'PENDENTE'}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                        {dados?.forma && (
                                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg font-medium">
                                                {dados.forma === 'pix' ? '🔑 PIX' : '🏦 Transferência'}
                                            </span>
                                        )}
                                        {dados?.chave_pix && (
                                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                                Chave: {dados.chave_pix}
                                            </span>
                                        )}
                                        {dados?.banco && (
                                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                                {dados.banco} | Ag: {dados.agencia} | Cc: {dados.conta}
                                            </span>
                                        )}
                                        {s.comprovante_url && (
                                            <a href={s.comprovante_url} target="_blank" rel="noopener noreferrer" className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg hover:underline">
                                                📎 Comprovante
                                            </a>
                                        )}
                                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                            📅 {s.data_solicitacao ? new Date(s.data_solicitacao).toLocaleDateString('pt-BR') : '—'}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
