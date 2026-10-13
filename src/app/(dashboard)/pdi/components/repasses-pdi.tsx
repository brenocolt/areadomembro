"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CalendarCheck, ExternalLink, Loader2, Plus, Users } from "lucide-react"
import { toast } from "sonner"
import {
    formatarDataBr, formatarDataHoraSp, gerarHorariosDisponiveis, dataParaChave, linkAdicionarAgenda,
    type PdiRepasse, type PdiTipoMomento,
} from "@/lib/pdi"

const SEM_AREA = '__nenhuma__'

const STATUS_ROTULO: Record<PdiRepasse['status'], string> = { aberto: 'Inscrições abertas', confirmado: 'Confirmado', cancelado: 'Cancelado' }
const STATUS_CLASSE: Record<PdiRepasse['status'], string> = {
    aberto: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
    confirmado: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800',
    cancelado: 'bg-rose-500/10 text-rose-500 border-rose-200 dark:border-rose-800',
}

function mensagemDeErro(json: { error?: string, detalhe?: string }, padrao: string) {
    return `${json.error || padrao}${json.detalhe ? ` (${json.detalhe})` : ''}`
}

function DialogNovoRepasse({ areas, onClose, onCriado }: { areas: string[], onClose: () => void, onCriado: () => void }) {
    const [titulo, setTitulo] = useState('Formulação de cronograma')
    const [area, setArea] = useState(SEM_AREA)
    const [descricao, setDescricao] = useState('')
    const [data, setData] = useState('')
    const [hora, setHora] = useState('')
    const [duracao, setDuracao] = useState('60')
    const [prazoData, setPrazoData] = useState('')
    const [prazoHora, setPrazoHora] = useState('18:00')
    const [vagas, setVagas] = useState('')
    const [enviando, setEnviando] = useState(false)
    const [erro, setErro] = useState<string | null>(null)

    const hoje = new Date()
    const limite = new Date(); limite.setDate(limite.getDate() + 60)

    async function criar() {
        if (!titulo.trim()) { setErro('Informe um título.'); return }
        if (!data || !hora) { setErro('Escolha a data e o horário do momento.'); return }
        if (!prazoData || !prazoHora) { setErro('Informe até quando os membros podem entrar.'); return }
        setEnviando(true)
        setErro(null)
        try {
            const res = await fetch('/api/pdi/repasses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    titulo, descricao, data, hora, duracao_min: Number(duracao),
                    categoria: area === SEM_AREA ? null : area,
                    prazo_data: prazoData, prazo_hora: prazoHora, vagas: vagas || null,
                }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) { setErro(mensagemDeErro(json, 'Erro ao criar o repasse.')); return }
            if (json.slack?.ok) toast.success('Repasse criado e anunciado no Slack.')
            else toast.warning(`Repasse criado, mas não foi anunciado no Slack${json.slack?.motivo ? `: ${json.slack.motivo}` : '.'}`, { duration: 15000 })
            onCriado()
        } finally {
            setEnviando(false)
        }
    }

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Novo repasse</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                    <p className="text-xs text-slate-400">O repasse é anunciado no canal do Slack. Os membros entram até o prazo e, depois, você confirma e o evento vai para o Google Agenda.</p>
                    <div className="space-y-1.5">
                        <Label>Título</Label>
                        <Input value={titulo} maxLength={150} onChange={(e) => setTitulo(e.target.value)} />
                    </div>
                    {areas.length > 0 && (
                        <div className="space-y-1.5">
                            <Label>Área (opcional)</Label>
                            <Select value={area} onValueChange={setArea}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={SEM_AREA}>Sem área</SelectItem>
                                    {areas.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <Label>Sobre o momento (opcional)</Label>
                        <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={3} maxLength={2000} className="resize-none" />
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5 col-span-1">
                            <Label>Data do momento</Label>
                            <Input type="date" min={dataParaChave(hoje)} max={dataParaChave(limite)} value={data} onChange={(e) => setData(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Horário</Label>
                            <Select value={hora} onValueChange={setHora}>
                                <SelectTrigger><SelectValue placeholder="Hora" /></SelectTrigger>
                                <SelectContent>{gerarHorariosDisponiveis().map(h => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Duração</Label>
                            <Select value={duracao} onValueChange={setDuracao}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>{['30', '60', '90', '120'].map(d => <SelectItem key={d} value={d}>{d} min</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-1.5">
                            <Label>Entrar até (data)</Label>
                            <Input type="date" min={dataParaChave(hoje)} max={data || dataParaChave(limite)} value={prazoData} onChange={(e) => setPrazoData(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Entrar até (hora)</Label>
                            <Input type="time" value={prazoHora} onChange={(e) => setPrazoHora(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Vagas (opcional)</Label>
                            <Input type="number" min={1} max={200} value={vagas} onChange={(e) => setVagas(e.target.value)} placeholder="Sem limite" />
                        </div>
                    </div>
                    {erro && <p className="text-sm text-rose-500">{erro}</p>}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold">Cancelar</Button>
                        <Button onClick={criar} disabled={enviando} className="rounded-xl font-bold">
                            {enviando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Criar e anunciar no Slack
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export function RepassesPdi({ tipos }: { tipos: PdiTipoMomento[] }) {
    const areas = useMemo(() => tipos.find(t => t.id === 'cronograma')?.sub_opcoes ?? [], [tipos])
    const [repasses, setRepasses] = useState<PdiRepasse[]>([])
    const [loading, setLoading] = useState(true)
    const [criando, setCriando] = useState(false)
    const [agindo, setAgindo] = useState<string | null>(null)
    const [versao, setVersao] = useState(0)
    const recarregar = () => setVersao(v => v + 1)

    useEffect(() => {
        let ativo = true
        fetch('/api/pdi/repasses')
            .then(async res => {
                if (!ativo) return
                const json = await res.json().catch(() => ({}))
                if (res.ok) setRepasses(json.repasses || [])
                else toast.error(mensagemDeErro(json, 'Erro ao carregar os repasses.'), { duration: 15000 })
            })
            .catch(() => { if (ativo) toast.error('Erro ao carregar os repasses.') })
            .finally(() => { if (ativo) setLoading(false) })
        return () => { ativo = false }
    }, [versao])

    async function agir(r: PdiRepasse, action: 'confirmar' | 'cancelar') {
        const encerrado = new Date(r.prazo_adesao).getTime() <= Date.now()
        if (action === 'cancelar' && !window.confirm(`Cancelar "${r.titulo}"? Quem já entrou será avisado.`)) return
        if (action === 'confirmar' && !encerrado && !window.confirm(`As inscrições vão até ${formatarDataHoraSp(r.prazo_adesao)}. Encerrar agora e confirmar?`)) return
        setAgindo(r.id)
        try {
            const res = await fetch(`/api/pdi/repasses/${r.id}`, {
                method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }),
            })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) { toast.error(mensagemDeErro(json, 'Erro ao atualizar o repasse.'), { duration: 15000 }); return }
            if (action === 'cancelar') toast.success('Repasse cancelado.')
            else if (json.agenda === 'automatica') toast.success('Repasse confirmado! O convite foi enviado pelo Google Agenda.')
            else toast.success('Repasse confirmado! Clique em "Adicionar ao Google Agenda" no cartão para criar o evento.', { duration: 10000 })
            if (json.aviso) toast.warning(json.aviso, { duration: 15000 })
            recarregar()
        } finally {
            setAgindo(null)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-sm text-slate-500 max-w-xl">Ofereça um momento (ex.: formulação de cronograma). Ele cai no Slack, os membros entram até o prazo e você confirma para mandar ao Google Agenda.</p>
                <Button onClick={() => setCriando(true)} className="rounded-xl font-bold"><Plus className="h-4 w-4 mr-2" /> Novo repasse</Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : repasses.length === 0 ? (
                <p className="text-sm text-slate-400 italic py-4">Você ainda não criou nenhum repasse.</p>
            ) : (
                <div className="grid gap-3">
                    {repasses.map(r => {
                        const participantes = r.participantes || []
                        const encerrado = new Date(r.prazo_adesao).getTime() <= Date.now()
                        const emails = participantes.map(p => p.colaborador?.email_corporativo).filter(Boolean) as string[]
                        const ocupado = agindo === r.id
                        return (
                            <div key={r.id} className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 shadow-sm space-y-3">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <p className="font-bold text-slate-900 dark:text-white">{r.titulo}</p>
                                        <p className="text-sm text-slate-500 mt-0.5">{formatarDataBr(r.data)} às {String(r.hora).slice(0, 5)} · {r.duracao_min} min{r.categoria ? ` · ${r.categoria}` : ''}</p>
                                        {r.criador?.nome && <p className="text-xs text-slate-400 mt-0.5">por {r.criador.nome}</p>}
                                    </div>
                                    <Badge variant="outline" className={`shrink-0 ${STATUS_CLASSE[r.status]}`}>{STATUS_ROTULO[r.status]}</Badge>
                                </div>

                                <div className="text-sm space-y-1">
                                    <p className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
                                        <Users className="h-4 w-4 text-slate-400" />
                                        {participantes.length}{r.vagas ? `/${r.vagas}` : ''} participante{participantes.length === 1 ? '' : 's'}
                                        {r.status === 'aberto' && <span className="text-slate-400"> · {encerrado ? 'inscrições encerradas' : `entram até ${formatarDataHoraSp(r.prazo_adesao)}`}</span>}
                                    </p>
                                    {participantes.length > 0 && (
                                        <p className="text-xs text-slate-500">{participantes.map(p => p.colaborador?.nome).filter(Boolean).join(', ')}</p>
                                    )}
                                </div>

                                <div className="flex flex-wrap gap-2 pt-1">
                                    {r.status === 'aberto' && (
                                        <Button size="sm" disabled={ocupado || participantes.length === 0} onClick={() => agir(r, 'confirmar')} className="rounded-xl font-bold">
                                            {ocupado ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CalendarCheck className="h-4 w-4 mr-2" />}
                                            {encerrado ? 'Confirmar e adicionar ao Google Agenda' : 'Encerrar inscrições e confirmar'}
                                        </Button>
                                    )}
                                    {r.status === 'confirmado' && (r.google_event_id
                                        ? <span className="text-xs text-emerald-600 self-center">✓ Evento criado no Google Agenda, convites enviados</span>
                                        : (
                                            <a target="_blank" rel="noopener noreferrer" href={linkAdicionarAgenda({
                                                titulo: `Repasse de PDI: ${r.titulo}`, dataStr: r.data, horaStr: String(r.hora).slice(0, 5), duracaoMin: r.duracao_min,
                                                detalhes: [r.descricao, `Participantes: ${participantes.map(p => p.colaborador?.nome).filter(Boolean).join(', ')}`].filter(Boolean).join('\n'),
                                                convidados: emails,
                                            })}>
                                                <Button size="sm" variant="outline" className="rounded-xl font-bold"><ExternalLink className="h-4 w-4 mr-2" />Adicionar ao Google Agenda</Button>
                                            </a>
                                        ))}
                                    {r.status !== 'cancelado' && (
                                        <Button size="sm" variant="ghost" disabled={ocupado} onClick={() => agir(r, 'cancelar')} className="rounded-xl font-bold text-rose-500 hover:bg-rose-500/10 hover:text-rose-600">Cancelar repasse</Button>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}

            {criando && <DialogNovoRepasse areas={areas} onClose={() => setCriando(false)} onCriado={() => { setCriando(false); recarregar() }} />}
        </div>
    )
}
