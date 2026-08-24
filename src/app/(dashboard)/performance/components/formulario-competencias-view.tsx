"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { mesReferenciaFromDate } from "@/lib/nps-period"
import { competenciaLabel } from "@/lib/forms-runtime"
import { isSchemaDesatualizado } from "@/lib/db-compat"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from "recharts"
import { MessageSquare, Zap, Award, FolderKanban, Star, TrendingUp } from "lucide-react"

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const METRIC_STYLES = [
    { icon: MessageSquare, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-500/10", stroke: "#8B5CF6" },
    { icon: Zap, color: "text-rose-500", bg: "bg-rose-50 dark:bg-rose-500/10", stroke: "#F43F5E" },
    { icon: Award, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-500/10", stroke: "#3B82F6" },
    { icon: MessageSquare, color: "text-indigo-500", bg: "bg-indigo-50 dark:bg-indigo-500/10", stroke: "#6366F1" },
    { icon: FolderKanban, color: "text-cyan-500", bg: "bg-cyan-50 dark:bg-cyan-500/10", stroke: "#06B6D4" },
    { icon: Zap, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-500/10", stroke: "#F59E0B" },
    { icon: Award, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-500/10", stroke: "#10B981" },
    { icon: FolderKanban, color: "text-fuchsia-500", bg: "bg-fuchsia-50 dark:bg-fuchsia-500/10", stroke: "#D946EF" },
    { icon: Star, color: "text-pink-500", bg: "bg-pink-50 dark:bg-pink-500/10", stroke: "#EC4899" },
    { icon: TrendingUp, color: "text-teal-500", bg: "bg-teal-50 dark:bg-teal-500/10", stroke: "#14B8A6" },
]

type Metric = { id: string; titulo: string }
type Avaliacao = { ano: number; mes: number; scores: Record<string, number> }

function avgOf(vals: number[]): number | null {
    if (vals.length === 0) return null
    return vals.reduce((a, b) => a + b, 0) / vals.length
}

interface Props {
    formularioId: string
    colaboradorId: string | undefined
    // Agrupa pelo mês de referência (mês anterior ao envio) em vez do mês do
    // envio. Usado pelo NPS Interno, que sempre avaliou o mês anterior.
    usarMesReferencia?: boolean
    emptyMessage?: string
}

// Visualização de competências de um formulário, do ponto de vista de quem
// FOI avaliado: cards por competência, média, evolução mensal e detalhamento.
// É a mesma leitura da aba de Performance, sem quantidade de projetos (que
// não faz sentido fora do NPS de Projetos).
//
// Aceita as duas formas de "sobre quem é a resposta" que existem no sistema:
// formulario_respostas.alvo_colaborador_id (formulários direcionados, ver
// src/lib/forms-publico.ts) e a resposta de uma pergunta do tipo
// colaborador_unico (modelo antigo, usado pelo Piloto de Elite/NPS Interno).
export function FormularioCompetenciasView({ formularioId, colaboradorId, usarMesReferencia, emptyMessage }: Props) {
    const [loading, setLoading] = useState(true)
    const [metrics, setMetrics] = useState<Metric[]>([])
    const [evaluations, setEvaluations] = useState<Avaliacao[]>([])

    useEffect(() => {
        if (!colaboradorId) { setLoading(false); return }

        async function fetchData() {
            setLoading(true)

            // `competencia` só passa a existir com a migração 20260825.
            // Enquanto ela não roda, pedir a coluna faz o PostgREST recusar a
            // leitura inteira, e a tela dizia "não tem perguntas de escala" —
            // escondendo todo o histórico já respondido. Sem a coluna,
            // competenciaLabel() cai de volta no título da pergunta.
            const perguntasQuery = (colunas: string) => supabase
                .from('formulario_perguntas')
                .select(colunas)
                .eq('formulario_id', formularioId)
                .order('ordem', { ascending: true })

            const perguntasComCompetencia = await perguntasQuery('id, tipo, titulo, competencia, ordem')
            const perguntas = isSchemaDesatualizado(perguntasComCompetencia.error)
                ? (await perguntasQuery('id, tipo, titulo, ordem')).data
                : perguntasComCompetencia.data

            const listaPerguntas = (perguntas || []) as unknown as { id: string, tipo: string, titulo: string, competencia?: string | null }[]
            const escalaPerguntas = listaPerguntas.filter(p => p.tipo === 'escala')
            const avaliadoPergunta = listaPerguntas.find(p => p.tipo === 'colaborador_unico')

            if (escalaPerguntas.length === 0) {
                setMetrics([]); setEvaluations([]); setLoading(false); return
            }

            setMetrics(escalaPerguntas.map(p => ({ id: p.id, titulo: competenciaLabel(p) })))

            // Mesmo raciocínio para `alvo_colaborador_id` (migração 20260824):
            // sem a coluna, restam as respostas do modelo antigo, em que quem
            // foi avaliado vem na pergunta do tipo colaborador_unico.
            const respostasQuery = (colunas: string) => supabase
                .from('formulario_respostas')
                .select(colunas)
                .eq('formulario_id', formularioId)
                .order('enviado_em', { ascending: true })

            const respostasComAlvo = await respostasQuery('id, enviado_em, alvo_colaborador_id, formulario_respostas_itens(pergunta_id, valor)')
            const respostasData = isSchemaDesatualizado(respostasComAlvo.error)
                ? (await respostasQuery('id, enviado_em, formulario_respostas_itens(pergunta_id, valor)')).data
                : respostasComAlvo.data
            const respostas = (respostasData || []) as unknown as { id: string, enviado_em: string, alvo_colaborador_id?: string | null }[]

            const evals: Avaliacao[] = []
            for (const r of respostas) {
                const items = (r as any).formulario_respostas_itens || []

                // A resposta é sobre o colaborador logado?
                let sobreMim = r.alvo_colaborador_id === colaboradorId
                if (!sobreMim && !r.alvo_colaborador_id && avaliadoPergunta) {
                    const it = items.find((i: any) => i.pergunta_id === avaliadoPergunta.id)
                    sobreMim = it?.valor === colaboradorId
                }
                if (!sobreMim) continue

                const scores: Record<string, number> = {}
                for (const ep of escalaPerguntas) {
                    const it = items.find((i: any) => i.pergunta_id === ep.id)
                    const v = Number(it?.valor)
                    if (it && !isNaN(v)) scores[ep.id] = v
                }

                const d = new Date(r.enviado_em)
                const { mes, ano } = usarMesReferencia
                    ? mesReferenciaFromDate(r.enviado_em)
                    : { mes: d.getMonth() + 1, ano: d.getFullYear() }
                evals.push({ ano, mes, scores })
            }

            setEvaluations(evals)
            setLoading(false)
        }
        fetchData()
    }, [formularioId, colaboradorId, usarMesReferencia])

    const sorted = [...evaluations].sort((a, b) => (b.ano - a.ano) || (b.mes - a.mes))
    const latest = sorted[0]
    const latestMonthEvals = latest ? sorted.filter(e => e.ano === latest.ano && e.mes === latest.mes) : []
    const ultimoMesLabel = latest ? `${MESES[latest.mes - 1]}/${latest.ano}` : '—'

    const avgMetric = (metricId: string): string => {
        const vals = latestMonthEvals.map(e => e.scores[metricId]).filter(v => v !== undefined && !isNaN(v))
        const a = avgOf(vals)
        return a === null ? '—' : a.toFixed(1)
    }

    const mediaGeral = (): string => {
        const allVals: number[] = []
        latestMonthEvals.forEach(e => metrics.forEach(m => {
            const v = e.scores[m.id]
            if (v !== undefined && !isNaN(v)) allVals.push(v)
        }))
        const a = avgOf(allVals)
        return a === null ? '—' : a.toFixed(1)
    }

    const groups = new Map<string, Avaliacao[]>()
    for (const e of evaluations) {
        const key = `${e.ano}-${String(e.mes).padStart(2, '0')}`
        if (!groups.has(key)) groups.set(key, [])
        groups.get(key)!.push(e)
    }
    const chartData = Array.from(groups.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([key, evs]) => {
            const [ano, mes] = key.split('-').map(Number)
            const point: any = { name: `${MESES_CURTOS[mes - 1]}/${ano}` }
            for (const m of metrics) {
                const vals = evs.map(e => e.scores[m.id]).filter(v => v !== undefined && !isNaN(v))
                const a = avgOf(vals)
                point[m.titulo] = a === null ? null : Number(a.toFixed(2))
            }
            return point
        })

    if (loading) {
        return <div className="p-8 text-center text-slate-400 text-sm">Carregando avaliações...</div>
    }

    if (metrics.length === 0) {
        return (
            <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
                <CardContent className="p-10 text-center text-slate-400">
                    <Star className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="font-semibold text-sm">Este formulário ainda não tem perguntas de escala.</p>
                    <p className="text-xs mt-1 max-w-md mx-auto">Adicione perguntas do tipo &quot;Escala (1-5)&quot; e defina a competência de cada uma em Gestão de Formulários.</p>
                </CardContent>
            </Card>
        )
    }

    if (evaluations.length === 0) {
        return (
            <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
                <CardContent className="p-10 text-center text-slate-400">
                    <Star className="h-8 w-8 mx-auto mb-3 opacity-30" />
                    <p className="font-semibold text-sm">{emptyMessage || 'Você ainda não recebeu avaliações neste formulário.'}</p>
                    <p className="text-xs mt-1 max-w-md mx-auto">Assim que seus colegas avaliarem você, suas competências aparecerão aqui automaticamente.</p>
                </CardContent>
            </Card>
        )
    }

    return (
        <div className="space-y-6">
            {/* Cards por competência */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {metrics.map((m, idx) => {
                    const style = METRIC_STYLES[idx % METRIC_STYLES.length]
                    const Icon = style.icon
                    return (
                        <div key={m.id} className="bg-white dark:bg-[#0F172A] p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-none">
                            <div className="flex items-center gap-3 mb-3">
                                <div className={`p-2 rounded-xl ${style.bg}`}>
                                    <Icon className={`h-4 w-4 ${style.color}`} />
                                </div>
                                <p className="text-xs font-bold uppercase text-slate-400 tracking-wider line-clamp-2">{m.titulo}</p>
                            </div>
                            <div className={`text-3xl font-display font-bold ${style.color}`}>{avgMetric(m.id)}</div>
                            <p className="text-xs text-slate-500 mt-1.5 font-medium">{latestMonthEvals.length} aval. em {ultimoMesLabel}</p>
                        </div>
                    )
                })}
            </div>

            {/* Stats gerais (sem quantidade de projetos) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <CardStat title="Média Geral" value={mediaGeral()} trend={`${latestMonthEvals.length} aval. em ${ultimoMesLabel}`} color="text-green-500" />
                <CardStat title="Total Avaliações" value={String(evaluations.length)} trend="Recebidas neste formulário" color="text-blue-500" />
                <CardStat title="Competências Avaliadas" value={String(metrics.length)} trend="Perguntas de escala do formulário" color="text-violet-500" />
            </div>

            {/* Evolução no tempo */}
            <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
                <CardHeader>
                    <CardTitle className="font-display">Evolução das Competências</CardTitle>
                    <CardDescription>Acompanhamento mensal das avaliações recebidas (média de todas as avaliações do mês)</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="h-[340px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                                <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                                <YAxis domain={[0, 5]} stroke="#888888" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: '13px' }} cursor={{ stroke: '#8B5CF6', strokeWidth: 2 }} />
                                <Legend wrapperStyle={{ fontSize: '12px', fontWeight: 600, paddingTop: '12px' }} />
                                {metrics.map((m, idx) => {
                                    const style = METRIC_STYLES[idx % METRIC_STYLES.length]
                                    return (
                                        <Line key={m.id} type="monotone" dataKey={m.titulo} stroke={style.stroke} strokeWidth={2.5} dot={{ r: 4, fill: style.stroke }} activeDot={{ r: 6 }} connectNulls />
                                    )
                                })}
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </CardContent>
            </Card>

            {/* Detalhamento por competência */}
            <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
                <CardHeader>
                    <CardTitle className="font-display">Detalhamento por Competência</CardTitle>
                    <CardDescription>Média de cada competência por mês (entre parênteses, o nº de avaliações que compõem a média)</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm border-separate border-spacing-0">
                            <thead>
                                <tr className="text-left">
                                    <th className="sticky left-0 z-10 bg-white dark:bg-[#0F172A] py-3 px-3 text-xs font-bold uppercase text-slate-400 tracking-wider border-b border-slate-100 dark:border-slate-800">Mês</th>
                                    <th className="py-3 px-3 text-xs font-bold uppercase text-violet-500 tracking-wider whitespace-nowrap border-b border-slate-100 dark:border-slate-800">Média Geral</th>
                                    {metrics.map(m => (
                                        <th key={m.id} className="py-3 px-3 text-xs font-bold uppercase text-slate-400 tracking-wider whitespace-nowrap border-b border-slate-100 dark:border-slate-800">{m.titulo}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {Array.from(groups.entries())
                                    .sort((a, b) => b[0].localeCompare(a[0]))
                                    .slice(0, 12)
                                    .map(([key, evs]) => {
                                        const [ano, mes] = key.split('-').map(Number)
                                        const monthVals: number[] = []
                                        evs.forEach(e => metrics.forEach(m => {
                                            const v = e.scores[m.id]
                                            if (v !== undefined && !isNaN(v)) monthVals.push(v)
                                        }))
                                        const monthAvg = avgOf(monthVals)
                                        const monthAvgColor = monthAvg === null ? 'text-slate-400' : monthAvg >= 4.5 ? 'text-emerald-500' : monthAvg >= 3.5 ? 'text-amber-500' : 'text-rose-500'
                                        return (
                                            <tr key={key} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                                                <td className="sticky left-0 z-10 bg-white dark:bg-[#0F172A] py-3 px-3 font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap border-b border-slate-50 dark:border-slate-800/50">
                                                    {MESES[mes - 1]}/{ano}
                                                    <span className="text-slate-400 font-normal ml-1.5">({evs.length} aval.)</span>
                                                </td>
                                                <td className={`py-3 px-3 font-extrabold ${monthAvgColor} border-b border-slate-50 dark:border-slate-800/50`}>{monthAvg === null ? '—' : monthAvg.toFixed(1)}</td>
                                                {metrics.map(m => {
                                                    const vals = evs.map(e => e.scores[m.id]).filter(v => v !== undefined && !isNaN(v))
                                                    const a = avgOf(vals)
                                                    const display = a === null ? '—' : a.toFixed(1)
                                                    const color = a === null ? 'text-slate-400' : a >= 4.5 ? 'text-emerald-500' : a >= 3.5 ? 'text-amber-500' : 'text-rose-500'
                                                    return <td key={m.id} className={`py-3 px-3 font-bold ${color} border-b border-slate-50 dark:border-slate-800/50`}>{display}</td>
                                                })}
                                            </tr>
                                        )
                                    })}
                            </tbody>
                        </table>
                    </div>
                </CardContent>
            </Card>
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
