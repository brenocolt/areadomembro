"use client"
import { useState, useEffect } from "react"
import { Clock, CheckCircle2, XCircle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useColaborador } from "@/hooks/use-supabase"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { RequestRemovalDialog } from "./request-removal-dialog"

export function RemovalRequestsHistory() {
    const { colaboradorId } = useColaborador()
    const [requests, setRequests] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!colaboradorId) return;

        async function fetchRequests() {
            setLoading(true)
            const { data } = await supabase
                .from('solicitacoes_remocao')
                .select('*')
                .eq('colaborador_id', colaboradorId)
                .order('created_at', { ascending: false })

            if (data) setRequests(data)
            setLoading(false)
        }

        fetchRequests()

        const sub = supabase.channel('my_removal_requests')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes_remocao', filter: `colaborador_id=eq.${colaboradorId}` }, fetchRequests)
            .subscribe()

        return () => {
            supabase.removeChannel(sub)
        }
    }, [colaboradorId])

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg flex flex-col h-full rounded-3xl">
            <CardHeader className="border-b border-slate-100 dark:border-white/5 flex flex-row items-center justify-between space-y-0 px-6 py-5 min-h-[76px]">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Meus Pedidos de Remoção</CardTitle>
                <div className="shrink-0">
                    <RequestRemovalDialog />
                </div>
            </CardHeader>
            <CardContent className="pt-4 flex-1 overflow-hidden flex flex-col p-4 sm:p-6 pr-2 sm:pr-4">
                {loading ? (
                    <div className="animate-pulse h-full bg-slate-100 dark:bg-white/5 rounded-2xl" />
                ) : requests.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-sm text-slate-400 italic text-center py-6">Nenhum pedido de remoção encontrado.</p>
                    </div>
                ) : (
                    <div className="space-y-3 h-full overflow-y-auto custom-scrollbar pr-2 pb-2">
                        {requests.map((req) => (
                            <div key={req.id} className={`flex flex-col gap-2 relative p-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors overflow-hidden group`}>
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${req.status === 'APROVADA' ? 'bg-emerald-500' :
                                    req.status === 'REJEITADA' ? 'bg-rose-500' :
                                        'bg-blue-500'
                                    }`} />

                                <div className="flex flex-col md:flex-row justify-between md:items-center gap-2 mb-1">
                                    <span className="font-bold text-sm text-slate-900 dark:text-white truncate pr-2 block">
                                        {req.pontos_solicitados ? `Solicitação de Remoção (${req.pontos_solicitados} pts)` : 'Recurso de Ocorrência'}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {req.status === 'PENDENTE' && <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded whitespace-nowrap"><Clock className="h-3 w-3" /> Em Análise</span>}
                                        {req.status === 'APROVADA' && <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded whitespace-nowrap"><CheckCircle2 className="h-3 w-3" /> Aprovada</span>}
                                        {req.status === 'REJEITADA' && <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-rose-600 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded whitespace-nowrap"><XCircle className="h-3 w-3" /> Recusada</span>}
                                    </div>
                                </div>

                                <p className="text-xs text-slate-600 dark:text-slate-400 capitalize-first line-clamp-2 md:line-clamp-none">
                                    {req.motivo}
                                </p>

                                <div className="flex gap-4 items-center">
                                    <p className="text-[10px] text-slate-500 font-mono mt-1">
                                        {new Date(req.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </p>
                                    {req.comprovante_url && (
                                        <a href={req.comprovante_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:text-blue-600 hover:underline mt-1 inline-block">
                                            Ver Comprovante
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
