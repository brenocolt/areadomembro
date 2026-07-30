"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { CARGO_FANTASMA } from "@/lib/cargos"
import { History, Search, Clock, User } from "lucide-react"

interface AjusteSaldo {
    id: string
    valor: number
    tipo: string
    descricao: string | null
    data: string
    realizado_por: string | null
    colaboradores?: { nome: string, status: string | null, cargo_atual: string | null } | null
}

export function PipjAjustesHistorico() {
    const [ajustes, setAjustes] = useState<AjusteSaldo[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            const { data } = await supabase
                .from('transacoes_pipj')
                .select('id, valor, tipo, descricao, data, realizado_por, colaboradores(nome, status, cargo_atual)')
                .not('realizado_por', 'is', null)
                .order('data', { ascending: false })
            if (data) {
                setAjustes((data as any[]).filter(a => a.colaboradores?.status !== 'Desligado' && a.colaboradores?.cargo_atual !== CARGO_FANTASMA))
            }
            setLoading(false)
        }
        fetchData()
        window.addEventListener('refreshPipjData', fetchData)

        const sub = supabase.channel('pipj_ajustes_historico')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transacoes_pipj' }, fetchData)
            .subscribe()

        return () => {
            supabase.removeChannel(sub)
            window.removeEventListener('refreshPipjData', fetchData)
        }
    }, [])

    const filtered = ajustes.filter(a => {
        if (!search) return true
        const q = search.toLowerCase()
        return (a.colaboradores?.nome || '').toLowerCase().includes(q) ||
            (a.realizado_por || '').toLowerCase().includes(q) ||
            (a.descricao || '').toLowerCase().includes(q)
    })

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <History className="h-5 w-5 text-slate-500" />
                        <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                            Registros de Alterações de Saldo
                        </CardTitle>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar colaborador ou autor..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 bg-slate-50 dark:bg-slate-900 border-none h-9 text-sm rounded-xl"
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-slate-400">
                        <Clock className="h-6 w-6 animate-spin" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-slate-400 dark:text-slate-500 text-sm">
                        Nenhum ajuste manual de saldo registrado.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {filtered.map(a => {
                            const isAdicao = a.tipo === 'ENTRADA'
                            const motivo = (a.descricao || '').replace(/^Ajuste manual de saldo:\s*/i, '')
                            return (
                                <div key={a.id} className="flex items-center justify-between gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                                            {a.colaboradores?.nome || 'Desconhecido'}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                                            {motivo || 'Sem motivo informado'}
                                        </p>
                                        <div className="flex items-center gap-3 mt-1 text-[11px] text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <User className="h-3 w-3" /> {a.realizado_por || 'Desconhecido'}
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="h-3 w-3" /> {new Date(a.data).toLocaleString('pt-BR')}
                                            </span>
                                        </div>
                                    </div>
                                    <span className={`text-sm font-bold shrink-0 ${isAdicao ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                        {isAdicao ? '+' : '-'} R$ {Number(a.valor).toFixed(2).replace('.', ',')}
                                    </span>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
