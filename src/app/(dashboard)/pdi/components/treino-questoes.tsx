"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BookCheck, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
    indiceDeAcerto,
    type PdiAutoavaliacao, type PdiDesempenho, type PdiQuestaoTreino,
} from "@/lib/pdi"

interface Resumo {
    total: number
    categorias: { categoria: string, total: number }[]
    desempenho: PdiDesempenho
}

const NIVEIS: { id: PdiAutoavaliacao, rotulo: string, classe: string }[] = [
    { id: 'certo', rotulo: 'Acertei', classe: 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
    { id: 'parcial', rotulo: 'Em parte', classe: 'border-amber-500 bg-amber-500/10 text-amber-600 dark:text-amber-400' },
    { id: 'errado', rotulo: 'Errei', classe: 'border-rose-500 bg-rose-500/10 text-rose-600 dark:text-rose-400' },
]

function mensagemDeErro(json: { error?: string, detalhe?: string }, padrao: string) {
    return `${json.error || padrao}${json.detalhe ? ` (${json.detalhe})` : ''}`
}

function Desempenho({ d }: { d: PdiDesempenho }) {
    if (d.total === 0) return null
    return (
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 space-y-3">
            <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-white">Seu índice de acerto</span>
                <span className="text-2xl font-bold text-primary">{indiceDeAcerto(d.acertos, d.total)}%</span>
            </div>
            <p className="text-xs text-slate-400">Baseado nas suas autoavaliações em {d.total} questões respondidas</p>
            {d.porCategoria.map(c => (
                <div key={c.categoria} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                        <span>{c.categoria}</span><span>{indiceDeAcerto(c.acertos, c.total)}% ({c.total} questões)</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${indiceDeAcerto(c.acertos, c.total)}%` }} />
                    </div>
                </div>
            ))}
        </div>
    )
}

export function TreinoQuestoes({ onVoltar }: { onVoltar: () => void }) {
    const [fase, setFase] = useState<'inicio' | 'respondendo' | 'gabarito' | 'resultado'>('inicio')
    const [resumo, setResumo] = useState<Resumo | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [areas, setAreas] = useState<string[]>([])
    const [qtd, setQtd] = useState('10')
    const [questoes, setQuestoes] = useState<PdiQuestaoTreino[]>([])
    const [respostas, setRespostas] = useState<Record<string, string>>({})
    const [gabaritos, setGabaritos] = useState<Record<string, string | null>>({})
    const [notas, setNotas] = useState<Record<string, PdiAutoavaliacao>>({})
    const [resultado, setResultado] = useState<{ total: number, acertos: number, desempenho: PdiDesempenho } | null>(null)
    const [enviando, setEnviando] = useState(false)
    const [versao, setVersao] = useState(0)

    useEffect(() => {
        let ativo = true
        fetch('/api/pdi/questoes?resumo=1')
            .then(async res => {
                if (!ativo) return
                const json = await res.json().catch(() => ({}))
                if (!res.ok) { toast.error(mensagemDeErro(json, 'Erro ao carregar as questões.'), { duration: 15000 }); return }
                setResumo(json)
                setAreas((json as Resumo).categorias.map(c => c.categoria))
            })
            .catch(() => { if (ativo) toast.error('Erro ao carregar as questões.') })
            .finally(() => { if (ativo) setCarregando(false) })
        return () => { ativo = false }
    }, [versao])

    const disponiveisNasAreas = (resumo?.categorias || []).filter(c => areas.includes(c.categoria)).reduce((n, c) => n + c.total, 0)

    async function comecar() {
        setEnviando(true)
        try {
            const res = await fetch(`/api/pdi/questoes?areas=${encodeURIComponent(areas.join(','))}&qtd=${qtd}`)
            const json = await res.json().catch(() => ({}))
            if (!res.ok || !json.questoes?.length) { toast.error(res.ok ? 'Nenhuma questão encontrada para essas áreas.' : mensagemDeErro(json, 'Erro ao buscar questões.'), { duration: 15000 }); return }
            setQuestoes(json.questoes)
            setRespostas({})
            setGabaritos({})
            setNotas({})
            setFase('respondendo')
        } finally {
            setEnviando(false)
        }
    }

    async function verGabarito() {
        const faltam = questoes.filter(q => !respostas[q.id]?.trim()).length
        if (faltam > 0 && !window.confirm(`Você deixou ${faltam} sem resposta. Ver o gabarito mesmo assim?`)) return
        setEnviando(true)
        try {
            const res = await fetch('/api/pdi/questoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'gabarito', ids: questoes.map(q => q.id) }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) { toast.error(mensagemDeErro(json, 'Erro ao buscar o gabarito.'), { duration: 15000 }); return }
            setGabaritos(Object.fromEntries((json.gabaritos as { id: string, gabarito: string | null }[]).map(g => [g.id, g.gabarito])))
            setFase('gabarito')
        } finally {
            setEnviando(false)
        }
    }

    async function finalizar() {
        setEnviando(true)
        try {
            const res = await fetch('/api/pdi/questoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'finalizar',
                    avaliacoes: questoes.map(q => ({ id: q.id, resposta: respostas[q.id]?.trim() || null, nivel: notas[q.id] })),
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) { toast.error(mensagemDeErro(json, 'Erro ao calcular o resultado.'), { duration: 15000 }); return }
            if (json.salvo === false) {
                toast.warning(`Seu resultado apareceu, mas não foi guardado no histórico${json.detalheSalvar ? ` (${json.detalheSalvar})` : ''}.`, { duration: 15000 })
            }
            setResultado(json)
            setFase('resultado')
        } finally {
            setEnviando(false)
        }
    }

    function novoTreino() {
        setResultado(null)
        setQuestoes([])
        setCarregando(true)
        setFase('inicio')
        setVersao(v => v + 1)
    }

    const cabecalho = (
        <div className="flex items-center gap-3">
            <div className="bg-primary/10 p-2.5 rounded-2xl border border-primary/20"><BookCheck className="h-6 w-6 text-primary" /></div>
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Treino de questões</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">Responda agora, sem marcar horário. O gabarito aparece depois que você responder.</p>
            </div>
        </div>
    )

    if (fase === 'inicio') {
        return (
            <div className="max-w-2xl mx-auto flex flex-col gap-5 pb-8">
                <Button variant="ghost" onClick={onVoltar} className="w-fit rounded-xl font-bold text-slate-500">← Voltar</Button>
                {cabecalho}
                {carregando ? (
                    <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                ) : !resumo || resumo.total === 0 ? (
                    <p className="text-sm text-slate-400 italic">Ainda não há questões com gabarito no banco. Peça para um gerente cadastrar algumas.</p>
                ) : (
                    <>
                        <Desempenho d={resumo.desempenho} />
                        <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-3xl">
                            <CardHeader><CardTitle className="text-base">Monte seu treino</CardTitle></CardHeader>
                            <CardContent className="space-y-5">
                                <div className="space-y-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Áreas</span>
                                    <div className="flex flex-wrap gap-2">
                                        {resumo.categorias.map(c => {
                                            const sel = areas.includes(c.categoria)
                                            return (
                                                <button
                                                    key={c.categoria} type="button"
                                                    onClick={() => setAreas(a => sel ? a.filter(x => x !== c.categoria) : [...a, c.categoria])}
                                                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${sel ? 'bg-primary text-primary-foreground border-primary' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary/50'}`}
                                                >
                                                    {c.categoria} ({c.total})
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Quantidade</span>
                                    <Select value={qtd} onValueChange={setQtd}>
                                        <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {['3', '5', '10', '15', '20'].map(n => <SelectItem key={n} value={n}>{n} questões</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <Button disabled={enviando || disponiveisNasAreas === 0} onClick={comecar} className="rounded-xl font-bold px-6">
                                    {enviando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Começar treino
                                </Button>
                            </CardContent>
                        </Card>
                    </>
                )}
            </div>
        )
    }

    if (fase === 'respondendo') {
        const respondidas = questoes.filter(q => respostas[q.id]?.trim()).length
        return (
            <div className="max-w-2xl mx-auto flex flex-col gap-4 pb-8">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={() => { if (window.confirm('Sair do treino? Suas respostas serão perdidas.')) novoTreino() }} className="rounded-xl font-bold text-slate-500">← Sair</Button>
                    <span className="text-sm text-slate-500">Respondidas {respondidas}/{questoes.length}</span>
                </div>
                {questoes.map((q, n) => (
                    <div key={q.id} className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <p className="font-semibold text-slate-900 dark:text-white whitespace-pre-wrap">{n + 1}. {q.enunciado}</p>
                            {q.categoria && <Badge variant="outline" className="shrink-0">{q.categoria}</Badge>}
                        </div>
                        <Textarea
                            value={respostas[q.id] || ''}
                            onChange={(e) => setRespostas(r => ({ ...r, [q.id]: e.target.value }))}
                            placeholder="Escreva sua resposta..."
                            rows={5}
                            maxLength={5000}
                        />
                    </div>
                ))}
                <Button disabled={enviando} onClick={verGabarito} className="rounded-xl font-bold h-11 w-fit px-6">
                    {enviando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Ver gabarito
                </Button>
            </div>
        )
    }

    if (fase === 'gabarito') {
        const avaliadas = questoes.filter(q => notas[q.id]).length
        return (
            <div className="max-w-2xl mx-auto flex flex-col gap-4 pb-8">
                <p className="text-sm text-slate-500">Compare sua resposta com o gabarito e marque como foi. Avaliadas {avaliadas}/{questoes.length}.</p>
                {questoes.map((q, n) => (
                    <div key={q.id} className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <p className="font-semibold text-slate-900 dark:text-white whitespace-pre-wrap">{n + 1}. {q.enunciado}</p>
                            {q.categoria && <Badge variant="outline" className="shrink-0">{q.categoria}</Badge>}
                        </div>
                        <div className="text-sm">
                            <span className="text-slate-400">Sua resposta</span>
                            <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 mt-1">{respostas[q.id]?.trim() || <em className="text-slate-400">Sem resposta</em>}</p>
                        </div>
                        <div className="text-sm rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3">
                            <span className="text-emerald-600 dark:text-emerald-400 font-semibold">Gabarito</span>
                            <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 mt-1">{gabaritos[q.id] || '—'}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs text-slate-400 mr-1">Como você foi?</span>
                            {NIVEIS.map(nv => (
                                <button
                                    key={nv.id} type="button"
                                    onClick={() => setNotas(x => ({ ...x, [q.id]: nv.id }))}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${notas[q.id] === nv.id ? nv.classe : 'border-slate-200 dark:border-slate-700 text-slate-500 hover:border-primary/50'}`}
                                >
                                    {nv.rotulo}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
                <Button disabled={enviando || avaliadas < questoes.length} onClick={finalizar} className="rounded-xl font-bold h-11 w-fit px-6">
                    {enviando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Ver meu índice de acerto
                </Button>
            </div>
        )
    }

    // fase === 'resultado'
    const r = resultado!
    return (
        <div className="max-w-2xl mx-auto flex flex-col gap-4 pb-8">
            <div className="bg-white dark:bg-[#0F172A] rounded-3xl p-6 border border-slate-100 dark:border-slate-800/50 text-center space-y-1">
                <p className="text-sm text-slate-400">Seu resultado neste treino</p>
                <p className="text-4xl font-bold text-primary">{indiceDeAcerto(r.acertos, r.total)}%</p>
                <p className="text-sm text-slate-500">
                    {questoes.filter(q => notas[q.id] === 'certo').length} acertei · {questoes.filter(q => notas[q.id] === 'parcial').length} em parte · {questoes.filter(q => notas[q.id] === 'errado').length} errei
                </p>
            </div>
            <Desempenho d={r.desempenho} />
            <div className="flex gap-2">
                <Button onClick={novoTreino} className="rounded-xl font-bold">Novo treino</Button>
                <Button variant="ghost" onClick={onVoltar} className="rounded-xl font-bold text-slate-500">Voltar ao PDI</Button>
            </div>
        </div>
    )
}
