"use client"
import { useState, useEffect, useMemo } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Send, ArrowRight, CheckCircle2, AlertTriangle, FlaskConical, RotateCcw } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { buildSections, computeNext, validateSection, buildRespostaItens } from "@/lib/forms-runtime"
import { colaboradorNoPublico, resolveAlvos, loadFormularioPublico, type FormularioPublico } from "@/lib/forms-publico"
import { PerguntaInput } from "@/components/forms/pergunta-input"
import { isSchemaDesatualizado } from "@/lib/db-compat"

interface Colaborador { id: string; nome: string; cargo_atual?: string | null; nucleo_atual?: string | null }

const SELF_KEY = '__self__'

interface Props {
    formulario: { id: string; titulo: string } | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

// Simulação de resposta: mostra exatamente o que um membro veria ao abrir o
// formulário — incluindo as abas por pessoa de um formulário direcionado, a
// lógica condicional entre seções e a opção "Não avaliar". Nada é gravado no
// banco; o envio só reporta o que TERIA sido salvo.
export function SimularFormularioDialog({ formulario, open, onOpenChange }: Props) {
    const [loading, setLoading] = useState(true)
    const [perguntas, setPerguntas] = useState<any[]>([])
    const [publico, setPublico] = useState<FormularioPublico>({ quemResponde: [], quemRecebe: [] })
    const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
    const [projetos, setProjetos] = useState<{ id: string, nome: string }[]>([])
    const [comoId, setComoId] = useState<string>('')

    const [respostasPorAlvo, setRespostasPorAlvo] = useState<Record<string, Record<string, any>>>({})
    const [sectionIdxPorAlvo, setSectionIdxPorAlvo] = useState<Record<string, number>>({})
    const [historyPorAlvo, setHistoryPorAlvo] = useState<Record<string, number[]>>({})
    const [activeAlvoId, setActiveAlvoId] = useState<string | null>(null)
    const [enviados, setEnviados] = useState<Set<string>>(new Set())

    useEffect(() => {
        if (!open || !formulario) return
        async function carregar() {
            setLoading(true)
            // Só perguntas ativas — a simulação deve mostrar exatamente o
            // que um membro real veria, e uma pergunta arquivada (removida
            // numa edição do formulário) não aparece mais pra responder.
            const perguntasComAtiva = supabase.from('formulario_perguntas').select('*').eq('formulario_id', formulario!.id).eq('ativa', true).order('ordem')
            const [comAtivaResult, pub, { data: cData }, { data: projData }] = await Promise.all([
                perguntasComAtiva,
                loadFormularioPublico(formulario!.id),
                supabase.from('colaboradores').select('id, nome, cargo_atual, nucleo_atual').order('nome'),
                supabase.from('projetos').select('id, nome').eq('status', 'Ativo').order('nome'),
            ])
            const { data: pData } = isSchemaDesatualizado(comAtivaResult.error)
                ? await supabase.from('formulario_perguntas').select('*').eq('formulario_id', formulario!.id).order('ordem')
                : comAtivaResult
            setPerguntas(pData || [])
            setPublico(pub)
            setColaboradores(cData || [])
            setProjetos(projData || [])
            setComoId('')
            resetPreenchimento()
            setLoading(false)
        }
        carregar()
    }, [open, formulario])

    const resetPreenchimento = () => {
        setRespostasPorAlvo({})
        setSectionIdxPorAlvo({})
        setHistoryPorAlvo({})
        setEnviados(new Set())
    }

    const como = colaboradores.find(c => c.id === comoId) || null
    const veFormulario = como ? colaboradorNoPublico(como, publico.quemResponde) : false
    const alvos = useMemo(() => {
        if (!como || publico.quemRecebe.length === 0) return null
        return resolveAlvos(colaboradores, publico.quemRecebe, como.id)
            .map(a => ({ id: a.id, nome: a.nome }))
            .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    }, [como, colaboradores, publico])

    // Trocar de "simular como" (ou mudar o conjunto de alvos) reinicia o
    // preenchimento e volta para a primeira aba. Depende dos ids em si, não
    // só da quantidade — duas pessoas podem ter o mesmo número de alvos.
    const alvosKey = (alvos || []).map(a => a.id).join(',')
    useEffect(() => {
        setActiveAlvoId(alvos && alvos.length > 0 ? alvos[0].id : null)
        resetPreenchimento()
    }, [comoId, alvosKey])

    const alvoKey = alvos ? (activeAlvoId || SELF_KEY) : SELF_KEY
    const respostas = respostasPorAlvo[alvoKey] || {}
    const sectionIndex = sectionIdxPorAlvo[alvoKey] ?? 0
    const history = historyPorAlvo[alvoKey] || []

    const sections = useMemo(() => buildSections(perguntas), [perguntas])
    const questionNumbers = useMemo(() => {
        const map = new Map<string, number>()
        let n = 0
        for (const p of perguntas) {
            if (p.tipo === 'titulo' || p.tipo === 'secao') continue
            map.set(p.id, ++n)
        }
        return map
    }, [perguntas])

    const setResposta = (perguntaId: string, valor: any) => {
        setRespostasPorAlvo(prev => ({ ...prev, [alvoKey]: { ...(prev[alvoKey] || {}), [perguntaId]: valor } }))
    }

    const handleNext = () => {
        const section = sections[sectionIndex]
        if (!section) return
        const erro = validateSection(section, respostas)
        if (erro) { toast.error(erro); return }

        const next = computeNext(sections, sectionIndex, respostas)
        if (next.type === 'section') {
            setHistoryPorAlvo(prev => ({ ...prev, [alvoKey]: [...(prev[alvoKey] || []), sectionIndex] }))
            setSectionIdxPorAlvo(prev => ({ ...prev, [alvoKey]: next.index }))
            return
        }

        // "Envio" — nada é gravado. Reporta quantas respostas TERIAM sido salvas.
        const visitadas = new Set([...history, sectionIndex])
        const idsVisitados = new Set(
            sections.filter((_, i) => visitadas.has(i)).flatMap(s => s.perguntas.map((p: any) => p.id))
        )
        const reais = perguntas.filter(p => p.tipo !== 'titulo' && p.tipo !== 'secao' && idsVisitados.has(p.id))
        const itens = buildRespostaItens('simulacao', reais, respostas)
        const naoAvaliadas = reais.length - itens.length

        const nomeAlvo = alvos?.find(a => a.id === activeAlvoId)?.nome
        toast.success(
            `Simulação${nomeAlvo ? ` sobre ${nomeAlvo}` : ''}: ${itens.length} resposta(s) seriam gravadas` +
            (naoAvaliadas > 0 ? ` · ${naoAvaliadas} não gravada(s) ("Não avaliar" ou em branco)` : '') +
            ' — nada foi salvo no banco.'
        )

        if (alvos && activeAlvoId) {
            const novos = new Set(enviados); novos.add(activeAlvoId)
            setEnviados(novos)
            const proximo = alvos.find(a => !novos.has(a.id))
            if (proximo) setActiveAlvoId(proximo.id)
        } else {
            setEnviados(new Set([SELF_KEY]))
        }
    }

    const handleBack = () => {
        if (history.length === 0) return
        const prev = history[history.length - 1]
        setHistoryPorAlvo(p => ({ ...p, [alvoKey]: (p[alvoKey] || []).slice(0, -1) }))
        setSectionIdxPorAlvo(p => ({ ...p, [alvoKey]: prev }))
    }

    const currentSection = sections[sectionIndex] || sections[0]
    const nextIsSubmit = currentSection ? computeNext(sections, sectionIndex, respostas).type === 'submit' : false

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-3xl p-0 overflow-hidden text-slate-900 dark:text-white">
                <div className="px-8 pt-8 pb-4">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            <FlaskConical className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                            Simular resposta
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 font-medium">
                            {formulario?.titulo} — nada é gravado no banco.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-8 pb-4 space-y-5 max-h-[62vh] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="p-8 text-center text-slate-400 text-sm">Carregando formulário...</div>
                    ) : (
                        <>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Simular como</label>
                                <Select value={comoId} onValueChange={setComoId}>
                                    <SelectTrigger className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11">
                                        <SelectValue placeholder="Escolha um colaborador para simular" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-xl max-h-72">
                                        {colaboradores.map(c => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.nome} — {c.cargo_atual || 'sem cargo'} / {c.nucleo_atual || 'sem núcleo'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            {!como ? (
                                <p className="text-sm text-slate-400 italic text-center py-6">
                                    Escolha alguém acima para ver o formulário exatamente como essa pessoa veria.
                                </p>
                            ) : !veFormulario ? (
                                <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-3">
                                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-700 dark:text-amber-300">
                                        <strong>{como.nome}</strong> não veria este formulário: o cargo/núcleo dela ({como.cargo_atual || '—'} / {como.nucleo_atual || '—'}) não está no público de &quot;Quem Responde&quot;.
                                    </p>
                                </div>
                            ) : alvos && alvos.length === 0 ? (
                                <div className="flex items-start gap-2 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-xl px-4 py-3">
                                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                                    <p className="text-xs text-amber-700 dark:text-amber-300">
                                        <strong>{como.nome}</strong> não veria este formulário: o público de &quot;Quem Recebe&quot; não corresponde a nenhuma outra pessoa (lembre que ninguém avalia a si mesmo).
                                    </p>
                                </div>
                            ) : (
                                <>
                                    {alvos && (
                                        <div>
                                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                                                {alvos.length} aba{alvos.length !== 1 ? 's' : ''} de preenchimento:
                                            </p>
                                            <div className="flex flex-wrap gap-2">
                                                {alvos.map(a => {
                                                    const done = enviados.has(a.id)
                                                    const active = a.id === activeAlvoId
                                                    return (
                                                        <button
                                                            key={a.id}
                                                            type="button"
                                                            onClick={() => setActiveAlvoId(a.id)}
                                                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                                                active ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/20'
                                                                    : done ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                                                    : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-violet-50 dark:hover:bg-violet-500/10'
                                                            }`}
                                                        >
                                                            {done && <CheckCircle2 className="h-3.5 w-3.5" />}
                                                            {a.nome}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {sections.length > 1 && (
                                        <Badge className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-bold border-none">
                                            Seção {sectionIndex + 1} de {sections.length}
                                        </Badge>
                                    )}

                                    {currentSection && (currentSection.titulo || currentSection.descricao) && (
                                        <div className="pb-3 border-b border-slate-100 dark:border-slate-800">
                                            {currentSection.titulo && <h2 className="text-lg font-bold text-slate-900 dark:text-white">{currentSection.titulo}</h2>}
                                            {currentSection.descricao && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{currentSection.descricao}</p>}
                                        </div>
                                    )}

                                    <div className="space-y-6">
                                        {(currentSection?.perguntas || []).map((p: any) => (
                                            <PerguntaInput
                                                key={p.id}
                                                pergunta={p}
                                                valor={respostas[p.id]}
                                                onChange={(v) => setResposta(p.id, v)}
                                                colaboradores={colaboradores}
                                                projetos={projetos}
                                                selfId={como.id}
                                                numero={questionNumbers.get(p.id) || 0}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </>
                    )}
                </div>

                <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-between gap-3 bg-slate-50/50 dark:bg-black/10">
                    <Button variant="ghost" onClick={resetPreenchimento} className="rounded-xl font-bold h-11 text-slate-500" disabled={!como}>
                        <RotateCcw className="h-4 w-4 mr-2" /> Recomeçar
                    </Button>
                    <div className="flex gap-2">
                        {history.length > 0 && (
                            <Button variant="ghost" onClick={handleBack} className="rounded-xl font-bold h-11 text-slate-500">← Voltar</Button>
                        )}
                        <Button
                            onClick={handleNext}
                            disabled={loading || !como || !veFormulario || (alvos !== null && alvos.length === 0)}
                            className="rounded-xl font-bold h-11 px-8 bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : (nextIsSubmit ? <Send className="h-4 w-4 mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />)}
                            {nextIsSubmit ? 'Simular envio' : 'Próxima Seção'}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
