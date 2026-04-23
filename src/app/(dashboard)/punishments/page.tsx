"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, Info, FileText } from "lucide-react"
import { useColaborador, useSupabaseQuery } from "@/hooks/use-supabase"
import { RequestRemovalDialog } from "./components/request-removal-dialog"
import { RemovalRequestsHistory } from "./components/removal-requests-history"
import { FlagsHistory } from "./components/flags-history"

export default function PunishmentsPage() {
    const { colaborador, loading, colaboradorId } = useColaborador()
    const { data: ocorrencias, loading: loadingOc } = useSupabaseQuery<any>('ocorrencias', {
        column: 'colaborador_id',
        value: colaboradorId,
        orderBy: 'data',
        ascending: false,
    })

    const pontos = colaborador?.pontos_negativos || 0
    const percentual = Math.min((pontos / 10) * 100, 100)

    if (loading) return <div className="animate-pulse h-64 bg-slate-100 dark:bg-slate-800 rounded-2xl" />

    return (
        <div className="space-y-6">
            <div className="flex items-center text-sm text-muted-foreground mb-2">
                <span>Dashboard</span>
                <span className="mx-2">›</span>
                <span className="font-semibold text-primary dark:text-white">Gestão de Punições</span>
            </div>

            <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 p-6 rounded-2xl flex items-start gap-4">
                <div className="bg-red-100 dark:bg-red-900/30 p-3 rounded-full text-red-600 dark:text-red-400">
                    <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-red-900 dark:text-white">Status da Disciplina</h2>
                    <p className="text-red-700 dark:text-red-200/80 mt-1 max-w-3xl">
                        A Produtiva Júnior valoriza a conduta e a postura profissional. O acúmulo de pontos negativos pode resultar em desligamento ou perda de benefícios.
                        Você possui <strong>{pontos} ponto(s)</strong> ativo(s). O limite é 10.
                    </p>
                    <div className="w-full bg-red-200 dark:bg-red-900/30 h-3 rounded-full mt-4 overflow-hidden">
                        <div className="bg-red-600 h-full rounded-full transition-all duration-500" style={{ width: `${percentual}%` }}></div>
                    </div>
                    <div className="flex justify-between text-xs font-bold text-red-800 dark:text-red-300 mt-1">
                        <span>{pontos} Pontos</span>
                        <span>10 Pontos (Limite)</span>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
                <div className="flex flex-col h-[500px]">
                    <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg flex flex-col h-full rounded-3xl">
                        <CardHeader className="border-b border-slate-100 dark:border-white/5 flex flex-row items-center space-y-0 px-6 py-5 min-h-[76px]">
                            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Histórico de Ocorrências</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-4 flex-1 overflow-hidden flex flex-col p-4 sm:p-6 pr-2 sm:pr-4">
                            {loadingOc ? (
                                <div className="animate-pulse h-full bg-slate-100 dark:bg-white/5 rounded-2xl" />
                            ) : ocorrencias.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <p className="text-sm text-slate-400 italic text-center py-6">Nenhuma ocorrência registrada. Parabéns!</p>
                                </div>
                            ) : (
                                <div className="space-y-3 h-full overflow-y-auto custom-scrollbar pr-2 pb-2">
                                    {ocorrencias.map((o: any) => (
                                        <div key={o.id} className="relative p-4 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 rounded-2xl flex justify-between items-start overflow-hidden group hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                                            <div className="absolute left-0 top-0 bottom-0 w-1 bg-red-500" />

                                            <div className="pl-1 min-w-0 pr-4">
                                                <div className="flex flex-col md:flex-row md:items-center gap-2 mb-1">
                                                    <span className="font-bold text-sm text-slate-900 dark:text-white truncate block">{o.motivo}</span>
                                                    <span className={`text-[10px] px-2 py-0.5 rounded uppercase font-bold w-fit whitespace-nowrap ${o.gravidade === 'GRAVE' ? 'bg-red-100 dark:bg-red-500/10 text-red-600 dark:text-red-500' :
                                                        o.gravidade === 'MEDIA' ? 'bg-amber-100 dark:bg-amber-500/10 text-amber-600 dark:text-amber-500' :
                                                            'bg-slate-200 dark:bg-white/10 text-slate-600 dark:text-slate-400'
                                                        }`}>{o.gravidade || 'LEVE'}</span>
                                                </div>
                                                {o.descricao && <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-1.5">{o.descricao}</p>}
                                                <div className="text-[10px] text-slate-500 font-mono mt-2.5">
                                                    {new Date(o.data).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} • {o.cargo_na_epoca}
                                                    {o.supervisor && ` • Supervisor: ${o.supervisor}`}
                                                </div>
                                            </div>
                                            <div className="text-center shrink-0 flex flex-col items-center justify-center self-center bg-white dark:bg-[#0f172a] h-14 w-14 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm">
                                                <span className="block text-lg font-black text-red-500 dark:text-red-400 leading-none">{o.pontuacao}</span>
                                                <span className="text-[8px] uppercase font-bold text-slate-400 tracking-wider mt-0.5">Pts</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="flex flex-col h-[500px]">
                    <RemovalRequestsHistory />
                </div>
            </div>

            <FlagsHistory />

        </div>
    )
}
