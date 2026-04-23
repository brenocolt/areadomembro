"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { supabase } from "@/lib/supabase"
import { Search, Repeat, AlertTriangle, User } from "lucide-react"

interface RecurrenceItem {
    colaboradorId: string
    colaboradorNome: string
    motivo: string
    count: number
    totalPontos: number
    lastDate: string
}

export function PointsRecurrence() {
    const [loading, setLoading] = useState(true)
    const [data, setData] = useState<RecurrenceItem[]>([])
    const [search, setSearch] = useState("")

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            const { data: ocorrencias } = await supabase
                .from('ocorrencias')
                .select('colaborador_id, motivo, pontuacao, data, colaboradores(nome)')
                .order('data', { ascending: false })

            if (ocorrencias) {
                // Group by colaborador_id + motivo
                const map: Record<string, RecurrenceItem> = {}
                ocorrencias.forEach((o: any) => {
                    const key = `${o.colaborador_id}||${o.motivo}`
                    if (!map[key]) {
                        map[key] = {
                            colaboradorId: o.colaborador_id,
                            colaboradorNome: o.colaboradores?.nome || 'Desconhecido',
                            motivo: o.motivo || 'Sem motivo',
                            count: 0,
                            totalPontos: 0,
                            lastDate: o.data,
                        }
                    }
                    map[key].count++
                    map[key].totalPontos += (o.pontuacao || 0)
                    // Keep latest date
                    if (o.data > map[key].lastDate) {
                        map[key].lastDate = o.data
                    }
                })

                // Filter only recurrences (count >= 2) and sort by count desc
                const items = Object.values(map)
                    .filter(item => item.count >= 2)
                    .sort((a, b) => b.count - a.count)

                setData(items)
            }
            setLoading(false)
        }
        fetchData()
    }, [])

    const filtered = data.filter(item =>
        item.colaboradorNome.toLowerCase().includes(search.toLowerCase()) ||
        item.motivo.toLowerCase().includes(search.toLowerCase())
    )

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse">
                {[1, 2, 3, 4].map(i => (
                    <div key={i} className="h-20 bg-slate-100 dark:bg-white/5 rounded-2xl" />
                ))}
            </div>
        )
    }

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-amber-50 dark:bg-amber-500/10 p-2.5 rounded-2xl border border-amber-100 dark:border-amber-500/20">
                        <Repeat className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    </div>
                    <div>
                        <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Recorrência de Pontos</CardTitle>
                        <p className="text-xs text-slate-500 mt-0.5">Colaboradores que recebem o mesmo tipo de punição repetidamente</p>
                    </div>
                </div>
                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Buscar por nome ou motivo..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="pl-9 bg-slate-50 dark:bg-slate-900 border-none h-9 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-primary"
                    />
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                        <Repeat className="h-10 w-10 opacity-20 mb-3" />
                        <p className="text-sm font-medium">Nenhuma recorrência detectada</p>
                        <p className="text-xs mt-1">Padrões aparecem quando o mesmo colaborador recebe a mesma punição 2+ vezes</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {filtered.map((item, idx) => {
                            const lastDate = new Date(item.lastDate).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                            const isHighRisk = item.count >= 4
                            const isMediumRisk = item.count >= 3

                            return (
                                <div key={idx} className="p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                    <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                                        <User className="h-5 w-5 text-slate-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-0.5">
                                            <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{item.colaboradorNome}</p>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                                                isHighRisk
                                                    ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'
                                                    : isMediumRisk
                                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'
                                                        : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                            }`}>
                                                {isHighRisk && <AlertTriangle className="h-3 w-3" />}
                                                {item.count}x
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{item.motivo}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">Última: {lastDate}</p>
                                    </div>
                                    <div className="text-center shrink-0 bg-white dark:bg-[#0f172a] h-14 w-14 flex flex-col items-center justify-center rounded-xl border border-slate-100 dark:border-white/5 shadow-sm">
                                        <span className="text-lg font-black text-rose-500 dark:text-rose-400 leading-none">{item.totalPontos}</span>
                                        <span className="text-[8px] uppercase font-bold text-slate-400 tracking-wider mt-0.5">pts total</span>
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
