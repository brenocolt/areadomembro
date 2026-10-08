"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { BookCheck, CheckCircle2, Loader2, XCircle } from "lucide-react"
import { toast } from "sonner"
import {
    indiceDeAcerto,
    type PdiDesempenho, type PdiQuestaoTreino, type PdiResultadoQuestao,
} from "@/lib/pdi"

interface Resumo {
    total: number
    categorias: { categoria: string, total: number }[]
    desempenho: PdiDesempenho
}

function Desempenho({ d }: { d: PdiDesempenho }) {
    if (d.total === 0) return null
    return (
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 space-y-3">
            <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-slate-900 dark:text-white">Seu índice de acerto</span>
                <span className="text-2xl font-bold text-primary">{indiceDeAcerto(d.acertos, d.total)}%</span>
            </div>
            <p className="text-xs text-slate-400">{d.acertos} acertos em {d.total} questões respondidas</p>
            {d.porCategoria.map(c => (
                <div key={c.categoria} className="space-y-1">
                    <div className="flex justify-between text-xs text-slate-500">
                        <span>{c.categoria}</span><span>{indiceDeAcerto(c.acertos, c.total)}% ({c.acertos}/{c.total})</span>
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
    const [fase, setFase] = useState<'inicio' | 'respondendo' | 'resultado'>('inicio')
    const [resumo, setResumo] = useState<Resumo | null>(null)
    const [carregando, setCarregando] = useState(true)
    const [areas, setAreas] = useState<string[]>([])
    const [qtd, setQtd] = useState('10')
    const [questoes, setQuestoes] = useState<PdiQuestaoTreino[]>([])
    const [escolhas, setEscolhas] = useState<Record<string, number>>({})
    const [resultado, setResultado] = useState<{ total: number, acertos: number, resultados: PdiResultadoQuestao[], desempenho: PdiDesempenho } | null>(null)
    const [enviando, setEnviando] = useState(false)
    const [versao, setVersao] = useState(0)

    useEffect(() => {
        let ativo = true
        fetch('/api/pdi/questoes?resumo=1')
            .then(async res => {
                if (!ativo) return
                if (!res.ok) { const j = await res.json().catch(() => ({})); toast.error(`${j.error || 'Erro ao carregar as questões.'}${j.detalhe ? ` (${j.detalhe})` : ''}`, { duration: 15000 }); return }
                const json: Resumo = await res.json()
                setResumo(json)
                setAreas(json.categorias.map(c => c.categoria))
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
            const json = await res.json()
            if (!res.ok || !json.questoes?.length) { toast.error(json.error || 'Nenhuma questão encontrada para essas áreas.'); return }
            setQuestoes(json.questoes)
            setEscolhas({})
            setFase('respondendo')
        } finally {
            setEnviando(false)
        }
    }

    async function finalizar() {
        const faltam = questoes.length - Object.keys(escolhas).length
        if (faltam > 0 && !window.confirm(`Você deixou ${faltam} sem resposta (contam como erro). Finalizar mesmo assim?`)) return
        setEnviando(true)
        try {
            const res = await fetch('/api/pdi/questoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ respostas: questoes.map(q => ({ id: q.id, escolha: escolhas[q.id] ?? null })) }),
            })
            const json = await res.json()
            if (!res.ok) { toast.error(json.error || 'Erro ao corrigir.'); return }
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
                <p className="text-sm text-slate-500 dark:text-slate-400">Responda agora, sem marcar horário. O gabarito aparece depois que você finalizar.</p>
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
                    <p className="text-sm text-slate-400 italic">Ainda não há questões com alternativas no banco. Peça para um gerente cadastrar algumas.</p>
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
                                            {['5', '10', '15', '20'].map(n => <SelectItem key={n} value={n}>{n} questões</SelectItem>)}
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
        const respondidas = Object.keys(escolhas).length
        return (
            <div className="max-w-2xl mx-auto flex flex-col gap-4 pb-8">
                <div className="flex items-center justify-between">
                    <Button variant="ghost" onClick={() => { if (window.confirm('Sair do treino? As respostas serão perdidas.')) novoTreino() }} className="rounded-xl font-bold text-slate-500">← Sair</Button>
                    <span className="text-sm text-slate-500">Respondidas {respondidas}/{questoes.length}</span>
                </div>
                {questoes.map((q, n) => (
                    <div key={q.id} className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 space-y-3">
                        <div className="flex items-start justify-between gap-3">
                            <p className="font-semibold text-slate-900 dark:text-white whitespace-pre-wrap">{n + 1}. {q.enunciado}</p>
                            {q.categoria && <Badge variant="outline" className="shrink-0">{q.categoria}</Badge>}
                        </div>
                        <div className="space-y-2">
                            {q.alternativas.map((alt, i) => (
                                <label key={i} className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer text-sm transition-colors ${escolhas[q.id] === i ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700'}`}>
                                    <input type="radio" name={q.id} checked={escolhas[q.id] === i} onChange={() => setEscolhas(e => ({ ...e, [q.id]: i }))} className="mt-0.5 accent-primary" />
                                    <span><strong className="mr-1">{String.fromCharCode(65 + i)})</strong>{alt}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                ))}
                <Button disabled={enviando} onClick={finalizar} className="rounded-xl font-bold h-11 w-fit px-6">
                    {enviando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Finalizar e ver gabarito
                </Button>
            </div>
        )
    }

    // fase === 'resultado'
    const r = resultado!
    const porId = new Map(r.resultados.map(x => [x.id, x]))
    return (
        <div className="max-w-2xl mx-auto flex flex-col gap-4 pb-8">
            <div className="bg-white dark:bg-[#0F172A] rounded-3xl p-6 border border-slate-100 dark:border-slate-800/50 text-center space-y-1">
                <p className="text-sm text-slate-400">Seu resultado</p>
                <p className="text-4xl font-bold text-primary">{indiceDeAcerto(r.acertos, r.total)}%</p>
                <p className="text-sm text-slate-500">{r.acertos} de {r.total} questões certas</p>
            </div>
            <Desempenho d={r.desempenho} />
            {questoes.map((q, n) => {
                const res = porId.get(q.id)!
                return (
                    <div key={q.id} className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 space-y-3">
                        <div className="flex items-start gap-2">
                            {res.acertou ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" /> : <XCircle className="h-5 w-5 text-rose-500 shrink-0" />}
                            <p className="font-semibold text-slate-900 dark:text-white whitespace-pre-wrap">{n + 1}. {q.enunciado}</p>
                        </div>
                        <div className="space-y-1.5">
                            {q.alternativas.map((alt, i) => {
                                const certa = i === res.correta
                                const errada = i === res.escolha && !res.acertou
                                return (
                                    <div key={i} className={`p-3 rounded-xl border text-sm ${certa ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : errada ? 'border-rose-500/50 bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300'}`}>
                                        <strong className="mr-1">{String.fromCharCode(65 + i)})</strong>{alt}
                                        {certa && ' ✓ resposta certa'}{errada && ' — sua resposta'}
                                    </div>
                                )
                            })}
                            {res.escolha === null && <p className="text-xs text-slate-400">Sem resposta.</p>}
                        </div>
                        {res.comentario && (
                            <p className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap"><span className="text-slate-400">Comentário: </span>{res.comentario}</p>
                        )}
                    </div>
                )
            })}
            <div className="flex gap-2">
                <Button onClick={novoTreino} className="rounded-xl font-bold">Novo treino</Button>
                <Button variant="ghost" onClick={onVoltar} className="rounded-xl font-bold text-slate-500">Voltar ao PDI</Button>
            </div>
        </div>
    )
}
