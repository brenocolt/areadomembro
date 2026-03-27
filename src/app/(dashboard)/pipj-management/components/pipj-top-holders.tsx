"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { supabase } from "@/lib/supabase"
import { Crown } from "lucide-react"

export function PipjTopHolders() {
    const [holders, setHolders] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            const { data } = await supabase
                .from('colaboradores')
                .select('nome, saldo_pipj, cargo_atual')
                .order('saldo_pipj', { ascending: false })
                .limit(10)

            if (data) setHolders(data)
            setLoading(false)
        }

        fetchData()
        window.addEventListener('refreshPipjData', fetchData)

        const sub = supabase.channel('colab_pipj_top')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'colaboradores' }, fetchData)
            .subscribe()

        return () => {
            supabase.removeChannel(sub)
            window.removeEventListener('refreshPipjData', fetchData)
        }
    }, [])

    if (loading) return <Card className="h-96 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-3xl border-none" />

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden h-full">
            <CardHeader className="border-b border-slate-100 dark:border-white/5">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Crown className="h-4 w-4 text-amber-500" />
                    Maiores Saldos PIPJ
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {holders.length === 0 ? (
                    <div className="flex items-center justify-center h-40 text-slate-400 dark:text-slate-500 text-sm">
                        Nenhum colaborador encontrado.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {holders.map((h, i) => (
                            <div key={i} className="flex items-center justify-between px-6 py-3 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                <div className="flex items-center gap-3">
                                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold
                                        ${i === 0 ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400' :
                                            i === 1 ? 'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-300' :
                                                i === 2 ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' :
                                                    'bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400'}`}>
                                        {i + 1}
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                            {h.nome?.split(' ').slice(0, 2).join(' ') || 'Desconhecido'}
                                        </p>
                                        <p className="text-xs text-slate-400">{h.cargo_atual}</p>
                                    </div>
                                </div>
                                <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                                    R$ {Number(h.saldo_pipj).toFixed(2).replace('.', ',')}
                                </span>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
