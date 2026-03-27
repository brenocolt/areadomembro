"use client"

import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { TrendingUp } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"

export function TopOffenders() {
    const [offenders, setOffenders] = useState<any[]>([])

    useEffect(() => {
        async function fetch() {
            const { data } = await supabase
                .from('colaboradores')
                .select('id, nome, cargo_atual, pontos_negativos, users!inner(id)')
                .gt('pontos_negativos', 0)
                .order('pontos_negativos', { ascending: false })
                .limit(5)
            if (data) setOffenders(data)
        }
        fetch()

        const sub = supabase.channel('top_offenders_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'colaboradores' }, fetch)
            .subscribe()

        window.addEventListener('refreshPointsData', fetch)

        return () => {
            supabase.removeChannel(sub)
            window.removeEventListener('refreshPointsData', fetch)
        }
    }, [])

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none text-slate-900 dark:text-white rounded-3xl h-full shadow-lg">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                            <TrendingUp className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                            Maiores Pontuadores
                        </CardTitle>
                        <CardDescription className="text-slate-500 dark:text-slate-400 text-xs">Ranking de pontos negativos</CardDescription>
                    </div>
                    <div className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 dark:text-slate-300">
                        Geral
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {offenders.length > 0 ? offenders.map((user, index) => (
                    <div key={user.id} className="group">
                        <div className="flex justify-between items-end mb-2">
                            <div className="flex items-center gap-3">
                                <span className={`text-xs font-bold w-4 ${index === 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-400 dark:text-slate-600'}`}>
                                    {String(index + 1).padStart(2, '0')}
                                </span>
                                <div>
                                    <span className="block text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-200 transition-colors">{user.nome}</span>
                                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">{user.cargo_atual}</span>
                                </div>
                            </div>
                            <span className="text-sm font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded border border-rose-200 dark:border-rose-500/20">
                                {user.pontos_negativos} pts
                            </span>
                        </div>
                        <Progress value={user.pontos_negativos} max={10} className="h-1.5 bg-slate-100 dark:bg-white/5" indicatorClassName="bg-gradient-to-r from-rose-600 to-rose-400" />
                    </div>
                )) : (
                    <p className="text-sm text-slate-400 italic text-center py-4">Nenhum colaborador com pontos negativos</p>
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
