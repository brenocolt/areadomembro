"use client"

import { useEffect, useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { CARGO_FANTASMA } from "@/lib/cargos"
import {
    ArrowUpRight, ArrowDownLeft, Clock, Banknote, Check, X,
    Loader2, Search, ArrowUpDown
} from "lucide-react"
import { Button } from "@/components/ui/button"

// ─── Category color palette (deterministic by name) ────────────────────────

const COLOR_PALETTE = [
    { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-400' },
    { bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400' },
    { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-400' },
    { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-400' },
    { bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-700 dark:text-teal-400' },
    { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-400' },
    { bg: 'bg-pink-50 dark:bg-pink-900/20', text: 'text-pink-700 dark:text-pink-400' },
    { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-700 dark:text-indigo-400' },
    { bg: 'bg-cyan-50 dark:bg-cyan-900/20', text: 'text-cyan-700 dark:text-cyan-400' },
    { bg: 'bg-violet-50 dark:bg-violet-900/20', text: 'text-violet-700 dark:text-violet-400' },
]

function getCategoryColor(category: string) {
    let hash = 0
    for (let i = 0; i < category.length; i++) {
        hash = ((hash << 5) - hash) + category.charCodeAt(i)
        hash |= 0
    }
    return COLOR_PALETTE[Math.abs(hash) % COLOR_PALETTE.length]
}

// ─── Status colors ──────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
    PENDENTE: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
    APROVADO: 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400',
    REJEITADO: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400',
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function parseBankingInfo(descricao: string) {
    const parts = descricao.split(' | ')
    const motivo = parts[0] || descricao
    let dados: any = null
    try {
        if (parts[1]) dados = JSON.parse(parts[1])
    } catch { /* ignore */ }
    return { motivo, dados }
}

type SortKey = 'data_desc' | 'data_asc' | 'valor_desc' | 'valor_asc'

// ─── Shared Filter Bar ──────────────────────────────────────────────────────

interface FilterBarProps {
    search: string
    onSearch: (v: string) => void
    statusFilter: string
    onStatusFilter: (v: string) => void
    tipoFilter: string
    onTipoFilter: (v: string) => void
    minValor: string
    onMinValor: (v: string) => void
    maxValor: string
    onMaxValor: (v: string) => void
    sortKey: SortKey
    onSort: (v: SortKey) => void
    availableTypes: string[]
    showStatus?: boolean
}

function FilterBar({
    search, onSearch,
    statusFilter, onStatusFilter,
    tipoFilter, onTipoFilter,
    minValor, onMinValor,
    maxValor, onMaxValor,
    sortKey, onSort,
    availableTypes,
    showStatus = false,
}: FilterBarProps) {
    const hasFilters =
        search ||
        (showStatus && statusFilter !== 'all') ||
        tipoFilter !== 'all' ||
        minValor ||
        maxValor ||
        sortKey !== 'data_desc'

    const clearAll = () => {
        onSearch('')
        onStatusFilter('all')
        onTipoFilter('all')
        onMinValor('')
        onMaxValor('')
        onSort('data_desc')
    }

    return (
        <div className="px-6 py-3 border-b border-slate-100 dark:border-white/5 space-y-2.5">
            {/* Row 1: search + selects + sort */}
            <div className="flex flex-wrap gap-2 items-center">
                {/* Search */}
                <div className="relative flex-1 min-w-[180px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                    <Input
                        placeholder="Buscar por nome..."
                        value={search}
                        onChange={e => onSearch(e.target.value)}
                        className="pl-8 h-8 text-xs bg-slate-50 dark:bg-slate-900 border-none rounded-xl"
                    />
                </div>

                {/* Status filter (only for history) */}
                {showStatus && (
                    <Select value={statusFilter} onValueChange={onStatusFilter}>
                        <SelectTrigger className="h-8 text-xs w-36 bg-slate-50 dark:bg-slate-900 border-none rounded-xl">
                            <SelectValue placeholder="Status" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos os status</SelectItem>
                            <SelectItem value="APROVADO">✅ Aprovado</SelectItem>
                            <SelectItem value="REJEITADO">❌ Rejeitado</SelectItem>
                        </SelectContent>
                    </Select>
                )}

                {/* Tipo filter */}
                {availableTypes.length > 0 && (
                    <Select value={tipoFilter} onValueChange={onTipoFilter}>
                        <SelectTrigger className="h-8 text-xs w-44 bg-slate-50 dark:bg-slate-900 border-none rounded-xl">
                            <SelectValue placeholder="🏷️ Tipo de gasto" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">🏷️ Todos os tipos</SelectItem>
                            {availableTypes.map(t => (
                                <SelectItem key={t} value={t}>🏷️ {t}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {/* Sort */}
                <Select value={sortKey} onValueChange={v => onSort(v as SortKey)}>
                    <SelectTrigger className="h-8 text-xs w-48 bg-slate-50 dark:bg-slate-900 border-none rounded-xl">
                        <ArrowUpDown className="h-3 w-3 mr-1.5 text-slate-400 shrink-0" />
                        <SelectValue placeholder="Ordenar por" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="data_desc">📅 Data: Mais recente</SelectItem>
                        <SelectItem value="data_asc">📅 Data: Mais antiga</SelectItem>
                        <SelectItem value="valor_desc">💰 Valor: Maior</SelectItem>
                        <SelectItem value="valor_asc">💰 Valor: Menor</SelectItem>
                    </SelectContent>
                </Select>

                {/* Clear */}
                {hasFilters && (
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={clearAll}
                        className="h-8 px-3 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white rounded-xl"
                    >
                        <X className="h-3 w-3 mr-1" />
                        Limpar
                    </Button>
                )}
            </div>

            {/* Row 2: value range */}
            <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs text-slate-400 shrink-0">Faixa de valor:</span>
                <div className="flex items-center gap-1.5">
                    <span className="text-xs text-slate-400">R$</span>
                    <Input
                        placeholder="Mín"
                        value={minValor}
                        onChange={e => onMinValor(e.target.value)}
                        type="number"
                        min="0"
                        className="h-7 w-20 text-xs bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-center"
                    />
                    <span className="text-xs text-slate-300 dark:text-slate-600">—</span>
                    <span className="text-xs text-slate-400">R$</span>
                    <Input
                        placeholder="Máx"
                        value={maxValor}
                        onChange={e => onMaxValor(e.target.value)}
                        type="number"
                        min="0"
                        className="h-7 w-20 text-xs bg-slate-50 dark:bg-slate-900 border-none rounded-xl text-center"
                    />
                </div>
            </div>
        </div>
    )
}

// ─── PipjHistory (unchanged) ─────────────────────────────────────────────────

export function PipjHistory() {
    const [transactions, setTransactions] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchData() {
            setLoading(true)

            const { data } = await supabase
                .from('transacoes_pipj')
                .select('*, colaboradores(nome, status, cargo_atual)')
                .order('data', { ascending: false })
                .limit(40)

            if (data) {
                const ativos = (data as any[]).filter(t => t.colaboradores?.status !== 'Desligado' && t.colaboradores?.cargo_atual !== CARGO_FANTASMA)
                setTransactions(ativos.slice(0, 20))
            }
            setLoading(false)
        }

        fetchData()
        window.addEventListener('refreshPipjData', fetchData)

        const sub = supabase.channel('transacoes_pipj_history')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'transacoes_pipj' }, fetchData)
            .subscribe()

        return () => {
            supabase.removeChannel(sub)
            window.removeEventListener('refreshPipjData', fetchData)
        }
    }, [])

    if (loading) return <Card className="h-96 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-3xl border-none" />

    return (
        <div className="space-y-6">
            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-white/5">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                        Movimentações Recentes
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {transactions.length === 0 ? (
                        <div className="flex items-center justify-center h-40 text-slate-400 dark:text-slate-500 text-sm">
                            Nenhuma movimentação registrada.
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-white/5">
                            {transactions.map((tx) => {
                                const isEntrada = tx.tipo === 'ENTRADA'
                                return (
                                    <div key={tx.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-xl ${isEntrada ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-rose-50 dark:bg-rose-900/20'}`}>
                                                {isEntrada
                                                    ? <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                                                    : <ArrowDownLeft className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                                                }
                                            </div>
                                            <div>
                                                <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                    {tx.colaboradores?.nome || 'Desconhecido'}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    {tx.descricao || (isEntrada ? 'Crédito PIPJ' : 'Retirada PIPJ')}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className={`text-sm font-bold ${isEntrada ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                                                {isEntrada ? '+' : '-'}R$ {Number(tx.valor).toFixed(2).replace('.', ',')}
                                            </p>
                                            <div className="flex items-center gap-1 text-xs text-slate-400">
                                                <Clock className="h-3 w-3" />
                                                {new Date(tx.data).toLocaleDateString('pt-BR')}
                                            </div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

// ─── SaquePendingRequestsList ────────────────────────────────────────────────

export function SaquePendingRequestsList() {
    const [saques, setSaques] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [processingId, setProcessingId] = useState<string | null>(null)

    // Filter state
    const [search, setSearch] = useState('')
    const [tipoFilter, setTipoFilter] = useState('all')
    const [minValor, setMinValor] = useState('')
    const [maxValor, setMaxValor] = useState('')
    const [sortKey, setSortKey] = useState<SortKey>('data_desc')

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            const { data } = await supabase
                .from('solicitacoes_saque')
                .select('*, colaboradores(nome, status, cargo_atual)')
                .eq('tipo', 'saque_pipj')
                .eq('status', 'PENDENTE')
                .order('data_solicitacao', { ascending: true })
            if (data) setSaques((data as any[]).filter(s => s.colaboradores?.status !== 'Desligado' && s.colaboradores?.cargo_atual !== CARGO_FANTASMA))
            setLoading(false)
        }
        fetchData()

        const sub = supabase.channel('solicitacoes_saque_pending_list')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes_saque' }, fetchData)
            .subscribe()
        return () => { supabase.removeChannel(sub) }
    }, [])

    const handleAction = async (id: string, action: 'APROVAR' | 'REJEITAR') => {
        setProcessingId(id)
        try {
            const res = await fetch('/api/pipj/saque', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id, action })
            })
            const data = await res.json()
            if (!res.ok) {
                alert(data.error || 'Erro ao processar solicitação')
            } else {
                setSaques(prev => prev.filter(s => s.id !== id))
            }
        } catch {
            alert('Erro de conexão.')
        } finally {
            setProcessingId(null)
        }
    }

    // Derived: all unique tipos
    const availableTypes = useMemo(() => {
        const types = new Set<string>()
        saques.forEach(s => {
            const { dados } = parseBankingInfo(s.descricao || '')
            if (dados?.tipo_gasto) types.add(dados.tipo_gasto)
        })
        return Array.from(types).sort()
    }, [saques])

    // Filtered + sorted list
    const filtered = useMemo(() => {
        let list = [...saques]

        if (search) {
            const q = search.toLowerCase()
            list = list.filter(s => (s.colaboradores?.nome || '').toLowerCase().includes(q))
        }

        if (tipoFilter !== 'all') {
            list = list.filter(s => {
                const { dados } = parseBankingInfo(s.descricao || '')
                return dados?.tipo_gasto === tipoFilter
            })
        }

        if (minValor !== '') {
            list = list.filter(s => Number(s.valor) >= Number(minValor))
        }
        if (maxValor !== '') {
            list = list.filter(s => Number(s.valor) <= Number(maxValor))
        }

        list.sort((a, b) => {
            if (sortKey === 'valor_desc') return Number(b.valor) - Number(a.valor)
            if (sortKey === 'valor_asc') return Number(a.valor) - Number(b.valor)
            if (sortKey === 'data_asc') return new Date(a.data_solicitacao).getTime() - new Date(b.data_solicitacao).getTime()
            // data_desc (default)
            return new Date(b.data_solicitacao).getTime() - new Date(a.data_solicitacao).getTime()
        })

        return list
    }, [saques, search, tipoFilter, minValor, maxValor, sortKey])

    if (loading) return <Card className="h-48 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-3xl border-none" />

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Banknote className="h-5 w-5 text-amber-500" />
                        <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                            Solicitações de Saque Pendentes
                        </CardTitle>
                    </div>
                    {saques.length > 0 && (
                        <span className="text-xs text-slate-400">
                            {filtered.length} de {saques.length}
                        </span>
                    )}
                </div>
            </CardHeader>

            {saques.length > 0 && (
                <FilterBar
                    search={search} onSearch={setSearch}
                    statusFilter="all" onStatusFilter={() => {}}
                    tipoFilter={tipoFilter} onTipoFilter={setTipoFilter}
                    minValor={minValor} onMinValor={setMinValor}
                    maxValor={maxValor} onMaxValor={setMaxValor}
                    sortKey={sortKey} onSort={setSortKey}
                    availableTypes={availableTypes}
                    showStatus={false}
                />
            )}

            <CardContent className="p-0">
                {saques.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-slate-400 dark:text-slate-500 text-sm">
                        Nenhuma solicitação de saque pendente.
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                        <Search className="h-8 w-8 opacity-20" />
                        <p className="text-sm">Nenhum resultado para os filtros aplicados.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {filtered.map((s) => {
                            const { motivo, dados } = parseBankingInfo(s.descricao || '')
                            const isProcessing = processingId === s.id
                            const catColor = dados?.tipo_gasto ? getCategoryColor(dados.tipo_gasto) : null

                            return (
                                <div key={s.id} className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                {s.colaboradores?.nome || 'Desconhecido'}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{motivo}</p>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-1">
                                            <span className="text-lg font-bold text-amber-600 dark:text-amber-400">
                                                R$ {Number(s.valor).toFixed(2).replace('.', ',')}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-4">
                                        <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                            {dados?.forma && (
                                                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg font-medium">
                                                    {dados.forma === 'pix' ? '🔑 PIX' : '🏦 Transferência'}
                                                </span>
                                            )}
                                            {dados?.tipo_gasto && catColor && (
                                                <span className={`${catColor.bg} ${catColor.text} px-2 py-1 rounded-lg font-medium`}>
                                                    🏷️ {dados.tipo_gasto}
                                                </span>
                                            )}
                                            {dados?.chave_pix && (
                                                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                                    Chave: {dados.chave_pix}
                                                </span>
                                            )}
                                            {dados?.banco && (
                                                <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                                    {dados.banco} | Ag: {dados.agencia} | Cc: {dados.conta}
                                                </span>
                                            )}
                                            {s.comprovante_url && (
                                                <a href={s.comprovante_url} target="_blank" rel="noopener noreferrer" className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg hover:underline">
                                                    📎 Comprovante
                                                </a>
                                            )}
                                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                                📅 {s.data_solicitacao ? new Date(s.data_solicitacao).toLocaleDateString('pt-BR') : '—'}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/30 dark:text-red-400 dark:hover:bg-red-900/20"
                                                disabled={isProcessing || processingId !== null}
                                                onClick={() => handleAction(s.id, 'REJEITAR')}
                                            >
                                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4 mr-1" />}
                                                Rejeitar
                                            </Button>
                                            <Button
                                                size="sm"
                                                className="bg-green-600 hover:bg-green-700 text-white"
                                                disabled={isProcessing || processingId !== null}
                                                onClick={() => handleAction(s.id, 'APROVAR')}
                                            >
                                                {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 mr-1" />}
                                                Aprovar
                                            </Button>
                                        </div>
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

// ─── SaqueHistoryList ────────────────────────────────────────────────────────

export function SaqueHistoryList() {
    const [saques, setSaques] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Filter state
    const [search, setSearch] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [tipoFilter, setTipoFilter] = useState('all')
    const [minValor, setMinValor] = useState('')
    const [maxValor, setMaxValor] = useState('')
    const [sortKey, setSortKey] = useState<SortKey>('data_desc')

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            const { data } = await supabase
                .from('solicitacoes_saque')
                .select('*, colaboradores(nome, status, cargo_atual)')
                .eq('tipo', 'saque_pipj')
                .neq('status', 'PENDENTE')
                .order('data_solicitacao', { ascending: false })
            if (data) setSaques((data as any[]).filter(s => s.colaboradores?.status !== 'Desligado' && s.colaboradores?.cargo_atual !== CARGO_FANTASMA))
            setLoading(false)
        }
        fetchData()

        const sub = supabase.channel('solicitacoes_saque_history_list')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes_saque' }, fetchData)
            .subscribe()
        return () => { supabase.removeChannel(sub) }
    }, [])

    // Derived: all unique tipos
    const availableTypes = useMemo(() => {
        const types = new Set<string>()
        saques.forEach(s => {
            const { dados } = parseBankingInfo(s.descricao || '')
            if (dados?.tipo_gasto) types.add(dados.tipo_gasto)
        })
        return Array.from(types).sort()
    }, [saques])

    // Filtered + sorted list
    const filtered = useMemo(() => {
        let list = [...saques]

        if (search) {
            const q = search.toLowerCase()
            list = list.filter(s => (s.colaboradores?.nome || '').toLowerCase().includes(q))
        }

        if (statusFilter !== 'all') {
            list = list.filter(s => s.status === statusFilter)
        }

        if (tipoFilter !== 'all') {
            list = list.filter(s => {
                const { dados } = parseBankingInfo(s.descricao || '')
                return dados?.tipo_gasto === tipoFilter
            })
        }

        if (minValor !== '') {
            list = list.filter(s => Number(s.valor) >= Number(minValor))
        }
        if (maxValor !== '') {
            list = list.filter(s => Number(s.valor) <= Number(maxValor))
        }

        list.sort((a, b) => {
            if (sortKey === 'valor_desc') return Number(b.valor) - Number(a.valor)
            if (sortKey === 'valor_asc') return Number(a.valor) - Number(b.valor)
            if (sortKey === 'data_asc') return new Date(a.data_solicitacao).getTime() - new Date(b.data_solicitacao).getTime()
            return new Date(b.data_solicitacao).getTime() - new Date(a.data_solicitacao).getTime()
        })

        return list
    }, [saques, search, statusFilter, tipoFilter, minValor, maxValor, sortKey])

    if (loading) return <Card className="h-48 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-3xl border-none" />

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-slate-500" />
                        <CardTitle className="text-base font-bold text-slate-900 dark:text-white">
                            Histórico de Saques
                        </CardTitle>
                    </div>
                    {saques.length > 0 && (
                        <span className="text-xs text-slate-400">
                            {filtered.length} de {saques.length}
                        </span>
                    )}
                </div>
            </CardHeader>

            {saques.length > 0 && (
                <FilterBar
                    search={search} onSearch={setSearch}
                    statusFilter={statusFilter} onStatusFilter={setStatusFilter}
                    tipoFilter={tipoFilter} onTipoFilter={setTipoFilter}
                    minValor={minValor} onMinValor={setMinValor}
                    maxValor={maxValor} onMaxValor={setMaxValor}
                    sortKey={sortKey} onSort={setSortKey}
                    availableTypes={availableTypes}
                    showStatus={true}
                />
            )}

            <CardContent className="p-0">
                {saques.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-slate-400 dark:text-slate-500 text-sm">
                        Nenhum histórico de saque registrado.
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-400 gap-2">
                        <Search className="h-8 w-8 opacity-20" />
                        <p className="text-sm">Nenhum resultado para os filtros aplicados.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {filtered.map((s) => {
                            const { motivo, dados } = parseBankingInfo(s.descricao || '')
                            const catColor = dados?.tipo_gasto ? getCategoryColor(dados.tipo_gasto) : null

                            return (
                                <div key={s.id} className="px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <div>
                                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                                {s.colaboradores?.nome || 'Desconhecido'}
                                            </p>
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{motivo}</p>
                                        </div>
                                        <div className="text-right flex flex-col items-end gap-1">
                                            <span className="text-lg font-bold text-slate-900 dark:text-white">
                                                R$ {Number(s.valor).toFixed(2).replace('.', ',')}
                                            </span>
                                            <Badge className={STATUS_COLORS[s.status] || 'bg-slate-100 text-slate-600'}>
                                                {s.status || 'DESCONHECIDO'}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs text-slate-500">
                                        {dados?.forma && (
                                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg font-medium">
                                                {dados.forma === 'pix' ? '🔑 PIX' : '🏦 Transferência'}
                                            </span>
                                        )}
                                        {dados?.tipo_gasto && catColor && (
                                            <span className={`${catColor.bg} ${catColor.text} px-2 py-1 rounded-lg font-medium`}>
                                                🏷️ {dados.tipo_gasto}
                                            </span>
                                        )}
                                        {dados?.chave_pix && (
                                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                                Chave: {dados.chave_pix}
                                            </span>
                                        )}
                                        {dados?.banco && (
                                            <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                                {dados.banco} | Ag: {dados.agencia} | Cc: {dados.conta}
                                            </span>
                                        )}
                                        {s.comprovante_url && (
                                            <a href={s.comprovante_url} target="_blank" rel="noopener noreferrer" className="bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 px-2 py-1 rounded-lg hover:underline">
                                                📎 Comprovante
                                            </a>
                                        )}
                                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-lg">
                                            📅 {s.data_solicitacao ? new Date(s.data_solicitacao).toLocaleDateString('pt-BR') : '—'}
                                        </span>
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
