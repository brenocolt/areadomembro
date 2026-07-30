"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { Receipt, Clock } from "lucide-react"

const STATUS_COLORS: Record<string, string> = {
    PENDENTE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
    APROVADO: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    REJEITADO: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
}

function parseMotivo(descricao: string) {
    return (descricao || '').split(' | ')[0] || descricao
}

export function PipjSolicitacoesCard() {
    const { colaboradorId, loading: loadingColab } = useColaborador()
    const [solicitacoes, setSolicitacoes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (loadingColab) return
        if (!colaboradorId) { setLoading(false); return }

        async function fetchData() {
            setLoading(true)
            const { data } = await supabase
                .from('solicitacoes_saque')
                .select('*')
                .eq('colaborador_id', colaboradorId)
                .eq('tipo', 'saque_pipj')
                .order('data_solicitacao', { ascending: false })
            if (data) setSolicitacoes(data)
            setLoading(false)
        }
        fetchData()

        const sub = supabase.channel('minhas_solicitacoes_pipj')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes_saque' }, fetchData)
            .subscribe()
        return () => { supabase.removeChannel(sub) }
    }, [colaboradorId, loadingColab])

    const total = solicitacoes.reduce((sum, s) => sum + Number(s.valor || 0), 0)

    if (loading || loadingColab) return <Card className="h-64 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-3xl border-none" />

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                        <Receipt className="h-5 w-5 text-slate-500" />
                        <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                            Minhas Solicitações de Saque PIPJ
                        </CardTitle>
                    </div>
                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                        Total solicitado: R$ {total.toFixed(2).replace('.', ',')}
                    </span>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {solicitacoes.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-slate-400 dark:text-slate-500 text-sm">
                        Você ainda não fez nenhuma solicitação de saque.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {solicitacoes.map(s => (
                            <div key={s.id} className="flex items-center justify-between gap-4 px-6 py-4">
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{parseMotivo(s.descricao)}</p>
                                    <div className="flex items-center gap-1 text-xs text-slate-400 mt-0.5">
                                        <Clock className="h-3 w-3" />
                                        {s.data_solicitacao ? new Date(s.data_solicitacao).toLocaleDateString('pt-BR') : '—'}
                                    </div>
                                </div>
                                <div className="text-right flex flex-col items-end gap-1 shrink-0">
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">
                                        R$ {Number(s.valor).toFixed(2).replace('.', ',')}
                                    </span>
                                    <Badge className={`${STATUS_COLORS[s.status] || 'bg-slate-100 text-slate-600'} font-bold text-[10px] uppercase tracking-wider border-none`}>
                                        {s.status || 'DESCONHECIDO'}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
