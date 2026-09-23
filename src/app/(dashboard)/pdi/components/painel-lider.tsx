"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CalendarClock, CheckCircle2, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import {
    PdiPapel, PdiTipoMomento,
    formatarDataBr, formatarTiposComOpcoes, nomesDosPapeis,
    linkAnalisarAgenda, linkAdicionarAgenda, gerarHorariosDisponiveis, isDataValida, dataParaChave,
} from "@/lib/pdi"

interface PainelLiderProps {
    papeis: PdiPapel[]
    tipos: PdiTipoMomento[]
}

function DialogSugerirHorario({ solicitacaoId, onClose, onEnviado }: { solicitacaoId: string, onClose: () => void, onEnviado: () => void }) {
    const [data, setData] = useState('')
    const [hora, setHora] = useState('')
    const [motivo, setMotivo] = useState('')
    const [enviando, setEnviando] = useState(false)
    const [erro, setErro] = useState<string | null>(null)

    const hoje = new Date()
    const limite = new Date(); limite.setDate(limite.getDate() + 60)

    async function enviar() {
        // A sugestão do líder pode ser no mesmo dia — diferente da
        // solicitação original, que exige a partir de amanhã.
        if (!data || !isDataValida(data, true)) { setErro('Escolha um dia útil válido (de hoje até 60 dias à frente).'); return }
        if (!hora) { setErro('Escolha um horário.'); return }
        setEnviando(true)
        setErro(null)
        try {
            const res = await fetch(`/api/pdi/solicitacoes/${solicitacaoId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sugerir_horario', data, hora, motivo: motivo || null }),
            })
            const json = await res.json()
            if (!res.ok) { setErro(json.error || 'Erro ao sugerir horário.'); return }
            toast.success('Sugestão enviada ao colaborador.')
            onEnviado()
        } finally {
            setEnviando(false)
        }
    }

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-[420px]">
                <DialogHeader>
                    <DialogTitle>Sugerir outro horário</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                        <Label>Data</Label>
                        <Input type="date" min={dataParaChave(hoje)} max={dataParaChave(limite)} value={data} onChange={(e) => { setData(e.target.value); setHora('') }} />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Horário</Label>
                        <Select value={hora} onValueChange={setHora}>
                            <SelectTrigger><SelectValue placeholder="Escolha um horário" /></SelectTrigger>
                            <SelectContent>
                                {gerarHorariosDisponiveis(data).map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label>Motivo (opcional)</Label>
                        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} className="resize-none" rows={2} />
                    </div>
                    <a href={linkAnalisarAgenda(data || undefined)} target="_blank" rel="noopener" className="inline-block">
                        <Button variant="outline" size="sm" type="button" className="rounded-xl">Analisar minha agenda</Button>
                    </a>
                    {erro && <div className="p-3 rounded-lg text-sm text-center border bg-red-500/10 border-red-500/20 text-red-500">{erro}</div>}
                    <Button onClick={enviar} disabled={enviando} className="w-full rounded-xl font-bold">
                        {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
                        Enviar sugestão
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function DialogConcluir({ solicitacaoId, onClose, onEnviado }: { solicitacaoId: string, onClose: () => void, onEnviado: () => void }) {
    const [resumo, setResumo] = useState('')
    const [proximosPassos, setProximosPassos] = useState('')
    const [enviando, setEnviando] = useState(false)
    const [erro, setErro] = useState<string | null>(null)

    async function enviar() {
        if (!resumo.trim()) { setErro('Informe um resumo do momento.'); return }
        setEnviando(true)
        setErro(null)
        try {
            const res = await fetch(`/api/pdi/solicitacoes/${solicitacaoId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'concluir', resumo, proximos_passos: proximosPassos || null }),
            })
            const json = await res.json()
            if (!res.ok) { setErro(json.error || 'Erro ao concluir momento.'); return }
            toast.success('Momento concluído!')
            onEnviado()
        } finally {
            setEnviando(false)
        }
    }

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Concluir momento</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                        <Label>Resumo *</Label>
                        <Textarea value={resumo} onChange={(e) => setResumo(e.target.value)} className="resize-none" rows={3} placeholder="O que foi conversado..." />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Próximos passos (opcional)</Label>
                        <Textarea value={proximosPassos} onChange={(e) => setProximosPassos(e.target.value)} className="resize-none" rows={2} />
                    </div>
                    {erro && <div className="p-3 rounded-lg text-sm text-center border bg-red-500/10 border-red-500/20 text-red-500">{erro}</div>}
                    <Button onClick={enviar} disabled={enviando} className="w-full rounded-xl font-bold">
                        {enviando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                        Concluir momento
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function CardSolicitacaoLider({ s, papeis, tipos, meuPapelId, acting, onAceitar, onSugerir, onConcluir }: any) {
    const papeisNomes = nomesDosPapeis(papeis, s.cargos || [])
    const tiposTexto = formatarTiposComOpcoes(tipos, s.tipos || [], s.detalhes || {}, s.outro_texto)
    const minhaLinha = (s.pdi_solicitacao_lideres || []).find((l: any) => l.papel_id === meuPapelId)
    const jaAceitei = !!minhaLinha?.lider_id

    return (
        <div className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 shadow-sm space-y-3">
            <div>
                <p className="font-bold text-slate-900 dark:text-white">{tiposTexto}</p>
                <p className="text-sm text-slate-500 mt-0.5">
                    {s.colaborador?.nome}{s.colaborador?.nucleo_atual ? ` (${s.colaborador.nucleo_atual})` : ''} — com {papeisNomes.join(', ')}
                </p>
                <p className="text-sm text-slate-500">{formatarDataBr(s.data)} às {s.hora}</p>
                {s.descricao && <p className="text-xs text-slate-400 mt-1">{s.descricao}</p>}
            </div>
            <div className="flex gap-2 flex-wrap">
                {!jaAceitei && (
                    <>
                        <Button size="sm" disabled={acting} onClick={onAceitar} className="rounded-xl font-bold">
                            {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Aceitar
                        </Button>
                        <Button size="sm" variant="outline" disabled={acting} onClick={onSugerir} className="rounded-xl font-bold">
                            Sugerir outro horário
                        </Button>
                        <a href={linkAnalisarAgenda(s.data)} target="_blank" rel="noopener">
                            <Button size="sm" variant="ghost" type="button" className="rounded-xl font-bold text-slate-500">Analisar minha agenda</Button>
                        </a>
                    </>
                )}
                {jaAceitei && s.status === 'agendado' && (
                    <>
                        <a href={linkAdicionarAgenda({
                            titulo: `Momento de desenvolvimento: ${tiposTexto} — ${s.colaborador?.nome || ''}`,
                            dataStr: s.data,
                            horaStr: s.hora,
                            detalhes: `Colaborador: ${s.colaborador?.nome || ''} / Tipo: ${tiposTexto}${s.descricao ? ' / ' + s.descricao : ''}`,
                        })} target="_blank" rel="noopener">
                            <Button size="sm" variant="outline" type="button" className="rounded-xl font-bold">Adicionar ao Google Agenda</Button>
                        </a>
                        <Button size="sm" disabled={acting} onClick={onConcluir} className="rounded-xl font-bold">
                            Concluir momento
                        </Button>
                    </>
                )}
                {jaAceitei && s.status === 'concluido' && (
                    <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-200">Concluído</Badge>
                )}
            </div>
        </div>
    )
}

export function PainelLider({ papeis, tipos }: PainelLiderProps) {
    const [loading, setLoading] = useState(true)
    const [papelId, setPapelId] = useState<string | null>(null)
    const [solicitacoes, setSolicitacoes] = useState<any[]>([])
    const [acting, setActing] = useState<string | null>(null)
    const [sugerirFor, setSugerirFor] = useState<string | null>(null)
    const [concluirFor, setConcluirFor] = useState<string | null>(null)

    const fetchDados = useCallback(async () => {
        const res = await fetch('/api/pdi/solicitacoes/lider')
        if (res.ok) {
            const json = await res.json()
            setPapelId(json.papelId)
            setSolicitacoes(json.solicitacoes || [])
        }
        setLoading(false)
    }, [])

    useEffect(() => { fetchDados() }, [fetchDados])

    async function aceitar(id: string) {
        setActing(id)
        try {
            const res = await fetch(`/api/pdi/solicitacoes/${id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'aceitar' }),
            })
            const json = await res.json()
            if (!res.ok) { toast.error(json.error || 'Erro ao aceitar.'); return }
            toast.success('Momento aceito!')
            await fetchDados()
        } finally {
            setActing(null)
        }
    }

    if (loading) {
        return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
    }

    if (!papelId) {
        return <p className="text-sm text-slate-400 italic py-8 text-center">Você não tem um papel de liderança configurado.</p>
    }

    const minhaLinha = (s: any) => (s.pdi_solicitacao_lideres || []).find((l: any) => l.papel_id === papelId)

    const abertas = solicitacoes.filter(s => {
        const linha = minhaLinha(s)
        return linha && !linha.lider_id && s.status !== 'concluido'
    })
    const aguardandoResposta = solicitacoes.filter(s => s.status === 'reagendado' && s.sugestao?.papel_id === papelId)
    const aceitas = solicitacoes.filter(s => minhaLinha(s)?.lider_id && s.status === 'agendado')
    const concluidas = solicitacoes.filter(s => minhaLinha(s)?.lider_id && s.status === 'concluido')

    return (
        <div className="space-y-8">
            <div className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <CalendarClock className="h-5 w-5 text-amber-500" /> Abertas para você
                </h2>
                {abertas.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">Nenhuma solicitação aberta no momento.</p>
                ) : (
                    <div className="grid gap-3">
                        {abertas.map(s => (
                            <CardSolicitacaoLider
                                key={s.id} s={s} papeis={papeis} tipos={tipos} meuPapelId={papelId}
                                acting={acting === s.id}
                                onAceitar={() => aceitar(s.id)}
                                onSugerir={() => setSugerirFor(s.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {aguardandoResposta.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Aguardando resposta à sua sugestão</h2>
                    <div className="grid gap-3">
                        {aguardandoResposta.map(s => (
                            <div key={s.id} className="bg-blue-50 dark:bg-blue-950/20 rounded-2xl p-5 border border-blue-100 dark:border-blue-900 text-sm">
                                <p className="font-bold text-blue-800 dark:text-blue-200">{formatarTiposComOpcoes(tipos, s.tipos || [], s.detalhes || {}, s.outro_texto)}</p>
                                <p className="text-blue-600 dark:text-blue-400 mt-1">
                                    Sugeriu {formatarDataBr(s.sugestao.data)} às {s.sugestao.hora} — aguardando {s.colaborador?.nome} responder.
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="space-y-3">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Aceitos por você</h2>
                {aceitas.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">Nenhum momento agendado.</p>
                ) : (
                    <div className="grid gap-3">
                        {aceitas.map(s => (
                            <CardSolicitacaoLider
                                key={s.id} s={s} papeis={papeis} tipos={tipos} meuPapelId={papelId}
                                acting={acting === s.id}
                                onConcluir={() => setConcluirFor(s.id)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {concluidas.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">Concluídos</h2>
                    <div className="grid gap-3">
                        {concluidas.map(s => (
                            <CardSolicitacaoLider key={s.id} s={s} papeis={papeis} tipos={tipos} meuPapelId={papelId} acting={false} />
                        ))}
                    </div>
                </div>
            )}

            {sugerirFor && (
                <DialogSugerirHorario
                    solicitacaoId={sugerirFor}
                    onClose={() => setSugerirFor(null)}
                    onEnviado={async () => { setSugerirFor(null); await fetchDados() }}
                />
            )}
            {concluirFor && (
                <DialogConcluir
                    solicitacaoId={concluirFor}
                    onClose={() => setConcluirFor(null)}
                    onEnviado={async () => { setConcluirFor(null); await fetchDados() }}
                />
            )}
        </div>
    )
}
