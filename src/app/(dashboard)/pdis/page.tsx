"use client"
import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Target, Clock, ArrowRight } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useColaborador } from "@/hooks/use-supabase"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const STATUS_MAP: Record<string, { label: string; className: string }> = {
    'Em Dia': { label: 'Em Dia', className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
    'Atrasado': { label: 'Atrasado', className: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' },
    'Finalizando': { label: 'Finalizando', className: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' },
    'Concluído': { label: 'Concluído', className: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400' },
}

export default function MyPdisPage() {
    const { colaboradorId } = useColaborador()
    const [plans, setPlans] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!colaboradorId) return;

        async function fetchPlans() {
            setLoading(true)
            const { data } = await supabase
                .from('pdi_planos')
                .select('*')
                .eq('colaborador_id', colaboradorId)
                .order('created_at', { ascending: false })

            if (data) setPlans(data)
            setLoading(false)
        }
        fetchPlans()
    }, [colaboradorId])

    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center gap-3 mb-2">
                <div className="bg-cyan-50 dark:bg-cyan-500/10 p-2.5 rounded-2xl border border-cyan-100 dark:border-cyan-500/20">
                    <Target className="h-6 w-6 text-cyan-600 dark:text-cyan-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Meus PDIs</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Acompanhe o seu desenvolvimento e capacitações.
                    </p>
                </div>
            </div>

            {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map(i => <div key={i} className="h-48 bg-slate-100 dark:bg-slate-800 rounded-3xl animate-pulse" />)}
                </div>
            ) : plans.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-100 dark:border-slate-800/50">
                    <Target className="h-12 w-12 text-slate-300 mb-4" />
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Nenhum PDI Atribuído</h3>
                    <p className="text-sm text-slate-500 text-center max-w-sm">Você ainda não possui nenhum Plano de Desenvolvimento Individual cadastrado. Converse com sua liderança.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {plans.map((plan) => {
                        const progresso = Math.round(plan.progresso || 0)

                        let computedStatus = plan.status || 'Em Dia';
                        if (progresso === 100) {
                            computedStatus = 'Concluído';
                        } else if (plan.data_prazo && new Date(plan.data_prazo) < new Date()) {
                            computedStatus = 'Atrasado';
                        } else if (progresso >= 80) {
                            computedStatus = 'Finalizando';
                        } else {
                            computedStatus = 'Em Dia';
                        }

                        const status = STATUS_MAP[computedStatus] || STATUS_MAP['Em Dia']

                        return (
                            <Card key={plan.id} className="border-slate-100 dark:border-slate-800/50 shadow-lg bg-white dark:bg-[#0F172A] rounded-3xl flex flex-col hover:border-cyan-500/30 transition-colors group">
                                <CardContent className="p-6 flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${status.className}`}>
                                            {status.label}
                                        </div>
                                        {plan.data_prazo && (
                                            <div className="flex items-center text-[10px] text-slate-500 dark:text-slate-400 font-medium bg-slate-50 dark:bg-white/5 px-2 py-1 rounded-lg">
                                                <Clock className="w-3 h-3 mr-1" />
                                                Prazo: {new Date(plan.data_prazo).toLocaleDateString('pt-BR')}
                                            </div>
                                        )}
                                    </div>

                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white capitalize-first line-clamp-2 mb-2">
                                        {plan.titulo.toLowerCase()}
                                    </h3>

                                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-6 flex-1">
                                        {plan.descricao}
                                    </p>

                                    <div className="space-y-4 mt-auto">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center text-sm font-bold">
                                                <span className="text-slate-700 dark:text-slate-300">Progresso</span>
                                                <span className="text-cyan-600 dark:text-cyan-400">{progresso}%</span>
                                            </div>
                                            <Progress value={progresso} className="h-2 bg-slate-100 dark:bg-slate-800" indicatorClassName={
                                                progresso === 100 ? "bg-emerald-500" :
                                                    computedStatus === 'Atrasado' ? "bg-rose-500" : "bg-cyan-500"
                                            } />
                                        </div>

                                        <Button asChild className="w-full bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200 text-white rounded-xl font-bold group-hover:bg-cyan-600 dark:group-hover:bg-cyan-500 dark:group-hover:text-white group-hover:text-white transition-colors">
                                            <Link href={`/pdis/${plan.id}`}>
                                                Acessar Módulo
                                                <ArrowRight className="w-4 h-4 ml-2" />
                                            </Link>
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
