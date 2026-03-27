"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Calendar, Filter, Search } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"

export function RecentHistory() {
    const [history, setHistory] = useState<any[]>([])

    useEffect(() => {
        async function fetch() {
            const { data } = await supabase
                .from('ocorrencias')
                .select('*, colaboradores!inner(nome, users!inner(id))')
                .order('data', { ascending: false })
                .limit(8)
            if (data) setHistory(data.map(o => ({
                id: o.id,
                name: o.colaboradores?.nome || 'Desconhecido',
                action: `+${o.pontuacao} pts`,
                type: 'negative',
                time: new Date(o.data).toLocaleDateString('pt-BR'),
                reason: o.motivo + (o.descricao ? `: ${o.descricao}` : ''),
            })))
        }
        fetch()

        const sub = supabase.channel('recent_history_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'ocorrencias' }, fetch)
            .subscribe()

        window.addEventListener('refreshPointsData', fetch)

        return () => {
            supabase.removeChannel(sub)
            window.removeEventListener('refreshPointsData', fetch)
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
                        <h3 className="text-lg font-bold font-display text-slate-900 dark:text-white">Histórico Recente de Pontuações</h3>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400 dark:text-slate-500" />
                            <Input
                                placeholder="Buscar histórico..."
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
                                <span className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold px-2 py-1 rounded-lg border border-rose-100 dark:border-rose-500/20 group-hover:bg-rose-100 dark:group-hover:bg-rose-500/20 transition-colors uppercase tracking-wider">
                                    {item.action}
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">{item.time}</span>
                            </div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm mb-1">{item.name}</h4>
                            <p className="text-xs text-slate-600 dark:text-slate-400/70 line-clamp-2 leading-relaxed">
                                {item.reason}
                            </p>
                        </div>
                    )) : (
                        <div className="col-span-full text-center py-8">
                            <p className="text-sm text-slate-400 italic">Nenhuma ocorrência registrada</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
