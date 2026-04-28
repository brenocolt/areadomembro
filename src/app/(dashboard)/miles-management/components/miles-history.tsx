"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Calendar, Filter, Search } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const STATUS_COLOR_MAP: Record<string, string> = {
    'PENDENTE': 'bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
    'APROVADA': 'bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
    'REPROVADA': 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
}

export function MilesHistory() {
    const [history, setHistory] = useState<any[]>([])

    useEffect(() => {
        async function fetch() {
            // 1. Fetch exchanges
            const { data: exchanges } = await supabase
                .from('milhas_trocas')
                .select('*, colaboradores!inner(nome, users!inner(id), milhas_saldo(saldo_disponivel))')
                .neq('status', 'PENDENTE')
                .order('data_troca', { ascending: false })
                .limit(20)
                
            // 2. Fetch additions
            const { data: additions } = await supabase
                .from('solicitacoes_saque')
                .select('*, colaboradores!inner(nome, users!inner(id), milhas_saldo(saldo_disponivel))')
                .eq('tipo', 'adicao_milhas')
                .neq('status', 'PENDENTE')
                .order('created_at', { ascending: false })
                .limit(20)

            const combined = []

            if (exchanges) {
                combined.push(...exchanges.map(o => {
                    const milhasSaldo = o.colaboradores?.milhas_saldo
                    const saldo = Array.isArray(milhasSaldo) ? milhasSaldo[0]?.saldo_disponivel : milhasSaldo?.saldo_disponivel
                    return {
                        id: `exchange-${o.id}`,
                        type: 'Troca',
                        name: o.colaboradores?.nome || 'Desconhecido',
                        action: `-${o.milhas_gastas} pts`,
                        status: o.status,
                        currentBalance: saldo || 0,
                        timeObj: new Date(o.data_troca),
                        time: new Date(o.data_troca).toLocaleDateString('pt-BR'),
                        item: o.item_nome,
                    }
                }))
            }

            if (additions) {
                combined.push(...additions.map(o => {
                    const milhasSaldo = o.colaboradores?.milhas_saldo
                    const saldo = Array.isArray(milhasSaldo) ? milhasSaldo[0]?.saldo_disponivel : milhasSaldo?.saldo_disponivel
                    return {
                        id: `addition-${o.id}`,
                        type: 'Adição',
                        name: o.colaboradores?.nome || 'Desconhecido',
                        action: `+${o.quantidade} pts`,
                        status: o.status === 'APROVADO' ? 'APROVADA' : 'REPROVADA',
                        currentBalance: saldo || 0,
                        timeObj: new Date(o.created_at),
                        time: new Date(o.created_at).toLocaleDateString('pt-BR'),
                        item: o.atividade,
                    }
                }))
            }

            combined.sort((a, b) => b.timeObj.getTime() - a.timeObj.getTime())

            setHistory(combined.slice(0, 20))
        }
        fetch()

        const subExchanges = supabase.channel('history_exchanges_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'milhas_trocas' }, fetch)
            .subscribe()
            
        const subAdditions = supabase.channel('history_additions_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes_saque' }, fetch)
            .subscribe()

        window.addEventListener('refreshMilesData', fetch)

        return () => {
            supabase.removeChannel(subExchanges)
            supabase.removeChannel(subAdditions)
            window.removeEventListener('refreshMilesData', fetch)
        }
    }, [])

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none text-slate-900 dark:text-white rounded-3xl history-card-container shadow-lg">
            <CardContent className="p-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-50 dark:bg-white/5 p-2 rounded-xl border border-slate-100 dark:border-white/10">
                            <Calendar className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                        </div>
                        <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white">Histórico de Adições e Resgates de Milhas</h3>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                            <Input
                                placeholder="Buscar resgates..."
                                className="pl-9 bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/10 text-slate-900 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:ring-slate-500/50 h-10 rounded-xl"
                            />
                        </div>
                        <Button variant="ghost" size="icon" className="h-10 w-10 border border-slate-100 dark:border-white/10 bg-slate-50 dark:bg-white/5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl">
                            <Filter className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {history.length > 0 ? history.map((item) => (
                        <div key={item.id} className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/10 hover:border-slate-200 dark:hover:border-white/20 p-5 rounded-2xl transition-all group backdrop-blur-md">
                            <div className="flex justify-between items-start mb-3">
                                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg border uppercase tracking-wider ${STATUS_COLOR_MAP[item.status] || STATUS_COLOR_MAP['PENDENTE']}`}>
                                    {item.status} ({item.action})
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">{item.time}</span>
                            </div>
                            <TooltipProvider delayDuration={0}>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1 cursor-help border-b border-dashed border-slate-300 dark:border-slate-600 w-fit">{item.name}</h4>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="bg-slate-900 dark:bg-slate-800 text-white border-none shadow-xl">
                                        <p className="text-xs font-semibold">
                                            Saldo Atual: <span className="text-cyan-400 font-bold">{item.currentBalance.toLocaleString('pt-BR')} milhas</span>
                                        </p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                            <p className="text-xs font-medium text-cyan-600 dark:text-cyan-400/80 line-clamp-2 leading-relaxed">
                                {item.item}
                            </p>
                        </div>
                    )) : (
                        <div className="col-span-full text-center py-8">
                            <p className="text-sm text-slate-400 italic">Nenhum resgate registrado</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
