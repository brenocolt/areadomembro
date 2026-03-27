"use client"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { History, Clock, CheckCircle2, XCircle } from "lucide-react"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"

export function ExchangeHistory() {
    const { colaboradorId } = useColaborador()
    const [exchanges, setExchanges] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetch() {
            setLoading(true)
            const { data } = await supabase
                .from('milhas_trocas')
                .select('*')
                .eq('colaborador_id', colaboradorId)
                .order('data_troca', { ascending: false })
            if (data) setExchanges(data)
            setLoading(false)
        }
        if (colaboradorId) fetch()
    }, [colaboradorId])

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg flex flex-col h-full rounded-3xl">
            <CardHeader className="border-b border-slate-100 dark:border-white/5 flex flex-row items-center justify-between space-y-0 px-6 py-5 min-h-[76px]">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <History className="h-5 w-5 text-cyan-600 dark:text-cyan-500" />
                    Histórico de Pedidos de Troca
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 flex-1 overflow-hidden flex flex-col p-4 sm:p-6 pr-2 sm:pr-4">
                {loading ? (
                    <div className="animate-pulse h-full bg-slate-100 dark:bg-white/5 rounded-2xl" />
                ) : exchanges.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                        <p className="text-sm text-slate-400 italic text-center py-6">Nenhum pedido de troca encontrado.</p>
                    </div>
                ) : (
                    <div className="space-y-3 h-full max-h-[400px] overflow-y-auto custom-scrollbar pr-2 pb-2">
                        {exchanges.map((item) => (
                            <div key={item.id} className={`flex flex-col gap-2 relative p-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl hover:bg-slate-100 dark:hover:bg-white/10 transition-colors overflow-hidden group`}>
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.status === 'APROVADA' ? 'bg-emerald-500' :
                                    item.status === 'REPROVADA' ? 'bg-rose-500' :
                                        'bg-blue-500'
                                    }`} />

                                <div className="flex flex-col md:flex-row justify-between md:items-center gap-2 mb-1">
                                    <span className="font-bold text-sm text-slate-900 dark:text-white truncate pr-2 block">
                                        {item.item_nome}
                                    </span>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {item.status === 'PENDENTE' && <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-blue-600 bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 rounded whitespace-nowrap"><Clock className="h-3 w-3" /> Em Análise</span>}
                                        {item.status === 'APROVADA' && <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 rounded whitespace-nowrap"><CheckCircle2 className="h-3 w-3" /> Aprovada</span>}
                                        {item.status === 'REPROVADA' && <span className="flex items-center gap-1 text-[10px] uppercase font-bold text-rose-600 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded whitespace-nowrap"><XCircle className="h-3 w-3" /> Reprovada</span>}
                                    </div>
                                </div>

                                <div className="flex justify-between items-center mt-1">
                                    <p className="text-[10px] text-slate-500 font-mono">
                                        {new Date(item.data_troca).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                    </p>

                                    <div className="text-xs font-bold">
                                        {item.status === 'REPROVADA' ? (
                                            <span className="text-slate-400 line-through dark:text-slate-600">-{new Intl.NumberFormat('pt-BR').format(item.milhas_gastas)} milhas</span>
                                        ) : (
                                            <span className="text-rose-500 dark:text-rose-400">-{new Intl.NumberFormat('pt-BR').format(item.milhas_gastas)} milhas</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
