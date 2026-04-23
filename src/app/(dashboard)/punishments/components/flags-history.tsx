"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Flag, AlertCircle } from "lucide-react"
import { useColaborador, useSupabaseQuery } from "@/hooks/use-supabase"

export function FlagsHistory() {
    const { colaboradorId } = useColaborador()
    const { data: flags, loading } = useSupabaseQuery<any>('flags', {
        column: 'colaborador_id',
        value: colaboradorId,
        orderBy: 'created_at',
        ascending: false,
    })

    if (loading) {
        return (
            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-sm flex flex-col h-full rounded-3xl mt-6">
                <div className="animate-pulse h-48 bg-slate-100 dark:bg-white/5 rounded-3xl" />
            </Card>
        )
    }

    if (!flags || flags.length === 0) {
        return (
            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-sm flex flex-col h-full rounded-3xl mt-6">
                <CardHeader className="border-b border-slate-100 dark:border-white/5 flex flex-row items-center space-y-0 px-6 py-5">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-50 dark:bg-indigo-500/10 p-2.5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
                            <Flag className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">Avisos Disciplinares (Flags)</CardTitle>
                            <p className="text-xs text-slate-500 mt-0.5">Infrações registradas na sua conta</p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                        <Flag className="h-10 w-10 opacity-20 mb-3" />
                        <p className="text-sm font-medium">Você não possui flags registradas.</p>
                    </div>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-sm flex flex-col h-full rounded-3xl mt-6">
            <CardHeader className="border-b border-slate-100 dark:border-white/5 flex flex-row items-center space-y-0 px-6 py-5">
                <div className="flex items-center gap-3">
                    <div className="bg-indigo-50 dark:bg-indigo-500/10 p-2.5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
                        <Flag className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                        <CardTitle className="text-lg font-bold text-slate-900 dark:text-white">Avisos Disciplinares (Flags)</CardTitle>
                        <p className="text-xs text-slate-500 mt-0.5">Infrações registradas na sua conta</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {flags.map((flag: any) => {
                        const dateStr = new Date(flag.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        const timeStr = new Date(flag.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                        
                        let colorClass = "bg-slate-100 text-slate-600"
                        let iconColor = "text-slate-500"
                        let bgBorder = "border-slate-200 bg-slate-50"
                        
                        if (flag.cor === 'vermelha') {
                            colorClass = "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"
                            iconColor = "text-red-600 dark:text-red-500"
                            bgBorder = "border-red-100 dark:border-red-900/30 bg-red-50/50 dark:bg-red-900/10"
                        } else if (flag.cor === 'amarela') {
                            colorClass = "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400"
                            iconColor = "text-yellow-600 dark:text-yellow-500"
                            bgBorder = "border-yellow-100 dark:border-yellow-900/30 bg-yellow-50/50 dark:bg-yellow-900/10"
                        } else if (flag.cor === 'azul') {
                            colorClass = "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400"
                            iconColor = "text-blue-600 dark:text-blue-500"
                            bgBorder = "border-blue-100 dark:border-blue-900/30 bg-blue-50/50 dark:bg-blue-900/10"
                        }

                        return (
                            <div key={flag.id} className={`p-4 rounded-2xl border ${bgBorder} flex flex-col gap-3 relative overflow-hidden group hover:shadow-md transition-shadow`}>
                                <div className="flex items-center justify-between">
                                    <span className={`text-[10px] uppercase font-bold px-2.5 py-1 rounded-full tracking-wider ${colorClass}`}>
                                        Flag {flag.cor}
                                    </span>
                                    <span className="text-[11px] font-mono text-slate-500 font-medium">
                                        {dateStr}
                                    </span>
                                </div>
                                <div className="flex gap-3 items-start mt-1">
                                    <AlertCircle className={`h-5 w-5 shrink-0 mt-0.5 ${iconColor}`} />
                                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 leading-snug">
                                        {flag.motivo}
                                    </p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </CardContent>
        </Card>
    )
}
