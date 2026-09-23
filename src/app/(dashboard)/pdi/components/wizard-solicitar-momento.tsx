"use client"

import { useState, useEffect } from "react"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Send } from "lucide-react"
import {
    PdiPapel, PdiTipoMomento, PdiGrupoPapel,
    grupoDoPapel, gerarHorariosDisponiveis, isDataValida, dataParaChave,
    linkAnalisarAgenda, linkAdicionarAgenda, formatarLista, nomesDosPapeis,
    formatarTiposComOpcoes, formatarDataBr,
} from "@/lib/pdi"

const GRUPOS: PdiGrupoPapel[] = ['Diretor', 'Tático']

interface WizardProps {
    papeis: PdiPapel[]
    tipos: PdiTipoMomento[]
    onCancel: () => void
    onCriado: () => void
}

export function WizardSolicitarMomento({ papeis, tipos, onCancel, onCriado }: WizardProps) {
    const { colaborador } = useColaborador()
    const [passo, setPasso] = useState(1)

    const [cargos, setCargos] = useState<string[]>([])
    const [tiposSelecionados, setTiposSelecionados] = useState<string[]>([])
    const [detalhes, setDetalhes] = useState<Record<string, string[]>>({})
    const [outroTexto, setOutroTexto] = useState('')

    const [mesAtual, setMesAtual] = useState(() => { const d = new Date(); d.setDate(1); return d })
    const [dataEscolhida, setDataEscolhida] = useState<string | null>(null)
    const [horaEscolhida, setHoraEscolhida] = useState<string | null>(null)
    const [horariosOcupados, setHorariosOcupados] = useState<Set<string>>(new Set())

    const [descricao, setDescricao] = useState('')

    const [enviando, setEnviando] = useState(false)
    const [erro, setErro] = useState<string | null>(null)
    const [criado, setCriado] = useState<any | null>(null)

    useEffect(() => {
        if (!dataEscolhida) { setHorariosOcupados(new Set()); return }
        let cancelado = false
        async function checarOcupados() {
            const { data } = await supabase
                .from('pdi_solicitacoes')
                .select('hora, cargos')
                .eq('data', dataEscolhida)
                .in('status', ['aguardando', 'agendado', 'reagendado'])
            if (cancelado) return
            const ocupados = new Set<string>()
            for (const s of data || []) {
                if ((s.cargos || []).some((c: string) => cargos.includes(c))) ocupados.add(s.hora)
            }
            setHorariosOcupados(ocupados)
        }
        checarOcupados()
        return () => { cancelado = true }
    }, [dataEscolhida, cargos])

    const resumoPapeis = formatarLista(nomesDosPapeis(papeis, cargos))
    const resumoTipos = formatarTiposComOpcoes(tipos, tiposSelecionados, detalhes, outroTexto)

    const tipoValido = (tipoId: string) => {
        if (tipoId === 'outro') return outroTexto.trim().length > 0
        return (detalhes[tipoId] || []).length > 0
    }

    const podeAvancar =
        (passo === 1 && cargos.length > 0) ||
        (passo === 2 && tiposSelecionados.length > 0 && tiposSelecionados.every(tipoValido)) ||
        (passo === 3 && !!dataEscolhida && !!horaEscolhida) ||
        passo === 4

    async function handleEnviar() {
        setEnviando(true)
        setErro(null)
        try {
            const res = await fetch('/api/pdi/solicitacoes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    cargos,
                    tipos: tiposSelecionados,
                    detalhes,
                    outro_texto: tiposSelecionados.includes('outro') ? outroTexto : null,
                    data: dataEscolhida,
                    hora: horaEscolhida,
                    descricao: descricao || null,
                }),
            })
            const json = await res.json()
            if (!res.ok) {
                setErro(json.error || 'Erro ao enviar solicitação.')
                return
            }
            setCriado(json.solicitacao)
        } finally {
            setEnviando(false)
        }
    }

    if (criado) {
        const link = linkAdicionarAgenda({
            titulo: `Momento de desenvolvimento: ${resumoTipos} — ${colaborador?.nome || ''}`,
            dataStr: criado.data,
            horaStr: criado.hora,
            detalhes: `Colaborador: ${colaborador?.nome || ''} / Tipo: ${resumoTipos}`,
        })
        return (
            <div className="max-w-lg mx-auto text-center py-16 space-y-4">
                <CheckCircle2 className="h-14 w-14 text-emerald-500 mx-auto" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Solicitação enviada!</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Assim que alguém aceitar (ou sugerir outro horário), você será avisado.</p>
                <div className="flex justify-center gap-2 pt-4">
                    <a href={link} target="_blank" rel="noopener">
                        <Button className="rounded-xl font-bold">Adicionar ao Google Agenda</Button>
                    </a>
                    <Button variant="ghost" onClick={onCriado} className="rounded-xl font-bold text-slate-500">Agora não</Button>
                </div>
            </div>
        )
    }

    const ano = mesAtual.getFullYear()
    const mes = mesAtual.getMonth()
    const diasNoMes = new Date(ano, mes + 1, 0).getDate()
    const primeiroDiaSemana = new Date(ano, mes, 1).getDay()
    const nomeMes = mesAtual.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    return (
        <div className="max-w-4xl mx-auto pb-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm p-8">
                    <div className="flex items-center gap-1.5 mb-6">
                        {[1, 2, 3, 4, 5].map(n => (
                            <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= passo ? 'bg-primary' : 'bg-slate-100 dark:bg-slate-800'}`} />
                        ))}
                    </div>

                    {passo === 1 && (
                        <div className="space-y-5">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Com quem você quer o momento?</h2>
                            {GRUPOS.map(grupo => {
                                const itens = papeis.filter(p => grupoDoPapel(p.id) === grupo)
                                if (itens.length === 0) return null
                                return (
                                    <div key={grupo} className="space-y-2">
                                        <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{grupo}</span>
                                        <div className="grid grid-cols-2 gap-2">
                                            {itens.map(p => {
                                                const checked = cargos.includes(p.id)
                                                return (
                                                    <label key={p.id} className={`flex items-center gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${checked ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700'}`}>
                                                        <Checkbox
                                                            checked={checked}
                                                            onCheckedChange={(v) => setCargos(c => v ? [...c, p.id] : c.filter(x => x !== p.id))}
                                                        />
                                                        <span className="text-sm text-slate-700 dark:text-slate-300">{p.nome}</span>
                                                    </label>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {passo === 2 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Que tipo de momento você precisa?</h2>
                            {tipos.map(t => {
                                const checked = tiposSelecionados.includes(t.id)
                                return (
                                    <div key={t.id} className="space-y-2">
                                        <label className={`flex items-start gap-2 p-3 rounded-xl border cursor-pointer transition-colors ${checked ? 'border-primary bg-primary/5' : 'border-slate-200 dark:border-slate-700'}`}>
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={(v) => setTiposSelecionados(ts => v ? [...ts, t.id] : ts.filter(x => x !== t.id))}
                                            />
                                            <div>
                                                <span className="text-sm font-semibold text-slate-800 dark:text-slate-200">{t.nome}</span>
                                                {t.descricao && <p className="text-xs text-slate-400">{t.descricao}</p>}
                                            </div>
                                        </label>
                                        {checked && t.id === 'outro' && (
                                            <Input
                                                value={outroTexto}
                                                onChange={(e) => setOutroTexto(e.target.value.slice(0, 60))}
                                                placeholder="Descreva em poucas palavras (máx. 60 caracteres)"
                                                className="ml-8 max-w-sm"
                                            />
                                        )}
                                        {checked && t.id !== 'outro' && (
                                            <div className="ml-8 space-y-1.5">
                                                <span className="text-xs text-slate-400">{t.sub_label}</span>
                                                <div className="flex flex-wrap gap-2">
                                                    {t.sub_opcoes.map(op => {
                                                        const sel = (detalhes[t.id] || []).includes(op)
                                                        return (
                                                            <button
                                                                key={op}
                                                                type="button"
                                                                onClick={() => setDetalhes(d => {
                                                                    const atual = d[t.id] || []
                                                                    return { ...d, [t.id]: sel ? atual.filter(x => x !== op) : [...atual, op] }
                                                                })}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${sel ? 'bg-primary text-primary-foreground border-primary' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary/50'}`}
                                                            >
                                                                {op}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    {passo === 3 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Quando?</h2>
                            <div className="flex items-center justify-between">
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMesAtual(new Date(ano, mes - 1, 1))}>
                                    <ChevronLeft className="h-4 w-4" />
                                </Button>
                                <span className="text-sm font-semibold capitalize">{nomeMes}</span>
                                <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMesAtual(new Date(ano, mes + 1, 1))}>
                                    <ChevronRight className="h-4 w-4" />
                                </Button>
                            </div>
                            <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold text-slate-400 uppercase">
                                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => <div key={d}>{d}</div>)}
                            </div>
                            <div className="grid grid-cols-7 gap-1">
                                {Array.from({ length: primeiroDiaSemana }).map((_, i) => <div key={`vazio-${i}`} />)}
                                {Array.from({ length: diasNoMes }).map((_, i) => {
                                    const dia = i + 1
                                    const chave = dataParaChave(new Date(ano, mes, dia))
                                    const valido = isDataValida(chave)
                                    const selecionado = dataEscolhida === chave
                                    return (
                                        <button
                                            key={dia}
                                            type="button"
                                            disabled={!valido}
                                            onClick={() => { setDataEscolhida(chave); setHoraEscolhida(null) }}
                                            className={`h-9 rounded-lg text-sm font-medium transition-colors
                                                ${!valido ? 'text-slate-300 dark:text-slate-700 cursor-not-allowed' : 'text-slate-700 dark:text-slate-300 hover:bg-primary/10'}
                                                ${selecionado ? 'bg-primary text-primary-foreground hover:bg-primary' : ''}`}
                                        >
                                            {dia}
                                        </button>
                                    )
                                })}
                            </div>

                            {dataEscolhida && (
                                <div className="pt-2">
                                    <span className="text-xs text-slate-400">Horário</span>
                                    <div className="grid grid-cols-4 gap-2 mt-1.5">
                                        {gerarHorariosDisponiveis().map(h => {
                                            const ocupado = horariosOcupados.has(h)
                                            return (
                                                <button
                                                    key={h}
                                                    type="button"
                                                    disabled={ocupado}
                                                    onClick={() => setHoraEscolhida(h)}
                                                    title={ocupado ? 'Já existe uma solicitação nesse horário' : undefined}
                                                    className={`h-9 rounded-lg text-xs font-bold border transition-colors
                                                        ${ocupado ? 'opacity-40 cursor-not-allowed border-slate-100 dark:border-slate-800' : 'border-slate-200 dark:border-slate-700 hover:border-primary'}
                                                        ${horaEscolhida === h ? 'bg-primary text-primary-foreground border-primary' : ''}`}
                                                >
                                                    {h}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            <a href={linkAnalisarAgenda(dataEscolhida || undefined)} target="_blank" rel="noopener" className="inline-block">
                                <Button variant="outline" size="sm" className="rounded-xl font-bold">Analisar minha agenda</Button>
                            </a>
                        </div>
                    )}

                    {passo === 4 && (
                        <div className="space-y-3">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Quer adicionar uma descrição? (opcional)</h2>
                            <Textarea
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                                placeholder="Algum contexto que ajude quem for te atender..."
                                className="min-h-[100px] resize-none"
                            />
                        </div>
                    )}

                    {passo === 5 && (
                        <div className="space-y-4">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Revisar e enviar</h2>
                            <div className="bg-slate-50 dark:bg-slate-800/40 rounded-xl p-4 text-sm space-y-2">
                                <p><span className="text-slate-400">Com quem: </span><span className="font-semibold">{resumoPapeis}</span></p>
                                <p><span className="text-slate-400">Tipo: </span><span className="font-semibold">{resumoTipos}</span></p>
                                <p><span className="text-slate-400">Quando: </span><span className="font-semibold">{dataEscolhida ? formatarDataBr(dataEscolhida) : ''} às {horaEscolhida}</span></p>
                                {descricao && <p><span className="text-slate-400">Descrição: </span>{descricao}</p>}
                            </div>
                            {erro && (
                                <div className="p-3 rounded-lg text-sm text-center border bg-red-500/10 border-red-500/20 text-red-500">{erro}</div>
                            )}
                        </div>
                    )}

                    <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                        <Button variant="ghost" onClick={() => (passo === 1 ? onCancel() : setPasso(p => p - 1))} className="rounded-xl font-bold text-slate-500">
                            ← {passo === 1 ? 'Cancelar' : 'Voltar'}
                        </Button>
                        {passo < 5 ? (
                            <Button disabled={!podeAvancar} onClick={() => setPasso(p => p + 1)} className="rounded-xl font-bold px-6">
                                Avançar
                            </Button>
                        ) : (
                            <Button disabled={enviando} onClick={handleEnviar} className="rounded-xl font-bold px-6">
                                {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                                {enviando ? 'Enviando...' : 'Enviar solicitação'}
                            </Button>
                        )}
                    </div>
                </div>

                <div className="bg-primary/5 border border-primary/10 rounded-3xl p-6 h-fit">
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">Resumo</span>
                    <p className="text-sm text-slate-700 dark:text-slate-300 mt-2 leading-relaxed">
                        Quero um momento com <strong>{resumoPapeis || '...'}</strong>
                        {resumoTipos && <>, no formato <strong>{resumoTipos}</strong></>}
                        {dataEscolhida && <>, <strong>{formatarDataBr(dataEscolhida)}</strong></>}
                        {horaEscolhida && <> às <strong>{horaEscolhida}</strong></>}
                        .
                    </p>
                </div>
            </div>
        </div>
    )
}
