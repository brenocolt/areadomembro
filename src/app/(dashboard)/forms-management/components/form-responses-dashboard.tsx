"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Users, Star, Calendar, User, ChevronDown, ChevronUp, Filter } from "lucide-react"

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

export function FormResponsesDashboard({ formularioId }: { formularioId: string }) {
    const [perguntas, setPerguntas] = useState<any[]>([])
    const [respostas, setRespostas] = useState<any[]>([])
    const [colaboradores, setColaboradores] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({})
    const [filterPerguntaId, setFilterPerguntaId] = useState<string>('')
    const [groupMode, setGroupMode] = useState<'pessoa' | 'mes' | 'pergunta'>('pessoa')

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

            // Auto-expand first group
            if (rData && rData.length > 0) {
                if (groupMode === 'pessoa') {
                    const firstPerson = rData[0].colaborador_id || rData[0].colaboradores?.nome || 'anon'
                    setExpandedGroups({ [firstPerson]: true })
                } else if (groupMode === 'mes') {
                    const firstDate = new Date(rData[0].enviado_em)
                    setExpandedGroups({ [`${firstDate.getFullYear()}-${firstDate.getMonth()}`]: true })
                }
            }

            setLoading(false)
        }
        fetch()
    }, [formularioId])

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }))
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

    // Filter questions to display
    const filteredPerguntas = filterPerguntaId
        ? perguntas.filter(p => p.id === filterPerguntaId)
        : perguntas

    // Group responses
    let groups: Record<string, { label: string; respostas: any[] }> = {}

    if (groupMode === 'pessoa') {
        respostas.forEach(r => {
            const personId = r.colaborador_id || 'anon'
            const personName = r.colaboradores?.nome || 'Anônimo'
            if (!groups[personId]) groups[personId] = { label: personName, respostas: [] }
            groups[personId].respostas.push(r)
        })
    } else if (groupMode === 'mes') {
        respostas.forEach(r => {
            const date = new Date(r.enviado_em)
            const key = `${date.getFullYear()}-${date.getMonth()}`
            if (!groups[key]) groups[key] = { label: `${MESES[date.getMonth()]} ${date.getFullYear()}`, respostas: [] }
            groups[key].respostas.push(r)
        })
    } else if (groupMode === 'pergunta') {
        perguntas.forEach((p, idx) => {
            groups[p.id] = { label: `${idx + 1}. ${p.titulo}`, respostas: [] }
            respostas.forEach(r => {
                const item = r.formulario_respostas_itens?.find((it: any) => it.pergunta_id === p.id)
                if (item) {
                    groups[p.id].respostas.push({ ...r, _mappedItem: item, _pergunta: p })
                }
            })
        })
    }

    const sortedKeys = Object.keys(groups).sort((a, b) => {
        if (groupMode === 'mes') {
            const [ya, ma] = a.split('-').map(Number)
            const [yb, mb] = b.split('-').map(Number)
            return yb * 12 + mb - (ya * 12 + ma)
        }
        if (groupMode === 'pergunta') {
            const idxA = perguntas.findIndex(p => p.id === a)
            const idxB = perguntas.findIndex(p => p.id === b)
            return idxA - idxB
        }
        return groups[a].label.localeCompare(groups[b].label)
    })

    return (
        <div className="p-6 space-y-4">
            {/* Controls bar */}
            <div className="flex flex-wrap items-center gap-3 mb-2">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700 dark:text-slate-300">
                    <Users className="h-4 w-4" />
                    {respostas.length} resposta{respostas.length !== 1 ? 's' : ''} no total
                </div>

                <div className="ml-auto flex flex-wrap items-center gap-2">
                    {/* Group mode toggle */}
                    <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5 overflow-x-auto max-w-full">
                        <button
                            onClick={() => setGroupMode('pessoa')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${groupMode === 'pessoa' ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm' : 'text-slate-500'}`}
                        >
                            <User className="h-3 w-3 inline mr-1" />Por Pessoa
                        </button>
                        <button
                            onClick={() => setGroupMode('mes')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${groupMode === 'mes' ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm' : 'text-slate-500'}`}
                        >
                            <Calendar className="h-3 w-3 inline mr-1" />Por Mês
                        </button>
                        <button
                            onClick={() => setGroupMode('pergunta')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all whitespace-nowrap ${groupMode === 'pergunta' ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm' : 'text-slate-500'}`}
                        >
                            <Filter className="h-3 w-3 inline mr-1" />Destrinchada
                        </button>
                    </div>

                    {/* Question filter */}
                    <div className="relative">
                        <select
                            value={filterPerguntaId}
                            onChange={e => setFilterPerguntaId(e.target.value)}
                            className="appearance-none pl-8 pr-4 py-1.5 text-xs font-bold rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-none focus:ring-2 focus:ring-violet-500 cursor-pointer min-w-[140px]"
                        >
                            <option value="">Todas as perguntas</option>
                            {perguntas.map((p, i) => (
                                <option key={p.id} value={p.id}>{i + 1}. {p.titulo.substring(0, 40)}{p.titulo.length > 40 ? '...' : ''}</option>
                            ))}
                        </select>
                        <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
                    </div>
                </div>
            </div>

            {/* Groups */}
            {sortedKeys.map(key => {
                const group = groups[key]
                const isExpanded = expandedGroups[key] ?? false

                return (
                    <div key={key} className="border border-slate-100 dark:border-slate-800/50 rounded-2xl overflow-hidden">
                        <button
                            onClick={() => toggleGroup(key)}
                            className="w-full flex items-center justify-between p-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-violet-50 dark:bg-violet-500/10 rounded-xl">
                                    {groupMode === 'pessoa'
                                        ? <User className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                                        : <Calendar className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                                    }
                                </div>
                                <div className="text-left">
                                    <h3 className="font-bold text-slate-900 dark:text-white text-sm">{group.label}</h3>
                                    <p className="text-xs text-slate-400">{group.respostas.length} resposta{group.respostas.length !== 1 ? 's' : ''}</p>
                                </div>
                            </div>
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
                        </button>

                        {isExpanded && (
                            <div className="border-t border-slate-100 dark:border-slate-800/50 divide-y divide-slate-100 dark:divide-slate-800/50">
                                {group.respostas.map((resposta) => {
                                    const sendDate = new Date(resposta.enviado_em)
                                    const dateStr = sendDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                    const timeStr = sendDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                    const authorName = resposta.colaboradores?.nome || 'Anônimo'
                                    const items = resposta.formulario_respostas_itens || []

                                    const renderValue = (p: any, item: any) => {
                                        let displayValue = ''
                                        if (p.tipo === 'texto') displayValue = item.valor || '—'
                                        else if (p.tipo === 'escala') displayValue = item.valor ? `${item.valor}/5` : '—'
                                        else if (p.tipo === 'selecao_unica') displayValue = item.valor || '—'
                                        else if (p.tipo === 'selecao_multipla') displayValue = item.valores ? (item.valores as string[]).join(', ') : (item.valor || '—')
                                        else if (p.tipo === 'colaborador_unico') displayValue = item.valor ? getColabName(item.valor) : '—'
                                        else if (p.tipo === 'colaborador_multiplo') displayValue = item.valores ? (item.valores as string[]).map(getColabName).join(', ') : (item.valor ? getColabName(item.valor) : '—')

                                        if (p.tipo === 'escala' && item.valor) {
                                            return (
                                                <span className="inline-flex items-center gap-1 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-lg">
                                                    <span className="font-bold text-amber-600 dark:text-amber-400">{item.valor}</span>
                                                    <span className="text-slate-400 text-xs">/5</span>
                                                    <span className="flex gap-0.5 ml-1">
                                                        {[1, 2, 3, 4, 5].map(v => (
                                                            <Star key={v} className={`h-3 w-3 ${v <= Number(item.valor) ? 'text-amber-400 fill-amber-400' : 'text-slate-200 dark:text-slate-700'}`} />
                                                        ))}
                                                    </span>
                                                </span>
                                            )
                                        }
                                        return <div className="text-sm text-slate-700 dark:text-slate-300 font-medium whitespace-pre-wrap">{displayValue}</div>
                                    }

                                    return (
                                        <div key={resposta.id} className="p-4 bg-white dark:bg-transparent">
                                            <div className="flex items-center gap-3 mb-4">
                                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-700 dark:text-violet-300 font-bold text-xs shrink-0">
                                                    {authorName.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <p className="font-bold text-sm text-slate-900 dark:text-white">{authorName}</p>
                                                    <p className="text-[11px] text-slate-400">{dateStr} às {timeStr}</p>
                                                </div>
                                            </div>

                                            {groupMode === 'pergunta' ? (
                                                <div className="ml-11 bg-slate-50 dark:bg-white/[0.02] p-3.5 rounded-xl border border-slate-100 dark:border-slate-800">
                                                    {renderValue(resposta._pergunta, resposta._mappedItem)}
                                                </div>
                                            ) : (
                                                <div className="space-y-3 ml-11">
                                                    {filteredPerguntas.map((p, pi) => {
                                                        const item = items.find((it: any) => it.pergunta_id === p.id)
                                                        if (!item) return null
                                                        const questionIdx = perguntas.findIndex(q => q.id === p.id)
                                                        return (
                                                            <div key={p.id} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl border border-slate-100 dark:border-slate-800/80">
                                                                <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">
                                                                    {questionIdx + 1}. {p.titulo}
                                                                </div>
                                                                {renderValue(p, item)}
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
                    </div>
                )
            })}
        </div>
    )
}
