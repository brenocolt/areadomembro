"use client"
import { Button } from "@/components/ui/button"
import { Ticket, TrendingUp, Gift } from "lucide-react"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"
import { RedeemRewardsDialog } from "./redeem-rewards-dialog"

export function MilhasHero() {
    const { colaboradorId } = useColaborador()
    const [saldo, setSaldo] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetch() {
            const { data } = await supabase
                .from('milhas_saldo')
                .select('*')
                .eq('colaborador_id', colaboradorId)
                .single()
            if (data) setSaldo(data)
            setLoading(false)
        }
        if (colaboradorId) fetch()
    }, [colaboradorId])

    return (
        <div className="relative overflow-hidden rounded-3xl bg-slate-950 p-8 text-white shadow-xl dark:bg-slate-900">
            {/* Background Pattern */}
            <div className="absolute right-0 top-0 h-full w-1/2 opacity-5 pointer-events-none">
                <Ticket className="h-full w-full -rotate-12 transform scale-150 text-white" strokeWidth={1} />
            </div>

            <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div className="space-y-4">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Saldo Atual Disponível</p>
                    <div className="flex items-baseline gap-2">
                        <span className="font-display text-6xl font-bold tracking-tight">
                            {loading ? '...' : new Intl.NumberFormat('pt-BR').format(saldo?.saldo_disponivel || 0)}
                        </span>
                        <span className="text-xl font-medium text-cyan-400">MILHAS</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="flex items-center gap-2 rounded-lg bg-green-500/10 px-3 py-1.5 text-green-400 border border-green-500/20 w-fit">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span className="text-xs font-bold">
                            +{new Intl.NumberFormat('pt-BR').format(saldo?.milhas_mes_atual || 0)} Milhas este mês
                        </span>
                    </div>
                    <p className="text-[10px] text-slate-500 italic">
                        Atualizado em {saldo?.updated_at ? new Date(saldo.updated_at).toLocaleDateString('pt-BR') : '—'}
                    </p>
                </div>

                <div className="md:ml-auto">
                    <RedeemRewardsDialog>
                        <Button
                            size="lg"
                            className="bg-white text-slate-900 hover:bg-slate-100 font-bold w-full md:w-auto shadow-lg shadow-white/5"
                        >
                            <Gift className="mr-2 h-4 w-4" />
                            Resgatar Recompensas
                        </Button>
                    </RedeemRewardsDialog>
                </div>
            </div>
        </div>
    )
}
