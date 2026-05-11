"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Calculator, Briefcase, Star, AlertTriangle, FolderKanban, Calendar, TrendingUp, BarChart3 } from "lucide-react"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"

// Same constants as the API
const FIXED_VALUES: Record<string, number> = {
    'Consultor': 100,
    'Assessor': 100,
    'Gerente': 175,
    'Closer': 175,
    'Diretor': 200,
    'SDR': 100,
}

const VARIABLE_PER_PROJECT: Record<string, number> = {
    'Consultor': 15,
    'Assessor': 15,
    'SDR': 15,
    'Gerente': 5,
}

const LEVEL_BONUS: Record<string, number> = {
    'Júnior': 0,
    'Junior': 0,
    'Pleno': 15,
    'Sênior': 30,
    'Senior': 30,
}

const PUNISHMENT_PER_POINT = 10
const MAX_PER_PERSON = 300
const EXCLUSIVE_ROLES = ['Diretor', 'Closer', 'Gerente']
const NPS_THRESHOLD = 4
const NPS_BONUS_PERCENT = 0.10

export function PipjForecastCard() {
    const { colaborador, loading, colaboradorId } = useColaborador()
    const [absenceDays, setAbsenceDays] = useState(0)
    const [businessDays, setBusinessDays] = useState(22)
    const [latestNps, setLatestNps] = useState(0)
    const [emPlanoPunicao, setEmPlanoPunicao] = useState(false)

    useEffect(() => {
        async function fetchData() {
            const now = new Date()
            const mes = now.getMonth() + 1
            const ano = now.getFullYear()

            // Calculate business days
            let count = 0
            const daysInMonth = new Date(ano, mes, 0).getDate()
            for (let d = 1; d <= daysInMonth; d++) {
                const day = new Date(ano, mes - 1, d).getDay()
                if (day !== 0 && day !== 6) count++
            }
            setBusinessDays(count)

            // Fetch approved absences for this month
            const monthStart = `${ano}-${String(mes).padStart(2, '0')}-01`
            const monthEnd = `${ano}-${String(mes).padStart(2, '0')}-${daysInMonth}`

            const { data: ausencias } = await supabase
                .from('ausencias')
                .select('data_ida, data_volta')
                .eq('colaborador_id', colaboradorId)
                .eq('status', 'APROVADA')
                .lte('data_ida', monthEnd)
                .gte('data_volta', monthStart)

            if (ausencias) {
                let totalDays = 0
                for (const a of ausencias) {
                    const start = new Date(a.data_ida)
                    const end = new Date(a.data_volta)
                    const mStart = new Date(ano, mes - 1, 1)
                    const mEnd = new Date(ano, mes, 0)

                    const effectiveStart = start < mStart ? mStart : start
                    const effectiveEnd = end > mEnd ? mEnd : end

                    if (effectiveStart <= effectiveEnd) {
                        const current = new Date(effectiveStart)
                        while (current <= effectiveEnd) {
                            const day = current.getDay()
                            if (day !== 0 && day !== 6) totalDays++
                            current.setDate(current.getDate() + 1)
                        }
                    }
                }
                setAbsenceDays(totalDays)
            }

            // NPS = média do mês mais recente com avaliações (consistente com
            // wallet/performance-card, wallet/criteria-card e /performance).
            const { data: npsData } = await supabase
                .from('avaliacoes_nps')
                .select('nps_geral, mes, ano')
                .eq('colaborador_id', colaboradorId)
                .order('ano', { ascending: false })
                .order('mes', { ascending: false })
                .limit(12)

            if (npsData && npsData.length > 0) {
                const latest = npsData[0]
                const rows = npsData.filter(n => n.mes === latest.mes && n.ano === latest.ano)
                const avg = rows.reduce((s, n) => s + Number(n.nps_geral || 0), 0) / rows.length
                setLatestNps(avg)
            }

            // Check if user is in plano de punição
            const { data: punData } = await supabase
                .from('plano_punicao')
                .select('id')
                .eq('colaborador_id', colaboradorId)
                .eq('ativo', true)
                .limit(1)
            setEmPlanoPunicao((punData || []).length > 0)
        }
        if (colaboradorId) fetchData()
    }, [colaboradorId])

    if (loading) return <Card className="h-64 animate-pulse bg-slate-800 rounded-3xl border-none" />

    const cargo = colaborador?.cargo_atual || 'Assessor'
    const nivel = colaborador?.nivel_consultor || 'Júnior'
    const projetos = colaborador?.projetos || 0
    const pontosNegativos = colaborador?.pontos_negativos || 0

    // 1. Fixed base
    const baseCargo = FIXED_VALUES[cargo] || 100

    // 2. Variable per project
    const bonusProjetos = VARIABLE_PER_PROJECT[cargo] ? VARIABLE_PER_PROJECT[cargo] * projetos : 0

    // 3. Level bonus
    const bonusNivel = !EXCLUSIVE_ROLES.includes(cargo) ? (LEVEL_BONUS[nivel] || 0) : 0

    // 4. Punishment deduction
    const descontoPunicao = PUNISHMENT_PER_POINT * pontosNegativos

    // Subtotal before absence
    let subtotal = baseCargo + bonusProjetos + bonusNivel - descontoPunicao

    // 5. Absence deduction
    let descontoAusencia = 0
    if (absenceDays > 0 && businessDays > 0) {
        descontoAusencia = Math.round(((absenceDays / businessDays) * subtotal) * 100) / 100
    }

    // Subtotal after absence
    let subtotalAposAusencia = Math.max(0, subtotal - descontoAusencia)

    // 6. NPS Bonus (+10% if NPS > 4)
    const bonusNps = latestNps > NPS_THRESHOLD ? Math.round(subtotalAposAusencia * NPS_BONUS_PERCENT * 100) / 100 : 0

    // Final
    let previsao = Math.round((subtotalAposAusencia + bonusNps) * 100) / 100
    previsao = Math.min(previsao, MAX_PER_PERSON)

    // 7. Plano de Punição — zera PIPJ
    if (emPlanoPunicao) previsao = 0

    const items = [
        { label: "Base do Cargo", value: `+ R$ ${baseCargo.toFixed(2).replace('.', ',')}`, detail: cargo, icon: Briefcase, color: "text-blue-400" },
        { label: "Bônus Projetos", value: bonusProjetos > 0 ? `+ R$ ${bonusProjetos.toFixed(2).replace('.', ',')}` : "R$ 0,00", detail: `${projetos} projeto(s) × R$ ${VARIABLE_PER_PROJECT[cargo] || 0}`, icon: FolderKanban, color: "text-cyan-400" },
        { label: "Bônus Nível", value: bonusNivel > 0 ? `+ R$ ${bonusNivel.toFixed(2).replace('.', ',')}` : "R$ 0,00", detail: nivel, icon: Star, color: "text-amber-400" },
        { label: "Desc. Punições", value: descontoPunicao > 0 ? `- R$ ${descontoPunicao.toFixed(2).replace('.', ',')}` : "R$ 0,00", detail: `${pontosNegativos} pt(s) × R$ ${PUNISHMENT_PER_POINT}`, icon: AlertTriangle, color: descontoPunicao > 0 ? "text-red-400" : "text-slate-500" },
        { label: "Desc. Ausências", value: descontoAusencia > 0 ? `- R$ ${descontoAusencia.toFixed(2).replace('.', ',')}` : "R$ 0,00", detail: `${absenceDays} dia(s) de ${businessDays}`, icon: Calendar, color: descontoAusencia > 0 ? "text-red-400" : "text-slate-500" },
        { label: "Bônus NPS", value: bonusNps > 0 ? `+ R$ ${bonusNps.toFixed(2).replace('.', ',')}` : "R$ 0,00", detail: `NPS ${latestNps.toFixed(1)} ${latestNps > NPS_THRESHOLD ? '(> 4 → +10%)' : '(≤ 4)'}`, icon: BarChart3, color: bonusNps > 0 ? "text-emerald-400" : "text-slate-500" },
    ]

    const now = new Date()
    const months = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
    const periodoAtual = `${months[now.getMonth()]} ${now.getFullYear()}`

    return (
        <Card className="bg-gradient-to-br from-[#001a41] to-[#0a2a5e] text-white border-none shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="pb-3">
                <CardTitle className="font-display text-lg flex items-center gap-2">
                    <div className="bg-emerald-500/20 p-2 rounded-xl">
                        <Calculator className="w-5 h-5 text-emerald-400" />
                    </div>
                    Previsão PIPJ
                </CardTitle>
                <p className="text-xs text-blue-300 font-medium">{periodoAtual}</p>
            </CardHeader>
            <CardContent className="space-y-3">
                {/* Plano de Punição Warning */}
                {emPlanoPunicao && (
                    <div className="bg-rose-500/15 border border-rose-500/30 rounded-2xl p-3 flex items-start gap-2.5">
                        <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-xs font-bold text-rose-300 uppercase tracking-wider">Plano de Punição Ativo</p>
                            <p className="text-[11px] text-rose-400/80 mt-0.5">Você está em plano de punição. Seu PIPJ está zerado neste período.</p>
                        </div>
                    </div>
                )}

                {/* Forecast value */}
                <div className={`${emPlanoPunicao ? 'bg-rose-500/10 border border-rose-500/20' : 'bg-emerald-500/10 border border-emerald-500/20'} rounded-2xl p-4 text-center`}>
                    <div className="flex items-center justify-center gap-2 mb-1">
                        <TrendingUp className={`h-5 w-5 ${emPlanoPunicao ? 'text-rose-400' : 'text-emerald-400'}`} />
                        <span className={`text-xs font-bold uppercase tracking-wider ${emPlanoPunicao ? 'text-rose-300' : 'text-emerald-300'}`}>Valor Estimado</span>
                    </div>
                    <span className={`text-3xl font-display font-bold ${emPlanoPunicao ? 'text-rose-400' : 'text-emerald-400'}`}>
                        R$ {previsao.toFixed(2).replace('.', ',')}
                    </span>
                </div>

                {/* Breakdown */}
                <div className="space-y-2">
                    {items.map((item) => (
                        <div key={item.label} className="flex items-center justify-between bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 hover:bg-white/10 transition-colors">
                            <div className="flex items-center gap-2.5 min-w-0">
                                <item.icon className={`h-3.5 w-3.5 ${item.color} shrink-0`} />
                                <div className="min-w-0">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-blue-300">{item.label}</p>
                                    <p className="text-[10px] text-blue-400 truncate">{item.detail}</p>
                                </div>
                            </div>
                            <span className={`text-sm font-bold whitespace-nowrap ${item.value.startsWith('-') ? 'text-red-400' : 'text-white'}`}>
                                {item.value}
                            </span>
                        </div>
                    ))}
                </div>

                {previsao >= MAX_PER_PERSON && (
                    <p className="text-[10px] text-amber-300 text-center font-medium">
                        ⚠ Limitado ao teto máximo de R$ {MAX_PER_PERSON.toFixed(2).replace('.', ',')}
                    </p>
                )}
            </CardContent>
        </Card>
    )
}
