"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Users, Star, MessageSquare, Calendar, User, ChevronDown, ChevronUp } from "lucide-react"

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export function FormResponsesDashboard({ formularioId }: { formularioId: string }) {
    const [perguntas, setPerguntas] = useState<any[]>([])
    const [respostas, setRespostas] = useState<any[]>([])
    const [colaboradores, setColaboradores] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedMonths, setExpandedMonths] = useState<Record<string, boolean>>({})

    useEffect(() => {
        async function fetch() {
            setLoading(true)
            const [{ data: pData }, { data: rData }, { data: cData }] = await Promise.all([
                supabase.from('formulario_perguntas').select('*').eq('formulario_id', formularioId).order('ordem'),
                supabase.from('formulario_respostas').select('*, formulario_respostas_itens(*, formulario_perguntas(*)), colaboradores(nome)').eq('formulario_id', formularioId).order('enviado_em', { ascending: false }),
                supabase.from('colaboradores').select('id, nome'),
            ])
            setPerguntas(pData || [])
            setRespostas(rData || [])
            setColaboradores(cData || [])

            // Auto-expand the most recent month
            if (rData && rData.length > 0) {
                const firstDate = new Date(rData[0].enviado_em)
                const key = `${firstDate.getFullYear()}-${firstDate.getMonth()}`
                setExpandedMonths({ [key]: true })
            }

            setLoading(false)
        }
        fetch()
    }, [formularioId])

    const toggleMonth = (key: string) => {
        setExpandedMonths(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const getColabName = (id: string) => colaboradores.find(c => c.id === id)?.nome || id

    if (loading) {
        return <div className="p-8 text-center text-slate-400 text-sm">Carregando respostas...</div>
    }

    if (respostas.length === 0) {
        return (
            <div className="p-8 text-center text-slate-400">
                <Users className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p className="font-medium text-sm">Nenhuma resposta recebida ainda</p>
            </div>
        )
    }

    // Group responses by month
    const grouped: Record<string, any[]> = {}
    respostas.forEach(r => {
        const date = new Date(r.enviado_em)
        const key = `${date.getFullYear()}-${date.getMonth()}`
        if (!grouped[key]) grouped[key] = []
        grouped[key].push(r)
    })

    // Sort month keys by most recent first
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
        const [ya, ma] = a.split('-').map(Number)
        const [yb, mb] = b.split('-').map(Number)
        return yb * 12 + mb - (ya * 12 + ma)
    })

    return (
        <div className="p-6 space-y-4">
            <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                <Users className="h-4 w-4" />
                {respostas.length} resposta{respostas.length !== 1 ? 's' : ''} no total
            </div>

            {sortedKeys.map(key => {
                const [year, monthIdx] = key.split('-').map(Number)
                const monthRespostas = grouped[key]
                const isExpanded = expandedMonths[key] ?? false
                const monthLabel = `${MESES[monthIdx]} ${year}`

                return (
                    <div key={key} className="border border-slate-100 dark:border-slate-800/50 rounded-2xl overflow-hidden">
                        {/* Month header */}
                        <button
                            onClick={() => toggleMonth(key)}
                            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-violet-50 dark:bg-violet-500/10 rounded-xl">
                                    <Calendar className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                                </div>
                                <div className="text-left">
                                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">{monthLabel}</h3>
                                    <p className="text-xs text-slate-400">{monthRespostas.length} resposta{monthRespostas.length !== 1 ? 's' : ''}</p>
                                </div>
                            </div>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </button>

                        {isExpanded && (
                            <div className="border-t border-slate-100 dark:border-slate-800/50 divide-y divide-slate-100 dark:divide-slate-800/50">
                                {monthRespostas.map((resposta, ri) => {
                                    const sendDate = new Date(resposta.enviado_em)
                                    const dateStr = sendDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                    const timeStr = sendDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                    const authorName = resposta.colaboradores?.nome || 'Anônimo'
                                    const items = resposta.formulario_respostas_itens || []

                                    return (
                                        <div key={resposta.id} className="p-4">
                                            {/* Response header */}
                                            <div className="flex items-center gap-3 mb-3">
                                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 font-bold text-xs shrink-0">
                                                    {authorName.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-900 dark:text-white">{authorName}</p>
                                                    <p className="text-[11px] text-slate-400">{dateStr} às {timeStr}</p>
                                                </div>
                                            </div>

                                            {/* Individual answers */}
                                            <div className="space-y-2 ml-11">
                                                {perguntas.map((p, pi) => {
                                                    const item = items.find((it: any) => it.pergunta_id === p.id)
                                                    if (!item) return null

                                                    let displayValue = ''

                                                    if (p.tipo === 'texto') {
                                                        displayValue = item.valor || '—'
                                                    } else if (p.tipo === 'escala') {
                                                        displayValue = item.valor ? `${item.valor}/5` : '—'
                                                    } else if (p.tipo === 'selecao_unica') {
                                                        displayValue = item.valor || '—'
                                                    } else if (p.tipo === 'selecao_multipla') {
                                                        displayValue = item.valores ? (item.valores as string[]).join(', ') : (item.valor || '—')
                                                    } else if (p.tipo === 'colaborador_unico') {
                                                        displayValue = item.valor ? getColabName(item.valor) : '—'
                                                    } else if (p.tipo === 'colaborador_multiplo') {
                                                        displayValue = item.valores ? (item.valores as string[]).map(getColabName).join(', ') : (item.valor ? getColabName(item.valor) : '—')
                                                    }

                                                    return (
                                                        <div key={p.id} className="text-xs">
                                                            <span className="font-bold text-slate-500 dark:text-slate-400">
                                                                {pi + 1}. {p.titulo}:
                                                            </span>{' '}
                                                            {p.tipo === 'escala' && item.valor ? (
                                                                <span className="inline-flex items-center gap-1">
                                                                    <span className="font-bold text-amber-600 dark:text-amber-400">{item.valor}</span>
                                                                    <span className="text-slate-400">/5</span>
                                                                    <span className="flex gap-0.5 ml-1">
                                                                        {[1, 2, 3, 4, 5].map(v => (
                                                                            <Star
                                                                                key={v}
                                                                                className={`h-3 w-3 ${v <= Number(item.valor) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-slate-700'}`}
                                                                            />
                                                                        ))}
                                                                    </span>
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-700 dark:text-slate-300">{displayValue}</span>
                                                            )}
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
