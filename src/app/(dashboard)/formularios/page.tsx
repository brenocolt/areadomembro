"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { useColaborador } from "@/hooks/use-supabase"
import { FileQuestion, CheckCircle2, Clock, Send, ArrowRight, Star, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { toast } from "sonner"
import { useRouter } from "next/navigation"

export default function FormulariosPage() {
    const { colaborador } = useColaborador()
    const [forms, setForms] = useState<any[]>([])
    const [respostasFeitas, setRespostasFeitas] = useState<any[]>([])
    const [activeFormId, setActiveFormId] = useState<string | null>(null)
    const [perguntas, setPerguntas] = useState<any[]>([])
    const [respostas, setRespostas] = useState<Record<string, any>>({})
    const router = useRouter()
    const [submitting, setSubmitting] = useState(false)
    const [colaboradores, setColaboradores] = useState<any[]>([])

    const [npsCount, setNpsCount] = useState(0)
    const [npsLastDate, setNpsLastDate] = useState<Date | null>(null)
    const [npsAberto, setNpsAberto] = useState(true)

    const fetchData = async () => {
        await supabase
            .from('formularios')
            .update({ status: 'encerrado' })
            .eq('status', 'ativo')
            .lt('data_prazo', new Date().toISOString())
            .not('data_prazo', 'is', null)

        const { data: formsData } = await supabase
            .from('formularios')
            .select('*')
            .eq('status', 'ativo')
            .order('created_at', { ascending: false })
        if (formsData) setForms(formsData)

        if (colaborador?.id) {
            const now = new Date()
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
            const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString()

            // Busca apenas respostas do mês atual — respostas de meses anteriores
            // não devem marcar o formulário como "já respondido" no novo mês.
            const { data: rData } = await supabase
                .from('formulario_respostas')
                .select('formulario_id, enviado_em')
                .eq('colaborador_id', colaborador.id)
                .gte('enviado_em', firstDayOfMonth)
                .lte('enviado_em', lastDayOfMonth)
                .order('enviado_em', { ascending: false })
            if (rData) setRespostasFeitas(rData)

            const { data: configData } = await supabase
                .from('configuracoes')
                .select('valor')
                .eq('chave', 'nps_projeto_ativo')
                .single();
            if (configData) {
                setNpsAberto(configData.valor === true || configData.valor === 'true');
            }

            const { data: npsData, count } = await supabase
                .from('nps_projeto_submissoes')
                .select('created_at', { count: 'exact' })
                .eq('avaliador_id', colaborador.id)
                .gte('created_at', firstDayOfMonth)
                .lte('created_at', lastDayOfMonth)
                .order('created_at', { ascending: false })

            if (npsData && npsData.length > 0) {
                setNpsCount(count || npsData.length)
                setNpsLastDate(new Date(npsData[0].created_at))
            } else {
                setNpsCount(0)
                setNpsLastDate(null)
            }
        }

        const { data: cData } = await supabase.from('colaboradores').select('id, nome')
        if (cData) setColaboradores(cData)
    }

    useEffect(() => {
        fetchData()
    }, [colaborador?.id])

    const getLastResponseDate = (formId: string) => {
        const resp = respostasFeitas.find(r => r.formulario_id === formId)
        return resp ? new Date(resp.enviado_em) : null
    }

    const hasResponded = (formId: string) => respostasFeitas.some(r => r.formulario_id === formId)
    const responseCount = (formId: string) => respostasFeitas.filter(r => r.formulario_id === formId).length

    const openForm = async (formId: string) => {
        setActiveFormId(formId)
        const { data } = await supabase
            .from('formulario_perguntas')
            .select('*')
            .eq('formulario_id', formId)
            .order('ordem')
        if (data) setPerguntas(data)
        setRespostas({})
    }

    const handleSubmit = async () => {
        if (!colaborador?.id || !activeFormId) return

        const realPerguntas = perguntas.filter(p => p.tipo !== 'titulo' && p.tipo !== 'secao')

        for (const p of realPerguntas) {
            if (p.obrigatoria) {
                if (p.tipo === 'grade_multipla_escolha') {
                    const linhas: string[] = p.opcoes?.linhas || []
                    const respostaGrade = respostas[p.id] || {}
                    const allAnswered = linhas.every((l: string) => respostaGrade[l])
                    if (!allAnswered) {
                        toast.error(`Pergunta obrigatória não respondida: "${p.titulo}" — responda todas as linhas`)
                        return
                    }
                } else {
                    const val = respostas[p.id]
                    if (!val || (typeof val === 'string' && val.trim() === '') || (Array.isArray(val) && val.length === 0)) {
                        toast.error(`Pergunta obrigatória não respondida: "${p.titulo}"`)
                        return
                    }
                }
            }
        }

        setSubmitting(true)

        const { data: respData, error } = await supabase.from('formulario_respostas').insert({
            formulario_id: activeFormId,
            colaborador_id: colaborador.id,
        }).select().single()

        if (error || !respData) {
            toast.error("Erro ao enviar respostas.")
            setSubmitting(false)
            return
        }

        const items = realPerguntas.map(p => {
            const val = respostas[p.id]
            if (p.tipo === 'grade_multipla_escolha') {
                return {
                    resposta_id: respData.id,
                    pergunta_id: p.id,
                    valor: val ? JSON.stringify(val) : null,
                    valores: null,
                }
            }
            const isMulti = Array.isArray(val)
            return {
                resposta_id: respData.id,
                pergunta_id: p.id,
                valor: isMulti ? null : (val?.toString() || null),
                valores: isMulti ? val : null,
            }
        }).filter(item => item.valor || (Array.isArray(item.valores) && item.valores.length > 0))

        if (items.length === 0) {
            await supabase.from('formulario_respostas').delete().eq('id', respData.id)
            toast.error('Não foi possível salvar suas respostas. Preencha pelo menos uma pergunta antes de enviar.')
            setSubmitting(false)
            return
        }

        const { error: itemsError } = await supabase.from('formulario_respostas_itens').insert(items)
        if (itemsError) {
            await supabase.from('formulario_respostas').delete().eq('id', respData.id)
            console.error('Erro ao salvar itens da resposta:', itemsError)
            toast.error('Erro ao salvar suas respostas: ' + itemsError.message)
            setSubmitting(false)
            return
        }

        toast.success("Respostas enviadas com sucesso! 🎉")
        setSubmitting(false)

        const submittedForm = forms.find(f => f.id === activeFormId)
        setActiveFormId(null)
        await fetchData()

        if (submittedForm?.pagina_destino) {
            let url = submittedForm.pagina_destino
            if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
                url = 'https://' + url
            }
            window.location.href = url
        }
    }

    const pendentes = forms.filter(f => !hasResponded(f.id))
    const jaRespondidos = forms.filter(f => hasResponded(f.id))
    const npsSubmitted = npsCount > 0

    if (activeFormId) {
        const form = forms.find(f => f.id === activeFormId)
        const prevCount = responseCount(activeFormId)
        let questionCounter = 0

        return (
            <div className="flex flex-col gap-6 pb-8 max-w-2xl mx-auto">
                <div className="bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                    {form?.banner_url && (
                        <img src={form.banner_url} className="w-full h-40 object-cover rounded-2xl mb-6" alt="" />
                    )}
                    <div className="p-8">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-violet-50 dark:bg-violet-500/10 p-2 rounded-xl">
                                <FileQuestion className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                            </div>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{form?.titulo}</h1>
                        </div>
                        {form?.descricao && (
                            <p className="text-sm text-slate-500 ml-12 mb-2 whitespace-normal break-words" dangerouslySetInnerHTML={{ __html: form.descricao }}></p>
                        )}
                        {prevCount > 0 && (
                            <div className="ml-12 mb-4">
                                <Badge className="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 text-[10px] font-bold border-none">
                                    Você já respondeu {prevCount}x — esta será uma nova resposta
                                </Badge>
                            </div>
                        )}

                        <div className="space-y-6 mt-6">
                            {perguntas.map((p) => {
                                if (p.tipo === 'titulo') {
                                    return (
                                        <div key={p.id} className="pt-2 pb-1">
                                            {p.titulo && (
                                                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{p.titulo}</h2>
                                            )}
                                            {p.descricao && (
                                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{p.descricao}</p>
                                            )}
                                        </div>
                                    )
                                }

                                if (p.tipo === 'secao') {
                                    return (
                                        <div key={p.id} className="py-2">
                                            <div className="flex items-center gap-3">
                                                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                                                {p.titulo && (
                                                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider whitespace-nowrap">{p.titulo}</span>
                                                )}
                                                <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                                            </div>
                                            {p.descricao && (
                                                <p className="text-xs text-slate-400 dark:text-slate-500 mt-1 text-center">{p.descricao}</p>
                                            )}
                                        </div>
                                    )
                                }

                                questionCounter++
                                const qNum = questionCounter

                                return (
                                    <div key={p.id} className="space-y-2">
                                        <label className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                                            <span className="text-violet-600 dark:text-violet-400">{qNum}.</span>
                                            <span dangerouslySetInnerHTML={{ __html: p.titulo }} />
                                            {p.obrigatoria && <span className="text-rose-500 text-xs">*</span>}
                                        </label>

                                        {p.tipo === 'texto' && (
                                            <Textarea
                                                placeholder="Sua resposta..."
                                                className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl min-h-[80px] resize-none focus-visible:ring-violet-500 text-sm"
                                                value={respostas[p.id] || ''}
                                                onChange={(e) => setRespostas({ ...respostas, [p.id]: e.target.value })}
                                            />
                                        )}

                                        {p.tipo === 'selecao_unica' && Array.isArray(p.opcoes) && (
                                            <div className="space-y-2">
                                                {p.opcoes.map((opt: string, oi: number) => (
                                                    <label key={oi} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600 cursor-pointer transition-colors has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50/50 dark:has-[:checked]:bg-violet-500/10">
                                                        <input
                                                            type="radio"
                                                            name={`q_${p.id}`}
                                                            value={opt}
                                                            checked={respostas[p.id] === opt}
                                                            onChange={() => setRespostas({ ...respostas, [p.id]: opt })}
                                                            className="accent-violet-600"
                                                        />
                                                        <span className="text-sm text-slate-700 dark:text-slate-300">{opt}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}

                                        {p.tipo === 'selecao_multipla' && Array.isArray(p.opcoes) && (
                                            <div className="space-y-2">
                                                {p.opcoes.map((opt: string, oi: number) => {
                                                    const current = respostas[p.id] || []
                                                    const isChecked = current.includes(opt)
                                                    return (
                                                        <label key={oi} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600 cursor-pointer transition-colors has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50/50 dark:has-[:checked]:bg-violet-500/10">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => {
                                                                    const updated = isChecked ? current.filter((v: string) => v !== opt) : [...current, opt]
                                                                    setRespostas({ ...respostas, [p.id]: updated })
                                                                }}
                                                                className="accent-violet-600"
                                                            />
                                                            <span className="text-sm text-slate-700 dark:text-slate-300">{opt}</span>
                                                        </label>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        {p.tipo === 'escala' && (
                                            <div className="space-y-2">
                                                <div className="flex justify-between text-[10px] text-slate-400 px-1">
                                                    <span>{p.opcoes?.labelMin || '1'}</span>
                                                    <span>{p.opcoes?.labelMax || '5'}</span>
                                                </div>
                                                <div className="flex gap-2">
                                                    {[1, 2, 3, 4, 5].map(v => (
                                                        <button
                                                            key={v}
                                                            onClick={() => setRespostas({ ...respostas, [p.id]: v.toString() })}
                                                            className={`flex-1 h-11 rounded-xl font-bold text-sm transition-all ${
                                                                respostas[p.id] === v.toString()
                                                                    ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-violet-100 dark:hover:bg-violet-500/10'
                                                            }`}
                                                        >
                                                            {v}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {p.tipo === 'colaborador_unico' && (
                                            <Select
                                                value={respostas[p.id] || ''}
                                                onValueChange={(v) => setRespostas({ ...respostas, [p.id]: v })}
                                            >
                                                <SelectTrigger className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11 focus:ring-violet-500">
                                                    <SelectValue placeholder="Selecione um colaborador" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-xl">
                                                    {colaboradores.filter(c => c.id !== colaborador?.id).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(c => (
                                                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )}

                                        {p.tipo === 'colaborador_multiplo' && (
                                            <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar">
                                                {colaboradores.filter(c => c.id !== colaborador?.id).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')).map(c => {
                                                    const current = respostas[p.id] || []
                                                    const isChecked = current.includes(c.id)
                                                    return (
                                                        <label key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-violet-300 cursor-pointer transition-colors has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50/50 dark:has-[:checked]:bg-violet-500/10">
                                                            <input
                                                                type="checkbox"
                                                                checked={isChecked}
                                                                onChange={() => {
                                                                    const updated = isChecked ? current.filter((v: string) => v !== c.id) : [...current, c.id]
                                                                    setRespostas({ ...respostas, [p.id]: updated })
                                                                }}
                                                                className="accent-violet-600"
                                                            />
                                                            <span className="text-sm text-slate-700 dark:text-slate-300">{c.nome}</span>
                                                        </label>
                                                    )
                                                })}
                                            </div>
                                        )}

                                        {p.tipo === 'grade_multipla_escolha' && p.opcoes?.linhas && p.opcoes?.colunas && (
                                            <div className="overflow-x-auto">
                                                <table className="w-full text-sm border-collapse">
                                                    <thead>
                                                        <tr>
                                                            <th className="p-2 text-left" />
                                                            {(p.opcoes.colunas as string[]).map((col: string, ci: number) => (
                                                                <th key={ci} className="p-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">{col}</th>
                                                            ))}
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {(p.opcoes.linhas as string[]).map((linha: string, li: number) => {
                                                            const respostaGrade = respostas[p.id] || {}
                                                            return (
                                                                <tr key={li} className={li % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800/30' : ''}>
                                                                    <td className="p-2 text-xs font-medium text-slate-700 dark:text-slate-300 pr-4">{linha}</td>
                                                                    {(p.opcoes.colunas as string[]).map((col: string, ci: number) => (
                                                                        <td key={ci} className="p-2 text-center">
                                                                            <input
                                                                                type="radio"
                                                                                name={`grade_${p.id}_${li}`}
                                                                                value={col}
                                                                                checked={respostaGrade[linha] === col}
                                                                                onChange={() => {
                                                                                    const updated = { ...(respostas[p.id] || {}), [linha]: col }
                                                                                    setRespostas({ ...respostas, [p.id]: updated })
                                                                                }}
                                                                                className="accent-violet-600"
                                                                            />
                                                                        </td>
                                                                    ))}
                                                                </tr>
                                                            )
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>

                        <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <Button variant="ghost" onClick={() => setActiveFormId(null)} className="rounded-xl font-bold text-slate-500">
                                ← Voltar
                            </Button>
                            <Button onClick={handleSubmit} disabled={submitting} className="rounded-xl font-bold h-11 px-8 bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20">
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                {submitting ? 'Enviando...' : 'Enviar Respostas'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8 pb-8">
            <div className="flex items-center gap-3">
                <div className="bg-violet-50 dark:bg-violet-500/10 p-2.5 rounded-2xl border border-violet-100 dark:border-violet-500/20">
                    <FileQuestion className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Formulários</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Responda os formulários disponíveis para você.</p>
                </div>
            </div>

            <div className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Star className="h-5 w-5 text-violet-500" /> NPS Projeto
                </h2>
                <div
                    onClick={() => { if(npsAberto) router.push('/nps-projeto') }}
                    className={`bg-white dark:bg-[#0F172A] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 shadow-sm transition-all group ${
                        npsAberto ? 'cursor-pointer hover:border-violet-300 dark:hover:border-violet-600' : 'opacity-70 cursor-not-allowed'
                    }`}
                >
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl ${!npsAberto ? 'bg-slate-50 dark:bg-slate-800' : npsSubmitted ? 'bg-emerald-50 dark:bg-emerald-500/10' : 'bg-amber-50 dark:bg-amber-500/10'}`}>
                                {!npsAberto
                                    ? <Star className="h-5 w-5 text-slate-400" />
                                    : npsSubmitted
                                    ? <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                    : <Star className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                }
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 dark:text-white">Avaliação NPS do Projeto</h3>
                                <p className="text-sm text-slate-500 mt-0.5">Avaliação mensal de desempenho por projeto</p>
                                {npsSubmitted && npsLastDate && (
                                    <div className="flex items-center gap-3 mt-0.5">
                                        <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                            ✓ Respondido {npsCount}x este mês
                                        </p>
                                        <span className="text-xs text-slate-400">
                                            Última: {npsLastDate.toLocaleDateString('pt-BR')} às {npsLastDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                )}
                                {!npsAberto && (
                                    <p className="text-xs text-rose-500 font-medium mt-1">Este formulário está fechado para respostas no momento.</p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            {npsAberto && npsSubmitted && (
                                <Badge className="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 text-[10px] font-bold border-none">
                                    Responder novamente
                                </Badge>
                            )}
                            {npsAberto && <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-violet-500 transition-colors" />}
                        </div>
                    </div>
                </div>
            </div>

            {pendentes.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Clock className="h-5 w-5 text-amber-500" /> Pendentes
                    </h2>
                    <div className="grid gap-3">
                        {pendentes.map(form => (
                            <div
                                key={form.id}
                                onClick={() => openForm(form.id)}
                                className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 shadow-sm cursor-pointer hover:border-violet-300 dark:hover:border-violet-600 transition-all group"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl">
                                            <FileQuestion className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white">{form.titulo}</h3>
                                            {form.descricao && <p className="text-sm text-slate-500 mt-0.5 whitespace-normal break-words line-clamp-2" dangerouslySetInnerHTML={{ __html: form.descricao }}></p>}
                                            {form.data_prazo && (
                                                <p className="text-xs text-slate-400 mt-1">
                                                    Prazo: {new Date(form.data_prazo).toLocaleDateString('pt-BR')}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-violet-500 transition-colors" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {jaRespondidos.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Já Respondidos
                    </h2>
                    <div className="grid gap-3">
                        {jaRespondidos.map(form => {
                            const lastDate = getLastResponseDate(form.id)
                            const count = responseCount(form.id)
                            return (
                                <div
                                    key={form.id}
                                    onClick={() => openForm(form.id)}
                                    className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 shadow-sm cursor-pointer hover:border-violet-300 dark:hover:border-violet-600 transition-all group"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
                                                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 dark:text-white">{form.titulo}</h3>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                                        ✓ Respondido {count}x
                                                    </p>
                                                    {lastDate && (
                                                        <span className="text-xs text-slate-400">
                                                            Última: {lastDate.toLocaleDateString('pt-BR')} às {lastDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    )}
                                                </div>
                                                {form.data_prazo && (
                                                    <p className="text-xs text-slate-400 mt-1">
                                                        Prazo: {new Date(form.data_prazo).toLocaleDateString('pt-BR')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Badge className="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 text-[10px] font-bold border-none">
                                                Responder novamente
                                            </Badge>
                                            <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-violet-500 transition-colors" />
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {forms.length === 0 && !npsSubmitted && (
                <div className="bg-white dark:bg-[#0F172A] rounded-3xl p-12 border border-slate-100 dark:border-slate-800/50 shadow-sm text-center">
                    <FileQuestion className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-lg font-bold text-slate-400">Nenhum formulário adicional disponível</p>
                    <p className="text-sm text-slate-400 mt-1">Quando houver formulários ativos, eles aparecerão aqui.</p>
                </div>
            )}
        </div>
    )
}
