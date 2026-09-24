"use client"

import { useCallback, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CalendarPlus, ExternalLink, MapPin, MoreVertical, QrCode, RefreshCw, Trash2, Users, X } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { FaseBadge, formatarData, formatarHorario } from "@/components/reunioes/situacao-badge"
import { CreateReuniaoDialog } from "./components/create-reuniao-dialog"
import { ReuniaoDetalheDialog } from "./components/reuniao-detalhe-dialog"

interface ReuniaoItem {
    id: string
    titulo: string
    local: string | null
    inicio: string
    limite_chegada: string
    encerramento: string
    fase: 'qr' | 'codigo' | 'encerrada' | 'cancelada'
    total_participantes: number
    total_presentes: number
    total_atrasados: number
}

export default function ReunioesManagementPage() {
    const [reunioes, setReunioes] = useState<ReuniaoItem[]>([])
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState<string | null>(null)
    const [criando, setCriando] = useState(false)
    const [detalheId, setDetalheId] = useState<string | null>(null)

    const carregar = useCallback(async () => {
        setLoading(true)
        const res = await fetch('/api/reunioes')
        const json = await res.json().catch(() => ({}))
        setLoading(false)
        if (!res.ok) {
            setErro(json.error || 'Erro ao carregar reuniões.')
            return
        }
        setErro(null)
        setReunioes(json.reunioes)
    }, [])

    useEffect(() => { carregar() }, [carregar])

    const apresentar = (id: string) => window.open(`/reuniao-apresentacao/${id}`, '_blank')

    const cancelar = async (r: ReuniaoItem) => {
        if (!confirm(`Cancelar "${r.titulo}"? Ninguém será pontuado por esta reunião.`)) return
        const res = await fetch(`/api/reunioes/${r.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ acao: 'cancelar' }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) return toast.error(json.error || 'Erro ao cancelar.')
        toast.success('Reunião cancelada.')
        carregar()
    }

    const excluir = async (r: ReuniaoItem) => {
        if (!confirm(`Excluir "${r.titulo}" e todas as presenças registradas? Pré-pontuações já geradas continuam na Gestão de Pontos.`)) return
        const res = await fetch(`/api/reunioes/${r.id}`, { method: 'DELETE' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) return toast.error(json.error || 'Erro ao excluir.')
        toast.success('Reunião excluída.')
        carregar()
    }

    const ativas = reunioes.filter(r => r.fase === 'qr' || r.fase === 'codigo')
    const passadas = reunioes.filter(r => r.fase === 'encerrada' || r.fase === 'cancelada')

    const linha = (r: ReuniaoItem) => (
        <div key={r.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-slate-100 dark:hover:border-white/5">
            <div className="h-11 w-11 rounded-xl bg-violet-50 dark:bg-violet-500/10 flex flex-col items-center justify-center text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-500/20 shrink-0">
                <span className="text-sm font-bold leading-none">{new Date(r.inicio).getDate()}</span>
                <span className="text-[9px] uppercase font-bold">{new Date(r.inicio).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
            </div>
            <button className="flex-1 min-w-0 text-left" onClick={() => setDetalheId(r.id)}>
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{r.titulo}</span>
                    <FaseBadge fase={r.fase} />
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                    {formatarData(r.inicio)} · {formatarHorario(r.inicio)} (limite {formatarHorario(r.limite_chegada)}, encerra {formatarHorario(r.encerramento)})
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-3 flex-wrap">
                    <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> {r.total_presentes} presentes · {r.total_atrasados} atrasados · {r.total_participantes} esperados</span>
                    {r.local && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.local}</span>}
                </p>
            </button>
            <div className="flex items-center gap-1 shrink-0">
                {(r.fase === 'qr' || r.fase === 'codigo') && (
                    <Button size="sm" onClick={() => apresentar(r.id)} className="h-8 rounded-lg text-xs font-bold">
                        <QrCode className="h-3.5 w-3.5 mr-1" /> Apresentar <ExternalLink className="h-3 w-3 ml-1 opacity-60" />
                    </Button>
                )}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg"><MoreVertical className="h-4 w-4" /></Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDetalheId(r.id)}><Users className="h-4 w-4 mr-2" /> Ver presenças</DropdownMenuItem>
                        {r.fase !== 'encerrada' && r.fase !== 'cancelada' && (
                            <DropdownMenuItem onClick={() => cancelar(r)}><X className="h-4 w-4 mr-2" /> Cancelar reunião</DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => excluir(r)} className="text-rose-600"><Trash2 className="h-4 w-4 mr-2" /> Excluir</DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    )

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Gestão de Reuniões</h1>
                    <p className="text-sm text-slate-500">Agende reuniões, apresente o QR code de presença e acompanhe atrasos e faltas.</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button onClick={carregar} variant="ghost" size="icon" className="h-9 w-9 rounded-xl"><RefreshCw className="h-4 w-4" /></Button>
                    <Button onClick={() => setCriando(true)} className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25">
                        <CalendarPlus className="h-4 w-4 mr-2" /> Nova reunião
                    </Button>
                </div>
            </div>

            {erro && (
                <div className="rounded-2xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">{erro}</div>
            )}

            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none rounded-3xl shadow-sm">
                <CardHeader className="border-b border-slate-100 dark:border-white/5 pb-4">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Próximas e em andamento</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-1">
                    {loading ? <p className="text-sm text-slate-400 italic text-center py-8">Carregando...</p>
                        : ativas.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Nenhuma reunião agendada.</p>
                        : ativas.slice().reverse().map(linha)}
                </CardContent>
            </Card>

            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none rounded-3xl shadow-sm">
                <CardHeader className="border-b border-slate-100 dark:border-white/5 pb-4">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Encerradas</CardTitle>
                    <p className="text-xs text-slate-500">As faltas são pré-pontuadas automaticamente após o encerramento e aparecem em Gestão de Pontos → Usuários Pré Pontuados.</p>
                </CardHeader>
                <CardContent className="pt-4 space-y-1">
                    {loading ? <p className="text-sm text-slate-400 italic text-center py-8">Carregando...</p>
                        : passadas.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Nenhuma reunião encerrada.</p>
                        : passadas.map(linha)}
                </CardContent>
            </Card>

            <CreateReuniaoDialog open={criando} onOpenChange={setCriando} onCreated={carregar} />
            <ReuniaoDetalheDialog reuniaoId={detalheId} onOpenChange={o => !o && setDetalheId(null)} onChanged={carregar} />
        </div>
    )
}
