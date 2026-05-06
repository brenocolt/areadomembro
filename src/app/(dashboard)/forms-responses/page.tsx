"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { FileText, Users, Star, MessageSquare, Calendar, ChevronDown, ChevronUp, BarChart3, AlertCircle, Download, Filter, Search } from "lucide-react"
import { FormResponsesDashboard } from "../forms-management/components/form-responses-dashboard"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function FormsResponsesPage() {
    const [formularios, setFormularios] = useState<any[]>([])
    const [selectedFormId, setSelectedFormId] = useState<string | 'nps_projeto' | null>(null)
    const [loading, setLoading] = useState(true)

    // NPS Projeto State
    const [npsLoading, setNpsLoading] = useState(false)
    const [npsRespostas, setNpsRespostas] = useState<any[]>([])
    const [usuariosMap, setUsuariosMap] = useState<Record<string, string>>({})
    const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({})
    const [npsFilterTipo, setNpsFilterTipo] = useState<'todos' | 'consultor' | 'gerente'>('todos')
    const [npsViewMode, setNpsViewMode] = useState<'dashboard' | 'lista'>('dashboard')
    const [searchAvaliado, setSearchAvaliado] = useState("")

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

    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

    // Filter NPS by type and by evaluated name
    const filteredNpsRespostas = npsRespostas.filter(r => {
        if (npsFilterTipo !== 'todos' && r.tipo_avaliacao !== npsFilterTipo) return false
        if (searchAvaliado.trim() !== '') {
            const nome = r.colaboradores?.nome || ''
            if (!normalize(nome).includes(normalize(searchAvaliado))) return false
        }
        return true
    })

    // Grouping NPS exactly like we group Form Responses
    const groupedNps: Record<string, any[]> = {}
    filteredNpsRespostas.forEach(r => {
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
    async function generatePDF() {
        if (typeof window === 'undefined') return

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
                let sumScore = 0
                monthRespostas.forEach(r => {
                    sumScore += Number(r.nps_geral || 0)
                    if (r.nps_geral >= 4.5) promotores++
                    else if (r.nps_geral <= 3.5) detratores++
                    else neutros++
                })
                const npsScore = monthRespostas.length > 0 ? (sumScore / monthRespostas.length).toFixed(1) : '0'

                    const rows = monthRespostas.map(r => {
                        const sendDate = new Date(r.created_at)
                        const dateStr = sendDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                        const authorName = r.colaboradores?.nome || 'Anônimo'
                        const respondidoPor = usuariosMap[r.avaliador_id] || 'Desconhecido'
                        const isGer = r.tipo_avaliacao === 'gerente'
                        const scoreFields = isGer
                            ? [{k:'comunicacao',l:'Com.'},{k:'suporte',l:'Sup.'},{k:'relacionamento',l:'Rel.'},{k:'resolutividade',l:'Res.'},{k:'lideranca',l:'Lid.'}]
                            : [{k:'comunicacao',l:'Com.'},{k:'dedicacao',l:'Ded.'},{k:'confianca',l:'Conf.'},{k:'pontualidade',l:'Pont.'},{k:'organizacao',l:'Org.'},{k:'proatividade',l:'Pro.'},{k:'qualidade_entregas',l:'Qual.'},{k:'dominio_tecnico',l:'Dom.'}]
                        const scoresHtml = scoreFields.map(f => {
                            const v = Number(r[f.k] || 0)
                            const color = v >= 4 ? '#10b981' : v >= 3 ? '#f59e0b' : '#ef4444'
                            return `<div style="display:inline-block; margin-right:12px; margin-bottom:8px; background:#f8fafc; padding:4px 8px; border-radius:6px; border:1px solid #e2e8f0;">
                                <small style="color:#64748b; font-size:9px; text-transform:uppercase; display:block; margin-bottom:2px;">${f.l}</small>
                                <strong style="color:${color}; font-size:12px;">${v}</strong>
                            </div>`
                        }).join('')
                        return `<tr style="border-bottom: 1px solid #e2e8f0;">
                            <td style="padding:16px 12px; vertical-align:top;">
                                <div style="font-weight:bold; color:#0f172a; margin-bottom:4px;">${authorName}</div>
                                <div style="font-size:11px; color:#64748b; background:#f1f5f9; padding:2px 6px; border-radius:4px; display:inline-block;">${isGer ? 'Gerente' : 'Consultor'}</div>
                            </td>
                            <td style="padding:16px 12px; vertical-align:top; color:#475569; font-size:12px;">
                                ${respondidoPor}
                            </td>
                            <td style="padding:16px 12px; vertical-align:top; text-align:center;">
                                <div style="display:inline-block; padding:4px 10px; border-radius:8px; font-weight:bold; font-size:14px; color:${r.nps_geral >= 4.5 ? '#10b981' : r.nps_geral <= 3.5 ? '#ef4444' : '#f59e0b'}; background:${r.nps_geral >= 4.5 ? '#ecfdf5' : r.nps_geral <= 3.5 ? '#fef2f2' : '#fffbeb'}">
                                    ${Number(r.nps_geral).toFixed(1)}/5
                                </div>
                            </td>
                            <td style="padding:16px 12px; vertical-align:top;">
                                ${scoresHtml}
                                ${r.feedback_texto ? `<div style="margin-top:12px; font-size:11px; color:#475569; background:#f8fafc; padding:8px; border-radius:6px; border-left:3px solid #cbd5e1;">${r.feedback_texto}</div>` : ''}
                            </td>
                        <td style="white-space:nowrap;">${dateStr}</td>
                        <td style="max-width:250px;word-wrap:break-word;">${r.feedback_texto || '—'}</td>
                    </tr>`
                }).join('')

                return `
                    <div class="month-section">
                        <h2>${monthLabel} — Média: ${npsScore}/5 (P: ${promotores}, N: ${neutros}, D: ${detratores})</h2>
                        <table>
                            <thead><tr><th>Avaliado</th><th>Respondido por</th><th>Nota</th><th>Detalhamento</th><th>Data</th><th>Feedback</th></tr></thead>
                            <tbody>${rows}</tbody>
                        </table>
                    </div>
                `
            }).join('')
        } else {
                // Default forms PDF generator
                let groups: Record<string, { label: string; respostas: any[] }> = {}
                // We'll group by month for the generic export
                const rawResp = await supabase.from('formulario_respostas').select('*, formulario_respostas_itens(*, formulario_perguntas(*)), colaboradores(nome)').eq('formulario_id', selectedFormId).order('enviado_em', { ascending: false })
                if (rawResp.data) {
                    rawResp.data.forEach(r => {
                        const date = new Date(r.enviado_em)
                        const key = `${date.getFullYear()}-${date.getMonth()}`
                        if (!groups[key]) groups[key] = { label: `${MESES[date.getMonth()]} ${date.getFullYear()}`, respostas: [] }
                        groups[key].respostas.push(r)
                    })
                }

                htmlContent = Object.keys(groups).map(key => {
                    const group = groups[key]
                    return `
                        <h2 style="color:#4f46e5; border-bottom:2px solid #e0e7ff; padding-bottom:8px; margin-top:30px; font-size:18px;">${group.label}</h2>
                        <div style="display:flex; flex-direction:column; gap:20px;">
                            ${group.respostas.map(r => {
                                const sendDate = new Date(r.enviado_em)
                                const dateStr = sendDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                const author = r.colaboradores?.nome || 'Anônimo'
                                
                                const itemsHtml = r.formulario_respostas_itens?.map((item: any) => {
                                    return `
                                        <div style="margin-bottom:12px;">
                                            <div style="font-size:11px; font-weight:bold; color:#64748b; margin-bottom:4px; text-transform:uppercase;">${item.formulario_perguntas?.titulo || 'Pergunta'}</div>
                                            <div style="font-size:13px; color:#1e293b; background:#f8fafc; padding:8px 12px; border-radius:6px; border:1px solid #e2e8f0;">${item.valor_texto || item.valor_numero || item.valor_booleano || '-'}</div>
                                        </div>
                                    `
                                }).join('') || ''

                                return `
                                    <div style="border:1px solid #e2e8f0; border-radius:12px; padding:20px; background:#ffffff; page-break-inside:avoid;">
                                        <div style="display:flex; justify-content:space-between; margin-bottom:16px; border-bottom:1px solid #f1f5f9; padding-bottom:12px;">
                                            <div>
                                                <div style="font-weight:bold; font-size:16px; color:#0f172a;">${author}</div>
                                                <div style="font-size:12px; color:#64748b;">Enviado em ${dateStr}</div>
                                            </div>
                                        </div>
                                        <div>
                                            ${itemsHtml}
                                        </div>
                                    </div>
                                `
                            }).join('')}
                        </div>
                    `
                }).join('')
        }

        const fullHtml = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Relatório — ${selectedFormTitle}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 30px; color: #1e293b; font-size: 12px; line-height: 1.5; }
        h1 { font-size: 22px; margin-bottom: 4px; color: #0f172a; }
        .subtitle { color: #64748b; font-size: 11px; margin-bottom: 24px; }
        h2 { font-size: 15px; margin: 24px 0 12px; color: #334155; border-bottom: 2px solid #6366f1; padding-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 11px; }
        th { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 10px 12px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #475569; font-weight: 700; }
        td { border: 1px solid #e2e8f0; padding: 10px 12px; vertical-align: top; line-height: 1.6; }
        tr:nth-child(even) { background: #f8fafc; }
        .month-section { page-break-inside: avoid; margin-bottom: 32px; }
        .header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; border-bottom: 3px solid #6366f1; padding-bottom: 14px; }
        .logo { font-size: 20px; font-weight: 800; color: #6366f1; letter-spacing: -0.5px; }
        @media print { body { padding: 15px; } table { font-size: 10px; } }
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
                                    {(() => {
                                        let npsGeralData = {
                                            consultores: { promotores: 0, neutros: 0, detratores: 0, total: 0, sum: 0 },
                                            gerentes: { promotores: 0, neutros: 0, detratores: 0, total: 0, sum: 0 },
                                            empresa: { promotores: 0, neutros: 0, detratores: 0, total: 0, sum: 0 },
                                            questoesConsultor: { total: 0, fields: {} as Record<string, number> },
                                            questoesGerente: { total: 0, fields: {} as Record<string, number> }
                                        }

                                        filteredNpsRespostas.forEach(r => {
                                            const isP = r.nps_geral >= 4.5;
                                            const isD = r.nps_geral <= 3.5;
                                            
                                            npsGeralData.empresa.total++;
                                            npsGeralData.empresa.sum += Number(r.nps_geral || 0);
                                            if (isP) npsGeralData.empresa.promotores++;
                                            else if (isD) npsGeralData.empresa.detratores++;
                                            else npsGeralData.empresa.neutros++;

                                            if (r.tipo_avaliacao === 'gerente') {
                                                npsGeralData.gerentes.total++;
                                                npsGeralData.gerentes.sum += Number(r.nps_geral || 0);
                                                if (isP) npsGeralData.gerentes.promotores++;
                                                else if (isD) npsGeralData.gerentes.detratores++;
                                                else npsGeralData.gerentes.neutros++;
                                                
                                                npsGeralData.questoesGerente.total++;
                                                ['comunicacao','suporte','relacionamento','resolutividade','lideranca'].forEach(f => {
                                                    if (!npsGeralData.questoesGerente.fields[f]) npsGeralData.questoesGerente.fields[f] = 0;
                                                    npsGeralData.questoesGerente.fields[f] += Number(r[f] || 0);
                                                });
                                            } else {
                                                npsGeralData.consultores.total++;
                                                npsGeralData.consultores.sum += Number(r.nps_geral || 0);
                                                if (isP) npsGeralData.consultores.promotores++;
                                                else if (isD) npsGeralData.consultores.detratores++;
                                                else npsGeralData.consultores.neutros++;

                                                npsGeralData.questoesConsultor.total++;
                                                ['comunicacao','dedicacao','confianca','pontualidade','organizacao','proatividade','qualidade_entregas','dominio_tecnico'].forEach(f => {
                                                    if (!npsGeralData.questoesConsultor.fields[f]) npsGeralData.questoesConsultor.fields[f] = 0;
                                                    npsGeralData.questoesConsultor.fields[f] += Number(r[f] || 0);
                                                });
                                            }
                                        })

                                        const calcNps = (data: any) => data.total === 0 ? 0 : (data.sum / data.total).toFixed(1);
                                        const npsConsultores = Number(calcNps(npsGeralData.consultores));
                                        const npsGerentes = Number(calcNps(npsGeralData.gerentes));
                                        const npsEmpresa = Number(calcNps(npsGeralData.empresa));

                                        return (
                                            <>
                                                <div className="flex flex-wrap items-center gap-3 mb-6">
                                                    <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                                                        <Users className="h-4 w-4" />
                                                        {filteredNpsRespostas.length} avaliação{filteredNpsRespostas.length !== 1 ? 'ões' : ''} no total
                                                    </div>

                                                    <div className="relative w-56">
                                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                                                        <Input
                                                            placeholder="Buscar avaliado..."
                                                            value={searchAvaliado}
                                                            onChange={(e) => setSearchAvaliado(e.target.value)}
                                                            className="pl-8 h-8 text-xs rounded-lg bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                                                        />
                                                    </div>

                                                    <div className="ml-auto flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 mr-2">
                                                        <button onClick={() => setNpsViewMode('dashboard')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${npsViewMode === 'dashboard' ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm' : 'text-slate-500'}`}>
                                                            <BarChart3 className="h-3 w-3 inline mr-1" />Dashboard
                                                        </button>
                                                        <button onClick={() => setNpsViewMode('lista')} className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${npsViewMode === 'lista' ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm' : 'text-slate-500'}`}>
                                                            <FileText className="h-3 w-3 inline mr-1" />Lista
                                                        </button>
                                                    </div>

                                                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5">
                                                        {([{v:'todos',l:'Todos'},{v:'consultor',l:'Consultores'},{v:'gerente',l:'Gerentes'}] as const).map(opt => (
                                                            <button key={opt.v} onClick={() => setNpsFilterTipo(opt.v)}
                                                                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${npsFilterTipo === opt.v ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm' : 'text-slate-500'}`}
                                                            >{opt.l}</button>
                                                        ))}
                                                    </div>
                                                </div>

                                                {npsViewMode === 'dashboard' ? (
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Média Geral Empresa</h3>
                                                            <div className="flex items-end gap-3">
                                                                <span className={`text-4xl font-black ${npsEmpresa >= 4.5 ? 'text-emerald-500' : npsEmpresa >= 3.5 ? 'text-amber-500' : 'text-rose-500'}`}>{npsEmpresa.toFixed(1)}</span>
                                                                <span className="text-sm font-medium text-slate-400 mb-1">/5 ({npsGeralData.empresa.total} avaliações)</span>
                                                            </div>
                                                        </div>
                                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Média Consultores</h3>
                                                            <div className="flex items-end gap-3">
                                                                <span className={`text-4xl font-black ${npsConsultores >= 4.5 ? 'text-emerald-500' : npsConsultores >= 3.5 ? 'text-amber-500' : 'text-rose-500'}`}>{npsConsultores.toFixed(1)}</span>
                                                                <span className="text-sm font-medium text-slate-400 mb-1">/5 ({npsGeralData.consultores.total} avaliações)</span>
                                                            </div>
                                                        </div>
                                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Média Gerentes</h3>
                                                            <div className="flex items-end gap-3">
                                                                <span className={`text-4xl font-black ${npsGerentes >= 4.5 ? 'text-emerald-500' : npsGerentes >= 3.5 ? 'text-amber-500' : 'text-rose-500'}`}>{npsGerentes.toFixed(1)}</span>
                                                                <span className="text-sm font-medium text-slate-400 mb-1">/5 ({npsGeralData.gerentes.total} avaliações)</span>
                                                            </div>
                                                        </div>

                                                        {/* Dashboard Por Pergunta */}
                                                        <div className="col-span-1 sm:col-span-3 bg-white dark:bg-[#0F172A] p-5 rounded-2xl border border-slate-100 dark:border-slate-800">
                                                            <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-4">Média por Pergunta</h3>
                                                            
                                                            {npsFilterTipo !== 'gerente' && npsGeralData.questoesConsultor.total > 0 && (
                                                                <div className="mb-6">
                                                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Consultores</h4>
                                                                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                                                        {[{k:'comunicacao',l:'Comunicação'},{k:'dedicacao',l:'Dedicação'},{k:'confianca',l:'Confiança'},{k:'pontualidade',l:'Pontualidade'},{k:'organizacao',l:'Organização'},{k:'proatividade',l:'Proatividade'},{k:'qualidade_entregas',l:'Qualidade'},{k:'dominio_tecnico',l:'Dom. Técnico'}].map(f => {
                                                                            const avg = npsGeralData.questoesConsultor.fields[f.k] / npsGeralData.questoesConsultor.total;
                                                                            return (
                                                                                <div key={f.k} className="bg-slate-50 dark:bg-white/[0.02] p-3 rounded-xl">
                                                                                    <div className="flex justify-between items-center mb-1">
                                                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{f.l}</span>
                                                                                        <span className="font-black text-sm text-slate-700 dark:text-slate-300">{avg.toFixed(1)}</span>
                                                                                    </div>
                                                                                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                                        <div className="h-full rounded-full bg-violet-500 transition-all" style={{width: `${(avg/5)*100}%`}} />
                                                                                    </div>
                                                                                </div>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {npsFilterTipo !== 'consultor' && npsGeralData.questoesGerente.total > 0 && (
                                                                <div>
                                                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Gerentes</h4>
                                                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                                                        {[{k:'comunicacao',l:'Comunicação'},{k:'suporte',l:'Suporte'},{k:'relacionamento',l:'Relacionamento'},{k:'resolutividade',l:'Resolutividade'},{k:'lideranca',l:'Liderança'}].map(f => {
                                                                            const avg = npsGeralData.questoesGerente.fields[f.k] / npsGeralData.questoesGerente.total;
                                                                            return (
                                                                                <div key={f.k} className="bg-slate-50 dark:bg-white/[0.02] p-3 rounded-xl">
                                                                                    <div className="flex justify-between items-center mb-1">
                                                                                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{f.l}</span>
                                                                                        <span className="font-black text-sm text-slate-700 dark:text-slate-300">{avg.toFixed(1)}</span>
                                                                                    </div>
                                                                                    <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                                        <div className="h-full rounded-full bg-amber-500 transition-all" style={{width: `${(avg/5)*100}%`}} />
                                                                                    </div>
                                                                                </div>
                                                                            )
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="space-y-4">
                                                        {sortedNpsKeys.map(key => {
                                        const [year, monthIdx] = key.split('-').map(Number)
                                        const monthRespostas = groupedNps[key]
                                        const isExpanded = expandedMonths[key] ?? false
                                        const monthLabel = `${MESES[monthIdx]} ${year}`

                                        // Calculate NPS metrics for the month
                                        let promotores = 0, detratores = 0, neutros = 0
                                        let sumScore = 0
                                        monthRespostas.forEach(r => {
                                            sumScore += Number(r.nps_geral || 0)
                                            if (r.nps_geral >= 4.5) promotores++
                                            else if (r.nps_geral <= 3.5) detratores++
                                            else neutros++
                                        })
                                        const npsScore = monthRespostas.length > 0 ? (sumScore / monthRespostas.length).toFixed(1) : '0'
                                        const isPromotorGlobal = Number(npsScore) >= 4.5
                                        const isDetratorGlobal = Number(npsScore) <= 3.5

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
                                                                <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${isPromotorGlobal ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : isDetratorGlobal ? 'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'}`}>
                                                                    Média: {npsScore}/5
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
                                                            const tipoLabel = resposta.tipo_avaliacao === 'gerente' ? 'Gerente' : 'Consultor'
                                                            const isPromotor = resposta.nps_geral >= 4.5
                                                            const isDetrator = resposta.nps_geral <= 3.5

                                                            return (
                                                                <div key={resposta.id} className="p-5 space-y-4">
                                                                    <div className="flex items-start justify-between flex-wrap gap-3">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="flex items-center justify-center w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 font-bold text-sm shrink-0">
                                                                                {authorName.charAt(0).toUpperCase()}
                                                                            </div>
                                                                            <div>
                                                                                <p className="font-bold text-sm text-slate-900 dark:text-white">
                                                                                    {authorName}
                                                                                    <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider ${resposta.tipo_avaliacao === 'gerente' ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400' : 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400'}`}>{tipoLabel}</span>
                                                                                </p>
                                                                                <p className="text-[11px] text-slate-400">Avaliado por <span className="font-semibold text-slate-500">{respondidoPor}</span> · {dateStr} às {timeStr}</p>
                                                                            </div>
                                                                        </div>
                                                                        <div className={`text-2xl font-black px-3 py-1 rounded-xl ${isPromotor ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' : isDetrator ? 'text-rose-600 bg-rose-50 dark:bg-rose-500/10' : 'text-amber-600 bg-amber-50 dark:bg-amber-500/10'}`}>
                                                                            {Number(resposta.nps_geral).toFixed(1)}<span className="text-xs font-bold opacity-50">/5</span>
                                                                        </div>
                                                                    </div>

                                                                    {(() => {
                                                                        const isGerenteEval = resposta.tipo_avaliacao === 'gerente'
                                                                        const fields = isGerenteEval
                                                                            ? [{k:'comunicacao',l:'Comunicação'},{k:'suporte',l:'Suporte'},{k:'relacionamento',l:'Relacionamento'},{k:'resolutividade',l:'Resolutividade'},{k:'lideranca',l:'Liderança'}]
                                                                            : [{k:'comunicacao',l:'Comunicação'},{k:'dedicacao',l:'Dedicação'},{k:'confianca',l:'Confiança'},{k:'pontualidade',l:'Pontualidade'},{k:'organizacao',l:'Organização'},{k:'proatividade',l:'Proatividade'},{k:'qualidade_entregas',l:'Qualidade'},{k:'dominio_tecnico',l:'Dom. Téc.'}]
                                                                        return (
                                                                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                                                                {fields.map(f => {
                                                                                    const val = Number(resposta[f.k] || 0)
                                                                                    const pct = (val / 5) * 100
                                                                                    const clr = val >= 4 ? 'bg-emerald-500' : val >= 3 ? 'bg-amber-500' : 'bg-rose-500'
                                                                                    return (
                                                                                        <div key={f.k} className="bg-slate-50 dark:bg-white/[0.02] rounded-lg p-2.5 border border-slate-100 dark:border-slate-800/40">
                                                                                            <div className="flex items-center justify-between mb-1">
                                                                                                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">{f.l}</span>
                                                                                                <span className="text-xs font-black text-slate-700 dark:text-slate-300">{val.toFixed(0)}</span>
                                                                                            </div>
                                                                                            <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                                                                                <div className={`h-full rounded-full ${clr} transition-all`} style={{width: `${pct}%`}} />
                                                                                            </div>
                                                                                        </div>
                                                                                    )
                                                                                })}
                                                                            </div>
                                                                        )
                                                                    })()}

                                                                    {resposta.feedback_texto && (
                                                                        <div className="bg-slate-50 dark:bg-white/[0.02] p-3 rounded-xl border border-slate-100 dark:border-slate-800/50">
                                                                            <h4 className="text-[10px] uppercase font-bold text-slate-400 mb-1">Feedback / Percepções</h4>
                                                                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{resposta.feedback_texto}</p>
                                                                        </div>
                                                                    )}
                                                                    {resposta.precisa_feedback && (
                                                                        <div className="bg-violet-50/50 dark:bg-violet-500/5 p-3 rounded-xl border border-violet-100 dark:border-violet-500/10">
                                                                            <h4 className="text-[10px] uppercase font-bold text-violet-400 mb-1 flex items-center gap-1">
                                                                                <MessageSquare className="h-3 w-3" /> Precisa de Feedback
                                                                            </h4>
                                                                            <p className="text-xs text-slate-600 dark:text-slate-400">O avaliador indicou que este colaborador precisa de feedback direto.</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            )
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </>
                    )
                })()}
                </>
            )}
        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
