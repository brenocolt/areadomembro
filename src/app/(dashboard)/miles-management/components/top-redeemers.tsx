"use client"

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Trophy } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"

export function TopRedeemers() {
    const [topUsers, setTopUsers] = useState<any[]>([])

    useEffect(() => {
        async function fetch() {
            // Get top users by saldo_disponivel, only for active registered users
            const { data } = await supabase
                .from('milhas_saldo')
                .select('saldo_disponivel, colaboradores!inner(nome, cargo_atual, users!inner(id))')
                .order('saldo_disponivel', { ascending: false })
                .limit(5)

            if (data) setTopUsers(data)
        }
        fetch()

        const sub = supabase.channel('top_redeemers_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'milhas_saldo' }, fetch)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'colaboradores' }, fetch)
            .subscribe()

        window.addEventListener('refreshMilesData', fetch)

        return () => {
            supabase.removeChannel(sub)
            window.removeEventListener('refreshMilesData', fetch)
        }
    }, [])

    const maxMiles = topUsers.length > 0 ? Math.max(topUsers[0].saldo_disponivel, 1) : 10000;

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none text-slate-900 dark:text-white rounded-3xl h-full shadow-lg">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                            <Trophy className="h-5 w-5 text-amber-500" />
                            Ranking de Milhas
                        </CardTitle>
                        <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">Maiores saldos disponíveis</CardDescription>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {topUsers.length > 0 ? topUsers.map((user, index) => (
                    <div key={index} className="group">
                        <div className="flex justify-between items-end mb-2">
                            <div className="flex items-center gap-3">
                                <span className={`text-xs font-bold w-4 ${index === 0 ? 'text-amber-500' : index === 1 ? 'text-slate-400' : index === 2 ? 'text-amber-700' : 'text-slate-500 dark:text-slate-600'}`}>
                                    {String(index + 1).padStart(2, '0')}
                                </span>
                                <div className="min-w-0">
                                    <span className="block text-sm font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors truncate">{user.colaboradores?.nome}</span>
                                    <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider truncate">{user.colaboradores?.cargo_atual}</span>
                                </div>
                            </div>
                            <span className="text-sm font-bold text-cyan-700 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-200 dark:border-cyan-500/20 whitespace-nowrap">
                                {new Intl.NumberFormat('pt-BR').format(user.saldo_disponivel)} mi
                            </span>
                        </div>
                        <Progress value={user.saldo_disponivel} max={maxMiles} className="h-1.5 bg-slate-100 dark:bg-white/5" indicatorClassName="bg-gradient-to-r from-cyan-600 to-cyan-400" />
                    </div>
                )) : (
                    <p className="text-sm text-slate-400 italic text-center py-4">Nenhum saldo registrado</p>
                )}
            </CardContent>

            <div className="p-6 pt-0 mt-auto">
                <Button variant="ghost" className="w-full text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl uppercase tracking-wider font-bold h-10 border border-transparent hover:border-slate-200 dark:hover:border-white/5">
                    Ver Ranking Completo
                </Button>
            </div>
        </Card>
    )
}
