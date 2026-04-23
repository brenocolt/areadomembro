"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Search, Flag, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface FlagItem {
    id: string
    colaborador_id: string
    cor: string
    motivo: string
    created_at: string
    colaboradores: { nome: string } | null
}

export function AllFlagsView() {
    const [loading, setLoading] = useState(true)
    const [flags, setFlags] = useState<FlagItem[]>([])
    const [search, setSearch] = useState("")
    const [filterCor, setFilterCor] = useState<string>("all")
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const fetchFlags = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/flags')
            const data = await res.json()
            if (Array.isArray(data)) {
                setFlags(data as FlagItem[])
            } else {
                setFlags([])
            }
        } catch (err) {
            console.error('Erro ao buscar flags:', err)
            setFlags([])
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchFlags()
    }, [])

    const handleDelete = async (flagId: string) => {
        if (!confirm('Tem certeza que deseja excluir esta flag?')) return

        setDeletingId(flagId)
        try {
            const res = await fetch('/api/flags', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: flagId }),
            })
            const result = await res.json()
            if (result.success) {
                toast.success('Flag excluída com sucesso')
                setFlags(prev => prev.filter(f => f.id !== flagId))
            } else {
                toast.error(result.error || 'Erro ao excluir flag')
            }
        } catch (err) {
            console.error('Erro ao excluir flag:', err)
            toast.error('Erro ao excluir flag')
        } finally {
            setDeletingId(null)
        }
    }

    const filtered = flags.filter(f => {
        const matchSearch = (f.colaboradores?.nome || '').toLowerCase().includes(search.toLowerCase()) ||
            f.motivo.toLowerCase().includes(search.toLowerCase())
        const matchCor = filterCor === 'all' || f.cor === filterCor
        return matchSearch && matchCor
    })

    // Group stats
    const stats = {
        total: flags.length,
        azul: flags.filter(f => f.cor === 'azul').length,
        amarela: flags.filter(f => f.cor === 'amarela').length,
        vermelha: flags.filter(f => f.cor === 'vermelha').length,
        uniqueColabs: new Set(flags.map(f => f.colaborador_id)).size,
    }

    if (loading) {
        return (
            <div className="space-y-4 animate-pulse">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="h-24 bg-slate-100 dark:bg-white/5 rounded-2xl" />
                    ))}
                </div>
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-slate-100 dark:bg-white/5 rounded-2xl" />
                ))}
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/50 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mt-1">Total de Flags</p>
                </div>
                <div className="bg-blue-50/50 dark:bg-blue-500/5 border border-blue-100 dark:border-blue-500/10 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{stats.azul}</p>
                    <p className="text-[10px] uppercase font-bold text-blue-400 tracking-wider mt-1">Flags Azuis</p>
                </div>
                <div className="bg-yellow-50/50 dark:bg-yellow-500/5 border border-yellow-100 dark:border-yellow-500/10 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-2xl font-black text-yellow-600 dark:text-yellow-400">{stats.amarela}</p>
                    <p className="text-[10px] uppercase font-bold text-yellow-500 tracking-wider mt-1">Flags Amarelas</p>
                </div>
                <div className="bg-rose-50/50 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/10 rounded-2xl p-4 text-center shadow-sm">
                    <p className="text-2xl font-black text-rose-600 dark:text-rose-400">{stats.vermelha}</p>
                    <p className="text-[10px] uppercase font-bold text-rose-400 tracking-wider mt-1">Flags Vermelhas</p>
                </div>
            </div>

            {/* Flags List */}
            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-indigo-50 dark:bg-indigo-500/10 p-2.5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
                            <Flag className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Todas as Flags</CardTitle>
                            <p className="text-xs text-slate-500 mt-0.5">{stats.uniqueColabs} colaborador{stats.uniqueColabs !== 1 ? 'es' : ''} com flags</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800/50 rounded-xl p-1">
                            {[
                                { value: 'all', label: 'Todos', bgActive: 'bg-white dark:bg-slate-700' },
                                { value: 'azul', label: '🔵', bgActive: 'bg-blue-100 dark:bg-blue-500/20' },
                                { value: 'amarela', label: '🟡', bgActive: 'bg-yellow-100 dark:bg-yellow-500/20' },
                                { value: 'vermelha', label: '🔴', bgActive: 'bg-rose-100 dark:bg-rose-500/20' },
                            ].map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setFilterCor(opt.value)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-colors ${filterCor === opt.value ? `${opt.bgActive} text-slate-900 dark:text-white shadow-sm` : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                        <div className="relative w-full sm:w-56">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Buscar..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 bg-slate-50 dark:bg-slate-900 border-none h-9 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-primary"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Flag className="h-10 w-10 opacity-20 mb-3" />
                            <p className="text-sm font-medium">Nenhuma flag encontrada</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {filtered.map(flag => {
                                const dateStr = new Date(flag.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                                const timeStr = new Date(flag.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                                const nome = flag.colaboradores?.nome || 'Desconhecido'

                                let colorClass = "bg-slate-100 text-slate-600"
                                let dotColor = "bg-slate-400"
                                if (flag.cor === 'vermelha') {
                                    colorClass = "bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-400"
                                    dotColor = "bg-red-500"
                                } else if (flag.cor === 'amarela') {
                                    colorClass = "bg-yellow-100 dark:bg-yellow-500/20 text-yellow-800 dark:text-yellow-400"
                                    dotColor = "bg-yellow-500"
                                } else if (flag.cor === 'azul') {
                                    colorClass = "bg-blue-100 dark:bg-blue-500/20 text-blue-700 dark:text-blue-400"
                                    dotColor = "bg-blue-500"
                                }

                                return (
                                    <div key={flag.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                                        <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-sm text-slate-600 dark:text-slate-400 shrink-0">
                                            {nome.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{nome}</p>
                                                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${colorClass}`}>
                                                    <span className={`w-2 h-2 rounded-full ${dotColor}`}></span>
                                                    Flag {flag.cor}
                                                </span>
                                            </div>
                                            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">{flag.motivo}</p>
                                            <p className="text-[10px] text-slate-400 font-mono mt-1.5">{dateStr} às {timeStr}</p>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(flag.id)}
                                            disabled={deletingId === flag.id}
                                            className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0 p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-500/10 text-slate-400 hover:text-red-500 dark:hover:text-red-400 disabled:opacity-50"
                                            title="Excluir flag"
                                        >
                                            {deletingId === flag.id ? (
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-4 w-4" />
                                            )}
                                        </button>
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
