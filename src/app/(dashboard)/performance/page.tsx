"use client"

import { useState, useEffect } from "react"
import { NPSChart } from "./components/nps-chart";
import { DetailedPerformance } from "./components/detailed-performance";
import { FormularioCompetenciasView } from "./components/formulario-competencias-view";
import { useColaborador, useSupabaseQuery } from "@/hooks/use-supabase";
import { ImportNpsDialog } from "@/components/import-nps-dialog";
import { supabase } from "@/lib/supabase";
import { colaboradorNoPublico, type PublicoPar } from "@/lib/forms-publico";
import { MessageSquare, FolderKanban, Zap, Award } from "lucide-react"

// Sub-abas fixas: a visualização histórica de Performance (NPS Projetos) e o
// NPS Interno, que antes era uma página própria. As demais sub-abas vêm de
// formulários direcionados marcados com "Criar sub-aba" em Gestão de
// Formulários — ver formularios.gerar_subaba e src/lib/forms-publico.ts.
const TAB_NPS_PROJETOS = '__nps_projetos__'
const TAB_NPS_INTERNO = '__nps_interno__'

type SubAba = { id: string; titulo: string }

export default function PerformancePage() {
    const { colaboradorId, colaborador } = useColaborador()
    const [activeTab, setActiveTab] = useState<string>(TAB_NPS_PROJETOS)
    const [subAbas, setSubAbas] = useState<SubAba[]>([])
    const [npsInternoFormId, setNpsInternoFormId] = useState<string | null>(null)

    useEffect(() => {
        if (!colaborador) return

        async function carregarSubAbas() {
            // NPS Interno = formulário "Piloto de Elite" (mesma heurística que
            // a antiga página /nps-interno usava).
            const { data: piloto } = await supabase
                .from('formularios')
                .select('id')
                .or('titulo.ilike.%piloto%,titulo.ilike.%elite%')
                .limit(1)
            setNpsInternoFormId(piloto && piloto.length > 0 ? piloto[0].id : null)

            // Formulários que pediram sub-aba. A aba aparece para quem está no
            // público de "Quem Recebe" — ou seja, para quem é avaliado ali,
            // mesmo antes da primeira avaliação chegar.
            const { data: forms } = await supabase
                .from('formularios')
                .select('id, titulo')
                .eq('gerar_subaba', true)
                .order('created_at', { ascending: true })

            if (!forms || forms.length === 0) { setSubAbas([]); return }

            const { data: recebeRows } = await supabase
                .from('formulario_publico_recebe')
                .select('formulario_id, cargo, nucleo')
                .in('formulario_id', forms.map(f => f.id))

            const recebeByForm = new Map<string, PublicoPar[]>()
            for (const r of recebeRows || []) {
                const arr = recebeByForm.get(r.formulario_id) || []
                arr.push({ cargo: r.cargo, nucleo: r.nucleo })
                recebeByForm.set(r.formulario_id, arr)
            }

            setSubAbas(forms
                .filter(f => {
                    const recebe = recebeByForm.get(f.id) || []
                    // Sem público de "Quem Recebe" não há sobre quem avaliar.
                    return recebe.length > 0 && colaboradorNoPublico(colaborador, recebe)
                })
                .map(f => ({ id: f.id, titulo: f.titulo })))
        }
        carregarSubAbas()
    }, [colaborador])

    const tabs: SubAba[] = [
        { id: TAB_NPS_PROJETOS, titulo: 'NPS Projetos' },
        ...(npsInternoFormId ? [{ id: TAB_NPS_INTERNO, titulo: 'NPS Interno' }] : []),
        ...subAbas,
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center text-sm text-muted-foreground">
                    <span>Dashboard</span>
                    <span className="mx-2">›</span>
                    <span className="font-semibold text-primary dark:text-white">Performance &amp; NPS</span>
                </div>
                {activeTab === TAB_NPS_PROJETOS && <ImportNpsDialog />}
            </div>

            {/* Barra de sub-abas */}
            {tabs.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-3">
                    {tabs.map(t => (
                        <button
                            key={t.id}
                            onClick={() => setActiveTab(t.id)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
                                activeTab === t.id
                                    ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/20'
                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:text-violet-700 dark:hover:text-violet-300'
                            }`}
                        >
                            {t.titulo}
                        </button>
                    ))}
                </div>
            )}

            {activeTab === TAB_NPS_PROJETOS && <NpsProjetosTab />}

            {activeTab === TAB_NPS_INTERNO && npsInternoFormId && (
                <FormularioCompetenciasView
                    formularioId={npsInternoFormId}
                    colaboradorId={colaboradorId}
                    usarMesReferencia
                    emptyMessage="Você ainda não recebeu avaliações no NPS Interno."
                />
            )}

            {subAbas.some(s => s.id === activeTab) && (
                <FormularioCompetenciasView
                    key={activeTab}
                    formularioId={activeTab}
                    colaboradorId={colaboradorId}
                />
            )}
        </div>
    )
}

// Visualização histórica de Performance (avaliacoes_nps), preservada como a
// sub-aba "NPS Projetos".
function NpsProjetosTab() {
    const { colaboradorId, colaborador } = useColaborador()
    const { data: npsData } = useSupabaseQuery<any>('avaliacoes_nps', {
        column: 'colaborador_id',
        value: colaboradorId,
        orderBy: 'ano',
        ascending: false,
        limit: 50,
        select: 'mes, ano, nps_geral, comunicacao, dedicacao, confianca, pontualidade, organizacao, proatividade, qualidade_entregas, dominio_tecnico'
    })

    const MESES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
    const sorted = [...npsData].sort((a: any, b: any) => (b.ano - a.ano) || (b.mes - a.mes))
    const latest = sorted[0]
    const latestMonthRows = latest ? sorted.filter((n: any) => n.mes === latest.mes && n.ano === latest.ano) : []
    const ultimoMesLabel = latest ? `${MESES[latest.mes - 1]}/${latest.ano}` : '—'

    const avg = (field: string) => {
        if (latestMonthRows.length === 0) return '—'
        return (latestMonthRows.reduce((sum: number, n: any) => sum + Number(n[field] || 0), 0) / latestMonthRows.length).toFixed(1)
    }

    const projetos = colaborador?.projetos || 0

    const metrics = [
        { title: "Comunicação", value: avg('comunicacao'), icon: MessageSquare, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-500/10" },
        { title: "Dedicação", value: avg('dedicacao'), icon: Zap, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-500/10" },
        { title: "Confiança", value: avg('confianca'), icon: Award, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10" },
        { title: "Pontualidade", value: avg('pontualidade'), icon: MessageSquare, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-500/10" },
        { title: "Organização", value: avg('organizacao'), icon: FolderKanban, color: "text-cyan-500", bg: "bg-cyan-50 dark:bg-cyan-500/10" },
        { title: "Proatividade", value: avg('proatividade'), icon: Zap, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10" },
        { title: "Qualidade", value: avg('qualidade_entregas'), icon: Award, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10" },
        { title: "Domínio Téc.", value: avg('dominio_tecnico'), icon: FolderKanban, color: "text-fuchsia-500", bg: "bg-fuchsia-50 dark:bg-fuchsia-500/10" },
    ]

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-4 gap-4">
                {metrics.map((m) => (
                    <div key={m.title} className="bg-white dark:bg-[#0F172A] p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-none">
                        <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2 rounded-xl ${m.bg}`}>
                                <m.icon className={`h-4 w-4 ${m.color}`} />
                            </div>
                            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">{m.title}</p>
                        </div>
                        <div className={`text-3xl font-display font-bold ${m.color}`}>{m.value}</div>
                        <p className="text-xs text-slate-500 mt-1.5 font-medium">{latestMonthRows.length} aval. em {ultimoMesLabel}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <CardStat title="Média Geral" value={avg('nps_geral')} trend={`${latestMonthRows.length} aval. em ${ultimoMesLabel}`} color="text-green-500" />
                <CardStat title="Total Avaliações" value={String(npsData.length)} trend="Registradas no sistema" color="text-blue-500" />
                <CardStat title="Projetos Alocados" value={String(projetos)} trend={`Impacta no cálculo de PIPJ (+R$${projetos > 0 ? (15 * projetos) : 0}/mês)`} color="text-violet-500" />
            </div>

            <NPSChart />

            <DetailedPerformance />
        </div>
    )
}

function CardStat({ title, value, trend, color }: { title: string, value: string, trend: string, color: string }) {
    return (
        <div className="bg-white dark:bg-[#0F172A] p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-none">
            <p className="text-xs font-bold uppercase text-slate-400 tracking-wider">{title}</p>
            <div className={`text-4xl font-display font-bold mt-2 ${color}`}>{value}</div>
            <p className="text-xs text-slate-500 mt-2 font-medium">{trend}</p>
        </div>
    )
}
