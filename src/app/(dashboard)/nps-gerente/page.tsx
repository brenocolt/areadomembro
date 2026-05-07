"use client"

import { NPSGerenteChart } from "./components/nps-gerente-chart"
import { NPSGerenteDetails } from "./components/nps-gerente-details"
import { useColaborador, useSupabaseQuery } from "@/hooks/use-supabase"
import { MessageSquare, HeartHandshake, LifeBuoy, Crown, ShieldAlert, Star } from "lucide-react"
import { ImportNpsDialog } from "@/components/import-nps-dialog"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"

export default function NPSGerentePage() {
    const { colaborador, colaboradorId, loading: loadingColab } = useColaborador()
    const { data: session } = useSession()
    const router = useRouter()
    const userRole = (session?.user as any)?.role
    const isAdmin = userRole === 'ADMIN'
    const cargoAtual = (colaborador?.cargo_atual || '').toLowerCase()
    const isGerente = cargoAtual.includes('gerente')
    const isAdministrador = cargoAtual.includes('administrador') || cargoAtual.includes('diretor')

    const { data: npsData } = useSupabaseQuery<any>('avaliacoes_nps', {
        column: 'colaborador_id',
        value: colaboradorId,
        orderBy: 'ano',
        ascending: false,
        limit: 12,
        select: 'mes, ano, nps_geral, comunicacao, suporte, lideranca, relacionamento, resolutividade, tipo_avaliacao'
    })

    if (!loadingColab && !isAdmin && !isGerente && !isAdministrador) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
                <div className="bg-rose-50 dark:bg-rose-500/10 p-4 rounded-2xl mb-4">
                    <ShieldAlert className="h-10 w-10 text-rose-500" />
                </div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Acesso Restrito</h2>
                <p className="text-sm text-slate-500 max-w-md">
                    Esta página é exclusiva para gerentes. Caso acredite que deveria ter acesso, entre em contato com a administração.
                </p>
                <button
                    onClick={() => router.push('/')}
                    className="mt-6 px-4 py-2 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/90 transition-colors"
                >
                    Voltar ao Início
                </button>
            </div>
        )
    }

    // Only show gerente-type evaluations on this page
    const gerenteNpsData = npsData.filter((n: any) => n.tipo_avaliacao === 'gerente')

    const avg = (field: string) => {
        if (gerenteNpsData.length === 0) return '—'
        return (gerenteNpsData.reduce((sum: number, n: any) => sum + Number(n[field] || 0), 0) / gerenteNpsData.length).toFixed(1)
    }

    // Média NPS do último mês com avaliações
    const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
    const sortedByPeriod = [...gerenteNpsData].sort((a: any, b: any) => (b.ano - a.ano) || (b.mes - a.mes))
    const ultimoPeriodo = sortedByPeriod[0]
    const ultimoMesData = ultimoPeriodo
        ? gerenteNpsData.filter((n: any) => n.mes === ultimoPeriodo.mes && n.ano === ultimoPeriodo.ano)
        : []
    const mediaUltimoMes = ultimoMesData.length === 0
        ? '—'
        : (ultimoMesData.reduce((s: number, n: any) => s + Number(n.nps_geral || 0), 0) / ultimoMesData.length).toFixed(1)
    const ultimoMesLabel = ultimoPeriodo ? `${MESES[ultimoPeriodo.mes - 1]}/${ultimoPeriodo.ano}` : 'Sem dados'

    const metrics = [
        { title: "Comunicação", value: avg('comunicacao'), icon: MessageSquare, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-500/10" },
        { title: "Suporte", value: avg('suporte'), icon: LifeBuoy, color: "text-cyan-500", bg: "bg-cyan-50 dark:bg-cyan-500/10" },
        { title: "Relacionamento", value: avg('relacionamento'), icon: HeartHandshake, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
        { title: "Liderança", value: avg('lideranca'), icon: Crown, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
        { title: "Resolutividade", value: avg('resolutividade'), icon: ShieldAlert, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-500/10" },
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center text-sm text-muted-foreground">
                    <span>Dashboard</span>
                    <span className="mx-2">›</span>
                    <span className="font-semibold text-primary dark:text-white">NPS Gerente</span>
                </div>
                <ImportNpsDialog />
            </div>

            <div className="bg-white dark:bg-[#0F172A] p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-none">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-500/10">
                        <Star className="h-4 w-4 text-amber-500" />
                    </div>
                    <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">Média NPS — Último Mês</p>
                </div>
                <div className="flex items-end gap-3">
                    <span className={`text-4xl font-display font-bold ${Number(mediaUltimoMes) >= 4.5 ? 'text-emerald-500' : Number(mediaUltimoMes) >= 3.5 ? 'text-amber-500' : 'text-rose-500'}`}>{mediaUltimoMes}</span>
                    <span className="text-xs text-slate-500 mb-1.5 font-medium">/5 · {ultimoMesData.length} avaliação{ultimoMesData.length !== 1 ? 'ões' : ''} em {ultimoMesLabel}</span>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                {metrics.map((m) => (
                    <div key={m.title} className="bg-white dark:bg-[#0F172A] p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-none">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2 rounded-xl ${m.bg}`}>
                                <m.icon className={`h-4 w-4 ${m.color}`} />
                            </div>
                            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">{m.title}</p>
                        </div>
                        <div className={`text-3xl font-display font-bold ${m.color}`}>{m.value}</div>
                        <p className="text-xs text-slate-500 mt-1.5 font-medium">{gerenteNpsData.length} avaliações</p>
                    </div>
                ))}
            </div>

            <NPSGerenteChart />

            <NPSGerenteDetails />
        </div>
    )
}
