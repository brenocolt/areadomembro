"use client"
import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import {
    Search, History, TrendingUp, TrendingDown,
    RotateCcw, Loader2, AlertTriangle, CheckCircle2
} from "lucide-react"

interface HistoryEntry {
    id: string
    type: 'addition' | 'removal'
    colaborador_id: string
    nome: string
    motivo: string
    pontos: number
    date: string
    dateRaw: string
    cargo: string
}

export function PointsFullHistory() {
    const [entries, setEntries] = useState<HistoryEntry[]>([])
    const [loading, setLoading] = useState(true)
    const [searchName, setSearchName] = useState("")
    const [searchMotivo, setSearchMotivo] = useState("")
    const [filterType, setFilterType] = useState<'all' | 'addition' | 'removal'>('all')
    const [reverting, setReverting] = useState<string | null>(null)
    const [confirmRevert, setConfirmRevert] = useState<string | null>(null)

    const fetchHistory = useCallback(async () => {
        setLoading(true)

        const [additionsRes, removalsRes] = await Promise.all([
            supabase
                .from('ocorrencias')
                .select('id, colaborador_id, motivo, pontuacao, data, cargo_na_epoca, colaboradores(nome)')
                .order('data', { ascending: false }),
            supabase
                .from('solicitacoes_remocao')
                .select('id, colaborador_id, motivo, pontos_solicitados, created_at, colaboradores(nome, cargo_atual)')
                .eq('status', 'APROVADA')
                .order('created_at', { ascending: false }),
        ])

        const additions: HistoryEntry[] = (additionsRes.data || []).map((o: any) => ({
            id: o.id,
            type: 'addition',
            colaborador_id: o.colaborador_id,
            nome: o.colaboradores?.nome || 'Desconhecido',
            motivo: o.motivo || 'Sem motivo',
            pontos: o.pontuacao || 0,
            date: new Date(o.data).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
            dateRaw: o.data,
            cargo: o.cargo_na_epoca || '',
        }))

        const removals: HistoryEntry[] = (removalsRes.data || []).map((r: any) => ({
            id: r.id,
            type: 'removal',
            colaborador_id: r.colaborador_id,
            nome: r.colaboradores?.nome || 'Desconhecido',
            motivo: r.motivo || 'Sem motivo',
            pontos: r.pontos_solicitados || 0,
            date: new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
            dateRaw: r.created_at,
            cargo: r.colaboradores?.cargo_atual || '',
        }))

        const merged = [...additions, ...removals].sort(
            (a, b) => new Date(b.dateRaw).getTime() - new Date(a.dateRaw).getTime()
        )

        setEntries(merged)
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchHistory()
        window.addEventListener('refreshPointsData', fetchHistory)
        return () => window.removeEventListener('refreshPointsData', fetchHistory)
    }, [fetchHistory])

    const handleRevert = async (entry: HistoryEntry) => {
        if (confirmRevert !== entry.id) {
            setConfirmRevert(entry.id)
            return
        }

        setReverting(entry.id)
        setConfirmRevert(null)

        try {
            // Get current pontos_negativos
            const { data: colab } = await supabase
                .from('colaboradores')
                .select('pontos_negativos')
                .eq('id', entry.colaborador_id)
                .single()

            const current = colab?.pontos_negativos || 0

            if (entry.type === 'addition') {
                // Revert addition: delete ocorrência + subtract points
                const { error } = await supabase.from('ocorrencias').delete().eq('id', entry.id)
                if (error) throw error

                await supabase
                    .from('colaboradores')
                    .update({ pontos_negativos: Math.max(0, current - entry.pontos) })
                    .eq('id', entry.colaborador_id)

                toast.success(`Ocorrência revertida. -${entry.pontos} pts de ${entry.nome}.`)
            } else {
                // Revert removal: mark as REVERTIDA + add points back
                const { error } = await supabase
                    .from('solicitacoes_remocao')
                    .update({ status: 'REVERTIDA' })
                    .eq('id', entry.id)
                if (error) throw error

                await supabase
                    .from('colaboradores')
                    .update({ pontos_negativos: current + entry.pontos })
                    .eq('id', entry.colaborador_id)

                toast.success(`Remoção revertida. +${entry.pontos} pts restaurados para ${entry.nome}.`)
            }

            fetchHistory()
            window.dispatchEvent(new Event('refreshPointsData'))
        } catch (err: any) {
            toast.error(err.message || 'Erro ao reverter ação.')
        } finally {
            setReverting(null)
        }
    }

    const filtered = entries.filter(e => {
        const matchName = !searchName || e.nome.toLowerCase().includes(searchName.toLowerCase())
        const matchMotivo = !searchMotivo || e.motivo.toLowerCase().includes(searchMotivo.toLowerCase())
        const matchType = filterType === 'all' || e.type === filterType
        return matchName && matchMotivo && matchType
    })

    const totalAdditions = entries.filter(e => e.type === 'addition').reduce((s, e) => s + e.pontos, 0)
    const totalRemovals = entries.filter(e => e.type === 'removal').reduce((s, e) => s + e.pontos, 0)

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-white/5 space-y-4 pb-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-50 dark:bg-white/5 p-2.5 rounded-2xl border border-slate-100 dark:border-white/10">
                            <History className="h-5 w-5 text-slate-500 dark:text-slate-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Histórico Completo</h3>
                            <p className="text-xs text-slate-500 mt-0.5">Todas as adições e remoções de pontos — all time</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-1.5 bg-rose-50 dark:bg-rose-500/10 px-3 py-1.5 rounded-xl">
                            <TrendingUp className="h-3.5 w-3.5 text-rose-500" />
                            <span className="text-xs font-bold text-rose-600 dark:text-rose-400">+{totalAdditions} pts adicionados</span>
                        </div>
                        <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1.5 rounded-xl">
                            <TrendingDown className="h-3.5 w-3.5 text-emerald-500" />
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">-{totalRemovals} pts removidos</span>
                        </div>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por nome..."
                            value={searchName}
                            onChange={e => setSearchName(e.target.value)}
                            className="pl-9 bg-slate-50 dark:bg-slate-900 border-none h-9 text-sm rounded-xl"
                        />
                    </div>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por motivo..."
                            value={searchMotivo}
                            onChange={e => setSearchMotivo(e.target.value)}
                            className="pl-9 bg-slate-50 dark:bg-slate-900 border-none h-9 text-sm rounded-xl"
                        />
                    </div>
                    <div className="flex gap-1 p-1 bg-slate-100 dark:bg-white/5 rounded-xl shrink-0">
                        {(['all', 'addition', 'removal'] as const).map(t => (
                            <button
                                key={t}
                                onClick={() => setFilterType(t)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${filterType === t
                                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm'
                                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                                    }`}
                            >
                                {t === 'all' ? 'Todos' : t === 'addition' ? 'Adições' : 'Remoções'}
                            </button>
                        ))}
                    </div>
                </div>
            </CardHeader>

            <CardContent className="p-0">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                        <History className="h-10 w-10 opacity-20 mb-3" />
                        <p className="text-sm font-medium">Nenhum registro encontrado</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/50 max-h-[600px] overflow-y-auto custom-scrollbar">
                        {filtered.map(entry => {
                            const isAdding = entry.type === 'addition'
                            const isConfirming = confirmRevert === entry.id
                            const isReverting = reverting === entry.id

                            return (
                                <div key={`${entry.type}-${entry.id}`} className="flex items-start gap-4 p-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                                    {/* Icon */}
                                    <div className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${isAdding
                                        ? 'bg-rose-100 dark:bg-rose-500/10'
                                        : 'bg-emerald-100 dark:bg-emerald-500/10'
                                        }`}>
                                        {isAdding
                                            ? <AlertTriangle className="h-4 w-4 text-rose-500" />
                                            : <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                        }
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2 mb-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-sm text-slate-900 dark:text-white">{entry.nome}</span>
                                                {entry.cargo && (
                                                    <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded-md">{entry.cargo}</span>
                                                )}
                                                <Badge variant="outline" className={`text-[10px] border-0 font-bold ${isAdding
                                                    ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400'
                                                    : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                                    }`}>
                                                    {isAdding ? `+${entry.pontos} pts` : `-${entry.pontos} pts`}
                                                </Badge>
                                            </div>
                                            <span className="text-[10px] text-slate-400 font-mono shrink-0">{entry.date}</span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">{entry.motivo}</p>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider mt-1 inline-block ${isAdding ? 'text-rose-400' : 'text-emerald-400'}`}>
                                            {isAdding ? 'Ocorrência' : 'Remoção aprovada'}
                                        </span>
                                    </div>

                                    {/* Revert button */}
                                    <div className="shrink-0">
                                        {isConfirming ? (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-slate-500 font-medium">Confirmar?</span>
                                                <button
                                                    onClick={() => handleRevert(entry)}
                                                    disabled={!!isReverting}
                                                    className="h-7 px-2 flex items-center gap-1 rounded-lg bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 text-[10px] font-bold hover:bg-rose-100 dark:hover:bg-rose-500/20 transition-colors"
                                                >
                                                    {isReverting ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Sim'}
                                                </button>
                                                <button
                                                    onClick={() => setConfirmRevert(null)}
                                                    className="h-7 px-2 rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 text-[10px] font-bold hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                                                >
                                                    Não
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => handleRevert(entry)}
                                                disabled={!!reverting}
                                                className="h-8 w-8 flex items-center justify-center rounded-xl text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                                title="Reverter esta ação"
                                            >
                                                <RotateCcw className="h-3.5 w-3.5" />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
