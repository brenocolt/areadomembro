"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { useColaborador } from "@/hooks/use-supabase"
import { toast } from "sonner"
import {
    Star, Send, Loader2, ChevronRight, ChevronLeft, Users,
    CheckCircle2, MessageSquare, Calendar
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"

// ─── Types ───────────────────────────────────────────────────────────────
interface Projeto { id: string; nome: string }
interface Colaborador { id: string; nome: string; cargo_atual: string }

interface GerenteData {
    gerente_id: string
    comunicacao: string
    suporte: string
    relacionamento: string
    resolutividade: string
    lideranca: string
    feedback_texto: string
    precisa_feedback: string
}

interface ConsultorData {
    consultor_id: string
    comunicacao: string
    dedicacao: string
    confianca: string
    pontualidade: string
    organizacao: string
    proatividade: string
    qualidade_entregas: string
    dominio_tecnico: string
    feedback_texto: string
    precisa_feedback: string
    ha_outro: string
}

const SCALE_LABELS: Record<number, string> = {
    1: "Abaixo das expectativas",
    2: "Pode melhorar",
    3: "Razoável/Neutro",
    4: "Satisfatório",
    5: "Acima das expectativas",
}

const MESES = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
]

const emptyGerenteData = (): GerenteData => ({
    gerente_id: "", comunicacao: "", suporte: "", relacionamento: "",
    resolutividade: "", lideranca: "", feedback_texto: "", precisa_feedback: ""
})

const emptyConsultorData = (): ConsultorData => ({
    consultor_id: "", comunicacao: "", dedicacao: "", confianca: "",
    pontualidade: "", organizacao: "", proatividade: "", qualidade_entregas: "",
    dominio_tecnico: "", feedback_texto: "", precisa_feedback: "", ha_outro: ""
})

// ─── Scale Picker Component ─────────────────────────────────────────────
function ScalePicker({ value, onChange, label, required, obs }: {
    value: string; onChange: (v: string) => void; label: string; required?: boolean; obs?: string
}) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-bold text-slate-900 dark:text-slate-200 leading-snug block">
                {label} {required && <span className="text-rose-500">*</span>}
            </label>
            {obs && <p className="text-xs text-slate-400 italic">{obs}</p>}
            <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(v => (
                    <button key={v} type="button" onClick={() => onChange(v.toString())}
                        className={`flex-1 h-12 rounded-xl font-bold text-sm transition-all relative group ${
                            value === v.toString()
                                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20 scale-105'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-violet-100 dark:hover:bg-violet-500/10'
                        }`}
                    >
                        {v}
                        <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[9px] text-slate-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            {SCALE_LABELS[v]}
                        </span>
                    </button>
                ))}
            </div>
            <div className="flex justify-between text-[9px] text-slate-400 px-1 mt-1">
                <span>Abaixo das expectativas</span>
                <span>Acima das expectativas</span>
            </div>
        </div>
    )
}

// ─── Radio Yes/No ────────────────────────────────────────────────────────
function RadioYesNo({ value, onChange, label, required }: {
    value: string; onChange: (v: string) => void; label: string; required?: boolean
}) {
    return (
        <div className="space-y-2">
            <label className="text-sm font-bold text-slate-900 dark:text-slate-200 block">
                {label} {required && <span className="text-rose-500">*</span>}
            </label>
            <div className="flex gap-3">
                {["Sim", "Não"].map(opt => (
                    <label key={opt} className={`flex items-center gap-3 px-5 py-3 rounded-xl border cursor-pointer transition-all ${
                        value === opt
                            ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-500/10'
                            : 'border-slate-200 dark:border-slate-700 hover:border-violet-300'
                    }`}>
                        <input type="radio" value={opt} checked={value === opt}
                            onChange={() => onChange(opt)} className="accent-violet-600" />
                        <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{opt}</span>
                    </label>
                ))}
            </div>
        </div>
    )
}

// ─── Step indicator ──────────────────────────────────────────────────────
function StepIndicator({ steps, current }: { steps: string[]; current: number }) {
    return (
        <div className="flex items-center gap-2 mb-8">
            {steps.map((label, i) => (
                <div key={i} className="flex items-center gap-2">
                    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                        i === current
                            ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                            : i < current
                                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                                : 'bg-slate-100 text-slate-400 dark:bg-slate-800'
                    }`}>
                        {i < current ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>{i + 1}</span>}
                        <span className="hidden sm:inline">{label}</span>
                    </div>
                    {i < steps.length - 1 && <ChevronRight className="h-4 w-4 text-slate-300" />}
                </div>
            ))}
        </div>
    )
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════════════════════════════════════════
export default function NPSProjetoPage() {
    const { colaborador } = useColaborador()

    // Data
    const [projetos, setProjetos] = useState<Projeto[]>([])
    const [colaboradores, setColaboradores] = useState<Colaborador[]>([])

    // Step Tracking
    const [step, setStep] = useState(0) // 0=Identificação, 1=NPS Gerente, 2+=NPS Consultor(es), last=Concluído
    const [submitting, setSubmitting] = useState(false)
    const [done, setDone] = useState(false)

    // Identificação
    const [projetoId, setProjetoId] = useState("")
    const [mesRef, setMesRef] = useState("")
    const [anoRef, setAnoRef] = useState(new Date().getFullYear().toString())

    // NPS Gerente data
    const [gerenteData, setGerenteData] = useState<GerenteData>(emptyGerenteData())

    // NPS Consultor data (array for dynamic blocks, max 3)
    const [consultoresData, setConsultoresData] = useState<ConsultorData[]>([emptyConsultorData()])
    const [activeConsultorIdx, setActiveConsultorIdx] = useState(0)
    const [apenasGerente, setApenasGerente] = useState(false)

    // Role detection
    const cargoAtual = colaborador?.cargo_atual || ""
    const isGerente = cargoAtual.toLowerCase().includes("gerente") && !cargoAtual.toLowerCase().includes("assessor")
    // Anyone who is NOT a manager should evaluate the manager
    const isConsultor = !isGerente

    // Build step names based on role
    const buildSteps = useCallback(() => {
        const steps = ["Identificação"]
        if (isConsultor) {
            steps.push("Gerente")
        }
        if (!apenasGerente) {
            for (let i = 0; i < consultoresData.length; i++) {
                steps.push(`Consultor ${consultoresData.length > 1 ? i + 1 : ''}`.trim())
            }
        }
        steps.push("Enviar")
        return steps
    }, [isConsultor, consultoresData.length, apenasGerente])

    const steps = buildSteps()

    const [isFormClosed, setIsFormClosed] = useState(false)
    const [loadingConfig, setLoadingConfig] = useState(true)

    // Fetch data
    useEffect(() => {
        const fetchData = async () => {
            try {
                const { data: configData } = await supabase
                    .from('configuracoes')
                    .select('valor')
                    .eq('chave', 'nps_projeto_ativo')
                    .single();
                
                if (configData && (configData.valor === false || configData.valor === 'false')) {
                    setIsFormClosed(true)
                }

                // Sync projects from Monday (once a day per user, non-blocking)
                const lastSync = localStorage.getItem('last_monday_sync')
                const now = new Date().getTime()
                const oneDay = 24 * 60 * 60 * 1000
                if (!lastSync || now - parseInt(lastSync) > oneDay) {
                    localStorage.setItem('last_monday_sync', now.toString())
                    fetch('/api/monday/projects')
                        .then(res => res.json())
                        .then(data => console.log('Monday background sync result:', data))
                        .catch(err => console.warn('Monday background sync failed:', err))
                }

                const { data: p } = await supabase.from('projetos').select('id, nome').eq('status', 'Ativo')
                if (p) {
                    const sorted = p.sort((a, b) => a.nome.localeCompare(b.nome))
                    setProjetos(sorted)
                }
            } catch (error) {
                console.error('Error fetching data:', error)
            } finally {
                setLoadingConfig(false)
            }

            const { data: c } = await supabase.from('colaboradores').select('id, nome, cargo_atual')
            if (c) setColaboradores(c)
        }
        fetchData()
    }, [])

    if (loadingConfig) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
            </div>
        )
    }

    if (isFormClosed) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] text-center max-w-md mx-auto">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-6">
                    <Star className="h-8 w-8 text-slate-400" />
                </div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Formulário Fechado</h1>
                <p className="text-slate-500 dark:text-slate-400 mb-8">
                    A avaliação de NPS do Projeto está fechada para respostas no momento.
                    Por favor, aguarde a abertura do próximo ciclo.
                </p>
                <Button onClick={() => window.history.back()} variant="outline" className="rounded-xl">
                    Voltar aos Formulários
                </Button>
            </div>
        )
    }

    // Helpers
    const EXTRA_GERENTE_IDS = ['89251a1b-a1e7-491c-80ed-d64895370fad']
    const gerentes = colaboradores.filter(c =>
        (c.cargo_atual?.toLowerCase().includes("gerente") && !c.cargo_atual?.toLowerCase().includes("assessor"))
        || EXTRA_GERENTE_IDS.includes(c.id)
    )
    const consultoresDisponiveis = colaboradores.filter(c =>
        c.id !== colaborador?.id
    )

    // Already selected consultores IDs (to hide from other dropdowns)
    const selectedConsultorIds = consultoresData.map(c => c.consultor_id).filter(Boolean)

    // ─── Validation ──────────────────────────────────────────────────────
    const validateStep = () => {
        if (step === 0) {
            if (!projetoId) { toast.error("Selecione o projeto."); return false }
            if (!mesRef) { toast.error("Selecione o mês de referência."); return false }
            return true
        }

        // NPS Gerente step (only if consultor)
        if (isConsultor && step === 1) {
            const d = gerenteData
            if (!d.gerente_id) { toast.error("Selecione o gerente."); return false }
            for (const f of ["comunicacao", "suporte", "relacionamento", "resolutividade", "lideranca"] as (keyof GerenteData)[]) {
                if (!d[f]) { toast.error(`Preencha a avaliação de ${f}.`); return false }
            }
            if (!d.feedback_texto.trim()) { toast.error("Escreva suas percepções sobre o gerente."); return false }
            if (!d.precisa_feedback) { toast.error("Indique se o gerente precisa de feedback."); return false }
            return true
        }

        // NPS Consultor step
        const consultorStepBase = isConsultor ? 2 : 1
        const cidx = step - consultorStepBase
        if (cidx >= 0 && cidx < consultoresData.length) {
            const d = consultoresData[cidx]
            if (!d.consultor_id) { toast.error("Selecione o consultor."); return false }
            for (const f of ["comunicacao", "dedicacao", "confianca", "pontualidade", "organizacao", "proatividade", "qualidade_entregas", "dominio_tecnico"] as (keyof ConsultorData)[]) {
                if (!d[f]) { toast.error(`Preencha a avaliação de ${f}.`); return false }
            }
            if (!d.feedback_texto.trim()) { toast.error("Escreva suas percepções sobre o consultor."); return false }
            if (!d.precisa_feedback) { toast.error("Indique se o consultor precisa de feedback."); return false }
            // ha_outro only matters if it's not the last possible block
            if (cidx < 2 && !d.ha_outro) { toast.error("Indique se há outro consultor no projeto."); return false }
            return true
        }

        return true
    }

    // ─── Next step logic ─────────────────────────────────────────────────
    const handleNext = () => {
        if (!validateStep()) return

        // Check if current consultor step said "Sim" → add another block
        const consultorStepBase = isConsultor ? 2 : 1
        const cidx = step - consultorStepBase
        if (cidx >= 0 && cidx < consultoresData.length) {
            const d = consultoresData[cidx]
            if (d.ha_outro === "Sim" && cidx < 2 && consultoresData.length <= cidx + 1) {
                setConsultoresData([...consultoresData, emptyConsultorData()])
            }
        }

        setStep(step + 1)
    }

    const handlePrev = () => {
        if (step > 0) setStep(step - 1)
    }

    // ─── Submit ──────────────────────────────────────────────────────────
    const handleSubmit = async () => {
        if (!colaborador?.id) return
        setSubmitting(true)

        try {
            const mes = parseInt(mesRef)
            const ano = parseInt(anoRef)

            // 1. Save NPS Gerente evaluation
            if (isConsultor) {
                const g = gerenteData
                const npsGeral = (
                    [g.comunicacao, g.suporte, g.relacionamento, g.resolutividade, g.lideranca]
                        .reduce((sum, v) => sum + parseFloat(v), 0) / 5
                )

                await supabase.from('avaliacoes_nps').upsert({
                    colaborador_id: g.gerente_id,
                    avaliador_id: colaborador.id,
                    mes, ano,
                    comunicacao: parseFloat(g.comunicacao),
                    suporte: parseFloat(g.suporte),
                    relacionamento: parseFloat(g.relacionamento),
                    resolutividade: parseFloat(g.resolutividade),
                    lideranca: parseFloat(g.lideranca),
                    nps_geral: npsGeral,
                    projeto_id: projetoId || null,
                    cargo_avaliador: cargoAtual,
                    feedback_texto: g.feedback_texto,
                    precisa_feedback: g.precisa_feedback === "Sim",
                    tipo_avaliacao: 'gerente',
                }, { onConflict: 'colaborador_id, mes, ano, avaliador_id' }).throwOnError()
            }

            // 2. Save NPS Consultor evaluations (skip if apenasGerente)
            if (!apenasGerente) {
                for (const c of consultoresData) {
                    if (!c.consultor_id) continue
                    const npsGeral = (
                        [c.comunicacao, c.dedicacao, c.confianca, c.pontualidade, c.organizacao, c.proatividade, c.qualidade_entregas, c.dominio_tecnico]
                            .reduce((sum, v) => sum + parseFloat(v), 0) / 8
                    )

                    await supabase.from('avaliacoes_nps').upsert({
                        colaborador_id: c.consultor_id,
                        avaliador_id: colaborador.id,
                        mes, ano,
                        comunicacao: parseFloat(c.comunicacao),
                        dedicacao: parseFloat(c.dedicacao),
                        confianca: parseFloat(c.confianca),
                        pontualidade: parseFloat(c.pontualidade),
                        organizacao: parseFloat(c.organizacao),
                        proatividade: parseFloat(c.proatividade),
                        qualidade_entregas: parseFloat(c.qualidade_entregas),
                        dominio_tecnico: parseFloat(c.dominio_tecnico),
                        nps_geral: npsGeral,
                        projeto_id: projetoId || null,
                        cargo_avaliador: cargoAtual,
                        feedback_texto: c.feedback_texto,
                        precisa_feedback: c.precisa_feedback === "Sim",
                        tipo_avaliacao: 'consultor',
                    }, { onConflict: 'colaborador_id, mes, ano, avaliador_id' }).throwOnError()
                }
            }

            // 3. Record submission
            await supabase.from('nps_projeto_submissoes').insert({
                avaliador_id: colaborador.id,
                projeto_id: projetoId || null,
                mes, ano,
            }).throwOnError()

            setDone(true)
            toast.success("NPS Projeto enviado com sucesso! 🎉")
        } catch (err: any) {
            toast.error("Erro ao enviar: " + (err.message || "Erro desconhecido"))
        } finally {
            setSubmitting(false)
        }
    }

    // ─── Update helpers ──────────────────────────────────────────────────
    const updateGerente = (field: keyof GerenteData, value: string) =>
        setGerenteData(prev => ({ ...prev, [field]: value }))

    const updateConsultor = (idx: number, field: keyof ConsultorData, value: string) =>
        setConsultoresData(prev => prev.map((c, i) => i === idx ? { ...c, [field]: value } : c))

    // ─── Done ────────────────────────────────────────────────────────────
    if (done) {
        return (
            <div className="flex flex-col items-center justify-center gap-6 py-20 max-w-lg mx-auto text-center">
                <div className="bg-emerald-50 dark:bg-emerald-500/10 p-5 rounded-3xl">
                    <CheckCircle2 className="h-16 w-16 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white font-display">NPS Enviado!</h1>
                <p className="text-slate-500 dark:text-slate-400">
                    Suas avaliações foram registradas com sucesso e já estão vinculadas aos perfis dos avaliados.
                </p>
                <Button onClick={() => { setDone(false); setStep(0); setGerenteData(emptyGerenteData()); setConsultoresData([emptyConsultorData()]); setProjetoId(""); setMesRef("") }}
                    className="rounded-xl font-bold h-11 px-8 bg-violet-600 hover:bg-violet-700 text-white">
                    Preencher outro NPS
                </Button>
            </div>
        )
    }

    // ─── Render steps ────────────────────────────────────────────────────
    const consultorStepBase = isConsultor ? 2 : 1
    const isLastStep = step === steps.length - 1
    const isConsultorStep = step >= consultorStepBase && step < steps.length - 1
    const consultorIdx = isConsultorStep ? step - consultorStepBase : -1

    return (
        <div className="flex flex-col gap-6 pb-8 max-w-2xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="bg-violet-50 dark:bg-violet-500/10 p-2.5 rounded-2xl border border-violet-100 dark:border-violet-500/20">
                    <Star className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white font-display">NPS Projeto</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Avaliação mensal de desempenho por projeto</p>
                </div>
            </div>

            {/* Steps */}
            <StepIndicator steps={steps} current={step} />

            <div className="bg-white dark:bg-[#0F172A] rounded-3xl p-8 border border-slate-100 dark:border-slate-800/50 shadow-sm">

                {/* ═══ STEP 0: Identificação ═══ */}
                {step === 0 && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Identificação</h2>
                            <p className="text-sm text-slate-500">Selecione o projeto e o mês desta coleta NPS.</p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-900 dark:text-slate-200">
                                De qual projeto estamos falando? <span className="text-rose-500">*</span>
                            </label>
                            <Select value={projetoId} onValueChange={setProjetoId}>
                                <SelectTrigger className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11">
                                    <SelectValue placeholder="Selecione o projeto" />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-xl">
                                    {projetos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-900 dark:text-slate-200">
                                    Mês de referência <span className="text-rose-500">*</span>
                                </label>
                                <Select value={mesRef} onValueChange={setMesRef}>
                                    <SelectTrigger className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11">
                                        <SelectValue placeholder="Mês" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-xl">
                                        {MESES.map((m, i) => <SelectItem key={i} value={(i + 1).toString()}>{m}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Ano</label>
                                <Select value={anoRef} onValueChange={setAnoRef}>
                                    <SelectTrigger className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-xl">
                                        {[2025, 2026, 2027].map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>

                        <div className="p-4 rounded-xl bg-violet-50/50 dark:bg-violet-500/5 border border-violet-100 dark:border-violet-500/10">
                            <p className="text-sm text-slate-600 dark:text-slate-400">
                                <span className="font-bold text-violet-700 dark:text-violet-400">Seu cargo:</span>{" "}
                                {cargoAtual || "Carregando..."}
                            </p>
                            <p className="text-xs text-slate-500 mt-1">
                                {isConsultor
                                    ? "Como Consultor/Assessor, você avaliará o Gerente e depois os Consultores do projeto."
                                    : "Como Gerente, você avaliará os Consultores do projeto."}
                            </p>
                        </div>
                    </div>
                )}

                {/* ═══ STEP 1 (Consultor only): NPS Gerente ═══ */}
                {isConsultor && step === 1 && (
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                                <Users className="h-5 w-5 text-violet-500" /> NPS GERENTE
                            </h2>
                            <p className="text-sm text-slate-500 leading-relaxed">
                                Chegou a hora de avaliar os nossos gerentes! Lembre-se de que essa avaliação é importante
                                para que os gerentes saibam onde melhorar, então vamos de transparência!!
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-900 dark:text-slate-200">
                                Quem está acompanhando como gerente desse projeto? <span className="text-rose-500">*</span>
                            </label>
                            <Select value={gerenteData.gerente_id} onValueChange={v => updateGerente("gerente_id", v)}>
                                <SelectTrigger className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11">
                                    <SelectValue placeholder="Escolher" />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-xl">
                                    {gerentes.map(g => <SelectItem key={g.id} value={g.id}>{g.nome}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <ScalePicker label="Quão clara foi a COMUNICAÇÃO do seu gerente, tanto na escuta quanto na fala, neste mês?"
                            value={gerenteData.comunicacao} onChange={v => updateGerente("comunicacao", v)} required />

                        <ScalePicker label="Avalie o quão você ficou satisfeito(a) com o SUPORTE do seu gerente em relação à EXECUÇÃO do projeto durante esse mês."
                            value={gerenteData.suporte} onChange={v => updateGerente("suporte", v)} required />

                        <ScalePicker label="Avalie o quão você ficou satisfeito(a) com o RELACIONAMENTO do seu gerente em relação à EQUIPE do projeto durante esse mês."
                            value={gerenteData.relacionamento} onChange={v => updateGerente("relacionamento", v)} required />

                        <ScalePicker label="Avalie o nível de RESOLUTIVIDADE do seu gerente do projeto durante esse mês."
                            value={gerenteData.resolutividade} onChange={v => updateGerente("resolutividade", v)} required />

                        <ScalePicker label="Avalie o quão satisfeito(a) você ficou com a LIDERANÇA do seu gerente em relação ao projeto neste mês."
                            value={gerenteData.lideranca} onChange={v => updateGerente("lideranca", v)} required />

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-900 dark:text-slate-200">
                                Deixe aqui suas percepções sobre o GERENTE, com pontos positivos, pontos de melhorias e qualquer situação que tenha ocorrido. <span className="text-rose-500">*</span>
                            </label>
                            <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">OBS: O avaliado NÃO terá acesso à resposta.</p>
                            <Textarea value={gerenteData.feedback_texto} onChange={e => updateGerente("feedback_texto", e.target.value)}
                                placeholder="Escreva suas percepções..."
                                className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl min-h-[100px] resize-none focus-visible:ring-violet-500 text-sm" />
                        </div>

                        <RadioYesNo label="Você acha que o gerente precisa de um momento de feedback?"
                            value={gerenteData.precisa_feedback} onChange={v => updateGerente("precisa_feedback", v)} required />

                        <div className="space-y-2 mt-4 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-100 dark:border-slate-800/40">
                            <label className="text-sm font-bold text-slate-900 dark:text-slate-200 block">
                                Deseja avaliar apenas o gerente neste NPS? <span className="text-xs text-slate-400 font-normal">(pular avaliação de consultores)</span>
                            </label>
                            <div className="flex gap-3">
                                {[{v: false, l: 'Não, avaliar consultores também'}, {v: true, l: 'Sim, avaliar apenas o gerente'}].map(opt => (
                                    <label key={String(opt.v)} className={`flex items-center gap-3 px-5 py-3 rounded-xl border cursor-pointer transition-all ${
                                        apenasGerente === opt.v
                                            ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-500/10'
                                            : 'border-slate-200 dark:border-slate-700 hover:border-violet-300'
                                    }`}>
                                        <input type="radio" checked={apenasGerente === opt.v}
                                            onChange={() => setApenasGerente(opt.v)} className="accent-violet-600" />
                                        <span className="text-sm text-slate-700 dark:text-slate-300 font-medium">{opt.l}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ NPS Consultor steps ═══ */}
                {isConsultorStep && consultorIdx >= 0 && consultorIdx < consultoresData.length && (() => {
                    const d = consultoresData[consultorIdx]
                    const isLastConsultor = consultorIdx >= 2 // Max 3 consultores (index 0, 1, 2)
                    return (
                        <div className="space-y-6">
                            <div>
                                <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-1 flex items-center gap-2">
                                    <Users className="h-5 w-5 text-violet-500" /> CONSULTOR
                                    {consultoresData.length > 1 && (
                                        <Badge className="bg-violet-100 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400 text-xs border-none">
                                            {consultorIdx + 1}º consultor
                                        </Badge>
                                    )}
                                </h2>
                                <p className="text-sm text-slate-500 leading-relaxed">
                                    Chegou a hora de vocês avaliarem o pessoal que está junto com vocês! Lembrem-se de que é muito importante
                                    para todos saberem onde melhorar, então vamos de transparência e evolução!
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-900 dark:text-slate-200">
                                    Qual CONSULTOR(A) você vai avaliar agora? <span className="text-rose-500">*</span>
                                </label>
                                <Select value={d.consultor_id} onValueChange={v => updateConsultor(consultorIdx, "consultor_id", v)}>
                                    <SelectTrigger className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11">
                                        <SelectValue placeholder="Selecione o consultor" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-xl">
                                        {consultoresDisponiveis
                                            .filter(c => !selectedConsultorIds.includes(c.id) || c.id === d.consultor_id)
                                            .map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)
                                        }
                                    </SelectContent>
                                </Select>
                            </div>

                            <ScalePicker label="O quão eficaz foi a COMUNICAÇÃO do(a) consultor(a) com a equipe esse mês?"
                                value={d.comunicacao} onChange={v => updateConsultor(consultorIdx, "comunicacao", v)} required />

                            <ScalePicker label="Avalie o quanto o(a) consultor(a) SE DEDICOU ao projeto esse mês:"
                                value={d.dedicacao} onChange={v => updateConsultor(consultorIdx, "dedicacao", v)} required />

                            <ScalePicker label="Avalie o quanto você tem CONFIANÇA no trabalho deste(a) consultor(a) no projeto esse mês:"
                                value={d.confianca} onChange={v => updateConsultor(consultorIdx, "confianca", v)} required />

                            <ScalePicker label="O quanto esse(a) consultor(a) foi PONTUAL durante o mês?"
                                value={d.pontualidade} onChange={v => updateConsultor(consultorIdx, "pontualidade", v)} required
                                obs="Lembrando que Pontualidade não é só em reuniões com o cliente, mas também em reuniões internas, como sprints e construções, e cumprimento de prazos com as entregas." />

                            <ScalePicker label="O quanto esse(a) consultor(a) foi ORGANIZADO durante esse mês?"
                                value={d.organizacao} onChange={v => updateConsultor(consultorIdx, "organizacao", v)} required />

                            <ScalePicker label="O quanto esse(a) consultor(a) foi PROATIVO durante esse mês?"
                                value={d.proatividade} onChange={v => updateConsultor(consultorIdx, "proatividade", v)} required />

                            <ScalePicker label="Como você se sentiu em relação à QUALIDADE das ENTREGAS desse(a) consultor(a) nesse último mês?"
                                value={d.qualidade_entregas} onChange={v => updateConsultor(consultorIdx, "qualidade_entregas", v)} required />

                            <ScalePicker label="Como você avalia o DOMÍNIO TÉCNICO desse(a) consultor(a) durante o último mês?"
                                value={d.dominio_tecnico} onChange={v => updateConsultor(consultorIdx, "dominio_tecnico", v)} required />

                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-900 dark:text-slate-200">
                                    Deixe aqui suas percepções sobre o consultor, com pontos positivos, pontos de melhorias e qualquer situação que tenha ocorrido. <span className="text-rose-500">*</span>
                                </label>
                                <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">OBS: O avaliado NÃO terá acesso à resposta.</p>
                                <Textarea value={d.feedback_texto} onChange={e => updateConsultor(consultorIdx, "feedback_texto", e.target.value)}
                                    placeholder="Escreva suas percepções..."
                                    className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl min-h-[100px] resize-none focus-visible:ring-violet-500 text-sm" />
                            </div>

                            <RadioYesNo label="Você acha que essa pessoa precisa de um momento de feedback?"
                                value={d.precisa_feedback} onChange={v => updateConsultor(consultorIdx, "precisa_feedback", v)} required />

                            {!isLastConsultor && (
                                <RadioYesNo label="Há outro consultor alocado nesse projeto?"
                                    value={d.ha_outro} onChange={v => updateConsultor(consultorIdx, "ha_outro", v)} required />
                            )}
                        </div>
                    )
                })()}

                {/* ═══ Last Step: Confirm & Send ═══ */}
                {isLastStep && (
                    <div className="space-y-6 text-center">
                        <div className="bg-violet-50 dark:bg-violet-500/5 p-6 rounded-2xl border border-violet-100 dark:border-violet-500/10">
                            <Send className="h-10 w-10 text-violet-600 dark:text-violet-400 mx-auto mb-3" />
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">Tudo pronto!</h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">Revise o resumo e clique em enviar.</p>

                            <div className="text-left space-y-3">
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Projeto:</span>
                                    <span className="font-bold text-slate-900 dark:text-white">
                                        {projetos.find(p => p.id === projetoId)?.nome || "—"}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Referência:</span>
                                    <span className="font-bold text-slate-900 dark:text-white">
                                        {MESES[parseInt(mesRef) - 1]} {anoRef}
                                    </span>
                                </div>
                                {isConsultor && (
                                    <div className="flex justify-between text-sm">
                                        <span className="text-slate-500">Gerente avaliado:</span>
                                        <span className="font-bold text-slate-900 dark:text-white">
                                            {colaboradores.find(c => c.id === gerenteData.gerente_id)?.nome || "—"}
                                        </span>
                                    </div>
                                )}
                                <div className="flex justify-between text-sm">
                                    <span className="text-slate-500">Consultores avaliados:</span>
                                    <span className="font-bold text-slate-900 dark:text-white">
                                        {consultoresData.filter(c => c.consultor_id).map(c => colaboradores.find(col => col.id === c.consultor_id)?.nome).join(", ") || "—"}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ═══ Navigation ═══ */}
                <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                    <Button variant="ghost" onClick={handlePrev} disabled={step === 0}
                        className="rounded-xl font-bold text-slate-500">
                        <ChevronLeft className="h-4 w-4 mr-1" /> Voltar
                    </Button>

                    {isLastStep ? (
                        <Button onClick={handleSubmit} disabled={submitting}
                            className="rounded-xl font-bold h-11 px-8 bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20">
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                            {submitting ? "Enviando..." : "Enviar NPS"}
                        </Button>
                    ) : (
                        <Button onClick={handleNext}
                            className="rounded-xl font-bold h-11 px-8 bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20">
                            Próximo <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}
