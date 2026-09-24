"use client"
import { useCallback, useEffect, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Search, UserCheck } from "lucide-react"
import { toast } from "sonner"
import { SituacaoBadge, FaseBadge, formatarData, formatarHorario } from "@/components/reunioes/situacao-badge"

interface Participante {
    colaborador_id: string
    nome: string
    cargo_atual: string | null
    nucleo_atual: string | null
    situacao: string
    metodo: string | null
    registrado_em: string | null
    pre_pontuacao_status: string | null
}

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

const METODO: Record<string, string> = { qr: 'QR code', codigo: 'código', manual: 'marcado pelo organizador' }

export function ReuniaoDetalheDialog({ reuniaoId, onOpenChange, onChanged }: {
    reuniaoId: string | null
    onOpenChange: (open: boolean) => void
    onChanged: () => void
}) {
    const [reuniao, setReuniao] = useState<any>(null)
    const [participantes, setParticipantes] = useState<Participante[]>([])
    const [loading, setLoading] = useState(false)
    const [busca, setBusca] = useState("")
    const [marcando, setMarcando] = useState<string | null>(null)

    const carregar = useCallback(async () => {
        if (!reuniaoId) return
        setLoading(true)
        const res = await fetch(`/api/reunioes/${reuniaoId}`)
        const json = await res.json().catch(() => ({}))
        setLoading(false)
        if (!res.ok) return toast.error(json.error || 'Erro ao carregar reunião.')
        setReuniao(json.reuniao)
        setParticipantes(json.participantes)
    }, [reuniaoId])

    useEffect(() => {
        setBusca("")
        setReuniao(null)
        setParticipantes([])
        carregar()
    }, [carregar])

    const marcarPresenca = async (p: Participante) => {
        if (!confirm(`Marcar ${p.nome} como presente? Uma pré-pontuação pendente desta reunião para essa pessoa será revogada.`)) return
        setMarcando(p.colaborador_id)
        const res = await fetch(`/api/reunioes/${reuniaoId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ acao: 'marcar_presenca', colaborador_id: p.colaborador_id }),
        })
        const json = await res.json().catch(() => ({}))
        setMarcando(null)
        if (!res.ok) return toast.error(json.error || 'Erro ao marcar presença.')
        toast.success('Presença registrada.')
        carregar()
        onChanged()
    }

    const filtrados = participantes.filter(p => !busca || normalize(p.nome).includes(normalize(busca)))
    const contar = (s: string) => participantes.filter(p => p.situacao === s).length

    return (
        <Dialog open={!!reuniaoId} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <DialogHeader>
                    <DialogTitle className="text-slate-900 dark:text-white font-display text-xl flex items-center gap-2 flex-wrap">
                        {reuniao?.titulo || 'Reunião'} {reuniao && <FaseBadge fase={reuniao.fase} />}
                    </DialogTitle>
                    {reuniao && (
                        <DialogDescription>
                            {formatarData(reuniao.inicio)} · início {formatarHorario(reuniao.inicio)} · limite {formatarHorario(reuniao.limite_chegada)} · encerra {formatarHorario(reuniao.encerramento)}
                            {reuniao.local ? ` · ${reuniao.local}` : ''}
                        </DialogDescription>
                    )}
                </DialogHeader>

                {loading && !reuniao ? (
                    <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
                ) : (
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center">
                            {[
                                ['Presentes', contar('presente'), 'text-emerald-600'],
                                ['Atrasados', contar('atrasado'), 'text-amber-600'],
                                ['Faltas', contar('falta'), 'text-rose-600'],
                                ['Aguardando', contar('pendente'), 'text-slate-500'],
                            ].map(([rotulo, n, cor]) => (
                                <div key={rotulo as string} className="rounded-xl bg-slate-50 dark:bg-white/5 p-3">
                                    <p className={`text-2xl font-bold ${cor}`}>{n}</p>
                                    <p className="text-[10px] uppercase tracking-wider font-bold text-slate-500">{rotulo}</p>
                                </div>
                            ))}
                        </div>

                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar participante..." className="pl-8 h-9 text-xs" />
                        </div>

                        <div className="space-y-1">
                            {filtrados.map(p => (
                                <div key={p.colaborador_id} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{p.nome}</span>
                                            <SituacaoBadge situacao={p.situacao} />
                                        </div>
                                        <p className="text-[11px] text-slate-500 mt-0.5">
                                            {[p.nucleo_atual, p.cargo_atual].filter(Boolean).join(' · ')}
                                            {p.registrado_em && ` · ${formatarHorario(p.registrado_em)} via ${METODO[p.metodo || ''] || p.metodo}`}
                                            {p.pre_pontuacao_status && ` · pré-pontuação ${p.pre_pontuacao_status.toLowerCase()}`}
                                        </p>
                                    </div>
                                    {p.situacao !== 'presente' && reuniao?.fase !== 'cancelada' && (
                                        <Button size="sm" variant="ghost" className="h-8 text-xs shrink-0" disabled={marcando === p.colaborador_id} onClick={() => marcarPresenca(p)}>
                                            {marcando === p.colaborador_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <UserCheck className="h-3.5 w-3.5 mr-1" />}
                                            Marcar presente
                                        </Button>
                                    )}
                                </div>
                            ))}
                            {filtrados.length === 0 && <p className="text-xs text-slate-400 italic text-center py-6">Nenhum participante.</p>}
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    )
}
