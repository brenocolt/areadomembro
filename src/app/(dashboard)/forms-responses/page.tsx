"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { FileText, Users, Star, MessageSquare, Calendar, ChevronDown, ChevronUp, BarChart3, AlertCircle, Download } from "lucide-react"
import { FormResponsesDashboard } from "../forms-management/components/form-responses-dashboard"
import { Button } from "@/components/ui/button"

export default function FormsResponsesPage() {
    const [formularios, setFormularios] = useState<any[]>([])
    const [selectedFormId, setSelectedFormId] = useState<string | 'nps_projeto' | null>(null)
    const [loading, setLoading] = useState(true)

    // NPS Projeto State
    const [npsLoading, setNpsLoading] = useState(false)
    const [npsRespostas, setNpsRespostas] = useState<any[]>([])
    const [usuariosMap, setUsuariosMap] = useState<Record<string, string>>({})
    const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({})

    const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

    useEffect(() => {
        async function fetchForms() {
            setLoading(true)
            const { data } = await supabase
                .from('formularios')
                .select('id, titulo')
                .order('created_at', { ascending: false })

            if (data) {
                setFormularios(data)
                // Auto select first form or NPS by default
                if (data.length > 0) {
                    setSelectedFormId('nps_projeto') // Default priority
                }
            }
            setLoading(false)
        }
        fetchForms()
    }, [])

    useEffect(() => {
        if (selectedFormId === 'nps_projeto') {
            fetchNps()
        }
    }, [selectedFormId])

    async function fetchNps() {
        setNpsLoading(true)
        const { data } = await supabase
            .from('avaliacoes_nps')
            .select('*, colaboradores(nome)')
            .order('created_at', { ascending: false })

        if (data) {
            setNpsRespostas(data)

            // Buscar nomes dos avaliadores
            const avaliadorIds = Array.from(new Set(data.map(d => d.avaliador_id).filter(Boolean)))
            if (avaliadorIds.length > 0) {
                const { data: avaliadores } = await supabase
                    .from('colaboradores')
                    .select('id, nome')
                    .in('id', avaliadorIds)

                if (avaliadores) {
                    const map: Record<string, string> = {}
                    avaliadores.forEach(a => map[a.id] = a.nome)
                    setUsuariosMap(map)
                }
            }

            if (data.length > 0) {
                const firstDate = new Date(data[0].created_at)
                const key = `${firstDate.getFullYear()}-${firstDate.getMonth()}`
                setExpandedMonths({ [key]: true })
            }
        }
        setNpsLoading(false)
    }

    const toggleMonth = (key: string) => {
        setExpandedMonths(prev => ({ ...prev, [key]: !prev[key] }))
    }

    // Grouping NPS exactly like we group Form Responses
    const groupedNps: Record<string, any[]> = {}
    npsRespostas.forEach(r => {
        const date = new Date(r.created_at)
        const key = `${date.getFullYear()}-${date.getMonth()}`
        if (!groupedNps[key]) groupedNps[key] = []
        groupedNps[key].push(r)
    })

    const sortedNpsKeys = Object.keys(groupedNps).sort((a, b) => {
        const [ya, ma] = a.split('-').map(Number)
        const [yb, mb] = b.split('-').map(Number)
        return yb * 12 + mb - (ya * 12 + ma)
    })

    // PDF generation function
    function generatePDF() {
        const selectedFormTitle = selectedFormId === 'nps_projeto'
            ? 'NPS Projeto'
            : formularios.find(f => f.id === selectedFormId)?.titulo || 'Formulário'

        let htmlContent = ''

        if (selectedFormId === 'nps_projeto') {
            // Build NPS content
            htmlContent = sortedNpsKeys.map(key => {
                const [year, monthIdx] = key.split('-').map(Number)
                const monthRespostas = groupedNps[key]
                const monthLabel = `${MESES[monthIdx]} ${year}`

                let promotores = 0, detratores = 0, neutros = 0
                monthRespostas.forEach(r => {
                    if (r.nps_geral >= 4.5) promotores++
                    else if (r.nps_geral <= 3.5) detratores++
                    else neutros++
                })
                const npsScore = Math.round(((promotores - detratores) / monthRespostas.length) * 100)

                const rows = monthRespostas.map(r => {
                    const sendDate = new Date(r.created_at)
                    const dateStr = sendDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                    const authorName = r.colaboradores?.nome || 'Anônimo'
                    const respondidoPor = usuariosMap[r.avaliador_id] || 'Desconhecido'
                    return `<tr>
                        <td>${authorName}</td>
                        <td>${respondidoPor}</td>
                        <td style="text-align:center;font-weight:bold;color:${r.nps_geral >= 4.5 ? '#10b981' : r.nps_geral <= 3.5 ? '#ef4444' : '#f59e0b'}">${Number(r.nps_geral).toFixed(1)}/5</td>
                        <td>${dateStr}</td>
                        <td>${r.feedback_texto || '—'}</td>
                    </tr>`
                }).join('')

                return `
                    <div class="month-section">
                        <h2>${monthLabel} — NPS: ${npsScore} (P: ${promotores}, N: ${neutros}, D: ${detratores})</h2>
                        <table>
                            <thead><tr><th>Avaliado</th><th>Respondido por</th><th>Nota</th><th>Data</th><th>Feedback</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                `
            }).join('')
        } else {
            // For regular forms, we render the visible content area
            htmlContent = `<p style="text-align:center;color:#666;margin-top:40px;">As respostas do formulário "${selectedFormTitle}" foram exportadas com sucesso.</p>`
            // Capture from the DOM
            const contentEl = document.getElementById('form-responses-content')
            if (contentEl) {
                htmlContent = contentEl.innerHTML
            }
        }

        const fullHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Relatório — ${selectedFormTitle}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 30px; color: #1e293b; font-size: 12px; }
        h1 { font-size: 20px; margin-bottom: 4px; color: #0f172a; }
        .subtitle { color: #64748b; font-size: 11px; margin-bottom: 24px; }
        h2 { font-size: 14px; margin: 20px 0 10px; color: #334155; border-bottom: 2px solid #e2e8f0; padding-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th { background: #f8fafc; border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; font-weight: 700; }
        td { border: 1px solid #e2e8f0; padding: 8px 10px; font-size: 11px; vertical-align: top; }
        tr:nth-child(even) { background: #f8fafc; }
        .month-section { page-break-inside: avoid; margin-bottom: 24px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; border-bottom: 3px solid #6366f1; padding-bottom: 12px; }
        .logo { font-size: 18px; font-weight: 800; color: #6366f1; }
        @media print { body { padding: 15px; } }
    </style>
</head>
<body>
    <div class="header">
        <div>
            <div class="logo">Produtiva Júnior</div>
            <h1>Relatório: ${selectedFormTitle}</h1>
            <p class="subtitle">Gerado em ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} às ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
    </div>
    ${htmlContent}
</body>
</html>`

        // Open in new window and trigger print
        const printWindow = window.open('', '_blank')
        if (printWindow) {
            printWindow.document.write(fullHtml)
            printWindow.document.close()
            setTimeout(() => {
                printWindow.print()
            }, 500)
        }
    }

    return (
        <div className="flex flex-col gap-8 pb-8">
            <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-violet-50 dark:bg-violet-500/10 p-2.5 rounded-2xl border border-violet-100 dark:border-violet-500/20">
                        <BarChart3 className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Respostas de Formulários</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Visualize de forma centralizada todas as respostas dos formulários e NPS.
                        </p>
                    </div>
                </div>
                {selectedFormId && (
                    <Button
                        onClick={generatePDF}
                        className="bg-violet-600 hover:bg-violet-700 text-white font-semibold rounded-xl h-11 px-6 shadow-sm flex items-center gap-2"
                    >
                        <Download className="w-5 h-5" />
                        Gerar Relatório PDF
                    </Button>
                )}
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Form Selector (Sidebar) */}
                <div className="w-full lg:w-1/4 bg-white dark:bg-[#0F172A] rounded-3xl p-4 shadow-sm border border-slate-100 dark:border-slate-800/50 flex flex-col gap-2">
                    <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-2 px-2">Selecione o Formulário</h2>

                    {loading && <div className="text-center p-4 text-slate-400 text-sm">Carregando formulários...</div>}

                    {!loading && (
                        <>
                            <button
                                onClick={() => setSelectedFormId('nps_projeto')}
                                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${selectedFormId === 'nps_projeto' ? 'bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-300' : 'bg-transparent border border-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50'}`}
                            >
                                <div className="flex items-center gap-3 font-bold text-sm">
                                    <Star className={`h-4 w-4 ${selectedFormId === 'nps_projeto' ? 'text-amber-500' : 'text-slate-400'}`} />
                                    NPS Projeto
                                </div>
                            </button>

                            <div className="h-px bg-slate-100 dark:bg-slate-800 my-2"></div>

                            {formularios.map(form => (
                                <button
                                    key={form.id}
                                    onClick={() => setSelectedFormId(form.id)}
                                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all text-left ${selectedFormId === form.id ? 'bg-violet-50 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/30 text-violet-700 dark:text-violet-300' : 'bg-transparent border border-transparent text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/50'}`}
                                >
                                    <div className="flex items-center gap-3 font-bold text-sm overflow-hidden whitespace-nowrap text-ellipsis">
                                        <FileText className={`h-4 w-4 shrink-0 ${selectedFormId === form.id ? 'text-violet-600 dark:text-violet-400' : 'text-slate-400'}`} />
                                        <span className="truncate">{form.titulo}</span>
                                    </div>
                                </button>
                            ))}
                        </>
                    )}
                </div>

                {/* Dashboard View */}
                <div id="form-responses-content" className="w-full lg:w-3/4 bg-white dark:bg-[#0F172A] rounded-3xl min-h-[500px] shadow-sm border border-slate-100 dark:border-slate-800/50 overflow-hidden">
                    {!selectedFormId && !loading && (
                        <div className="flex flex-col items-center justify-center p-12 text-slate-400 h-full mt-24">
                            <FileText className="h-12 w-12 opacity-20 mb-4" />
                            <p>Selecione um formulário ao lado para ver as respostas.</p>
                        </div>
                    )}

                    {selectedFormId && selectedFormId !== 'nps_projeto' && (
                        <FormResponsesDashboard formularioId={selectedFormId} />
                    )}

                    {selectedFormId === 'nps_projeto' && (
                        <div className="p-6 space-y-4">
                            {npsLoading ? (
                                <div className="p-8 text-center text-slate-400 text-sm">Carregando avaliações de NPS...</div>
                            ) : npsRespostas.length === 0 ? (
                                <div className="p-8 text-center text-slate-400">
                                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-30" />
                                    <p className="font-medium text-sm">Nenhuma resposta de NPS recebida ainda</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300 mb-6">
                                        <Users className="h-4 w-4" />
                                        {npsRespostas.length} avaliação{npsRespostas.length !== 1 ? 'ões' : ''} no total
                                    </div>

                                    {sortedNpsKeys.map(key => {
                                        const [year, monthIdx] = key.split('-').map(Number)
                                        const monthRespostas = groupedNps[key]
                                        const isExpanded = expandedMonths[key] ?? false
                                        const monthLabel = `${MESES[monthIdx]} ${year}`

                                        // Calculate NPS metrics for the month
                                        let promotores = 0, detratores = 0, neutros = 0
                                        monthRespostas.forEach(r => {
                                            if (r.nps_geral >= 4.5) promotores++
                                            else if (r.nps_geral <= 3.5) detratores++
                                            else neutros++
                                        })
                                        const npsScore = Math.round(((promotores - detratores) / monthRespostas.length) * 100)

                                        return (
                                            <div key={key} className="border border-slate-100 dark:border-slate-800/50 rounded-2xl overflow-hidden mb-4">
                                                <button
                                                    onClick={() => toggleMonth(key)}
                                                    className="w-full flex items-center justify-between p-4 bg-white hover:bg-slate-50 dark:bg-[#0F172A] dark:hover:bg-slate-800/50 transition-colors"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl">
                                                            <Calendar className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="flex items-center gap-4">
                                                                <h3 className="font-bold text-slate-900 dark:text-white text-sm">{monthLabel}</h3>
                                                                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${npsScore >= 75 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : npsScore >= 50 ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400'}`}>
                                                                    NPS: {npsScore}
                                                                </span>
                                                            </div>
                                                            <p className="text-xs text-slate-400 mt-0.5">{monthRespostas.length} avaliação{monthRespostas.length !== 1 ? 'ões' : ''} (Promotores: {promotores}, Neutros: {neutros}, Detratores: {detratores})</p>
                                                        </div>
                                                    </div>
                                                    {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                                                </button>

                                                {isExpanded && (
                                                    <div className="border-t border-slate-100 dark:border-slate-800/50 divide-y divide-slate-100 dark:divide-slate-800/50">
                                                        {monthRespostas.map((resposta) => {
                                                            const sendDate = new Date(resposta.created_at)
                                                            const dateStr = sendDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                                            const timeStr = sendDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                                            const authorName = resposta.colaboradores?.nome || 'Anônimo'
                                                            const respondidoPor = usuariosMap[resposta.avaliador_id] || 'Desconhecido'
                                                            const isPromotor = resposta.nps_geral >= 4.5
                                                            const isDetrator = resposta.nps_geral <= 3.5

                                                            return (
                                                                <div key={resposta.id} className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
                                                                    {/* Left pane: Author and Score */}
                                                                    <div className="md:col-span-1 flex flex-col gap-2">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold text-xs shrink-0">
                                                                                {authorName.charAt(0).toUpperCase()}
                                                                            </div>
                                                                            <div>
                                                                                <p className="font-bold text-xs text-slate-500 mb-0.5 uppercase tracking-wide">Avaliado</p>
                                                                                <p className="font-bold text-sm text-slate-900 dark:text-white line-clamp-1">{authorName}</p>
                                                                                <p className="text-[11px] text-slate-400">{dateStr} às {timeStr}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className="mt-2 pl-11">
                                                                            <p className="font-bold text-xs text-slate-500 mb-0.5 uppercase tracking-wide">Respondido por</p>
                                                                            <p className="font-bold text-sm text-slate-700 dark:text-slate-300 line-clamp-1">{respondidoPor}</p>
                                                                        </div>
                                                                        <div className="mt-3 pl-11">
                                                                            <div className={`text-2xl font-black ${isPromotor ? 'text-emerald-500' : isDetrator ? 'text-rose-500' : 'text-amber-500'}`}>
                                                                                {Number(resposta.nps_geral).toFixed(1)}<span className="text-sm font-bold text-slate-400 dark:text-slate-600">/5</span>
                                                                            </div>
                                                                        </div>
                                                                    </div>

                                                                    {/* Right pane: Feedback */}
                                                                    <div className="md:col-span-3 space-y-3">
                                                                        {resposta.feedback_texto && (
                                                                            <div className="bg-slate-50 dark:bg-white/[0.02] p-3 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                                                                <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-1">Feedback / Percepções:</h4>
                                                                                <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{resposta.feedback_texto}</p>
                                                                            </div>
                                                                        )}
                                                                        {resposta.precisa_feedback && (
                                                                            <div className="bg-violet-50/50 dark:bg-violet-500/5 p-3 rounded-xl border border-violet-100 dark:border-violet-500/10 mt-2">
                                                                                <h4 className="text-[10px] uppercase font-bold text-violet-400 dark:text-violet-500 mb-1 flex items-center gap-1">
                                                                                    <MessageSquare className="h-3 w-3" />
                                                                                    Precisa de Feedback
                                                                                </h4>
                                                                                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">O avaliador indicou que este colaborador precisa de um feedback direto sobre os pontos avaliados.</p>
                                                                            </div>
                                                                        )}
                                                                        {!resposta.feedback_texto && !resposta.precisa_feedback && (
                                                                            <p className="text-xs text-slate-400 italic">Sem comentários adicionais.</p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}

                                            </div>
                                        )
                                    })}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
