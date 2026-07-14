"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Search, Wallet, Pencil, Check, X, Loader2 } from "lucide-react"

interface ColabSaldo {
    id: string
    nome: string
    cargo_atual: string
    nivel_consultor: string
    saldo_pipj: number
    status?: string
}

export function PipjSaldos() {
    const [colabs, setColabs] = useState<ColabSaldo[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editValue, setEditValue] = useState("")
    const [saving, setSaving] = useState(false)

    const fetchData = useCallback(async () => {
        setLoading(true)
        const { data } = await supabase
            .from('colaboradores')
            .select('id, nome, cargo_atual, nivel_consultor, saldo_pipj, status')
            .eq('status', 'Ativo')
            .order('nome', { ascending: true })
        if (data) setColabs(data)
        setLoading(false)
    }, [])

    useEffect(() => {
        fetchData()
        window.addEventListener('refreshPipjData', fetchData)
        return () => window.removeEventListener('refreshPipjData', fetchData)
    }, [fetchData])

    const filtered = colabs.filter(c =>
        !search || c.nome.toLowerCase().includes(search.toLowerCase()) ||
        (c.cargo_atual || '').toLowerCase().includes(search.toLowerCase())
    )

    const totalSaldo = colabs.reduce((s, c) => s + Number(c.saldo_pipj || 0), 0)

    const startEdit = (colab: ColabSaldo) => {
        setEditingId(colab.id)
        setEditValue(String(Number(colab.saldo_pipj || 0).toFixed(2)))
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditValue("")
    }

    const saveEdit = async (colabId: string) => {
        const newVal = parseFloat(editValue.replace(',', '.'))
        if (isNaN(newVal) || newVal < 0) {
            toast.error('Valor inválido.')
            return
        }

        setSaving(true)
        const old = colabs.find(c => c.id === colabId)
        const diff = newVal - Number(old?.saldo_pipj || 0)

        const { error } = await supabase
            .from('colaboradores')
            .update({ saldo_pipj: newVal })
            .eq('id', colabId)

        if (error) {
            toast.error('Erro ao salvar.')
        } else {
            // Record manual adjustment transaction
            if (diff !== 0) {
                await supabase.from('transacoes_pipj').insert({
                    colaborador_id: colabId,
                    tipo: diff > 0 ? 'ENTRADA' : 'SAIDA',
                    valor: Math.abs(diff),
                    descricao: 'Ajuste manual de saldo',
                    data: new Date().toISOString(),
                })
            }
            setColabs(prev => prev.map(c => c.id === colabId ? { ...c, saldo_pipj: newVal } : c))
            toast.success('Saldo atualizado!')
            window.dispatchEvent(new Event('refreshPipjData'))
        }

        setSaving(false)
        setEditingId(null)
        setEditValue("")
    }

    const handleKeyDown = (e: React.KeyboardEvent, colabId: string) => {
        if (e.key === 'Enter') saveEdit(colabId)
        if (e.key === 'Escape') cancelEdit()
    }

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-white/5 space-y-4 pb-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                        <div className="bg-emerald-50 dark:bg-emerald-500/10 p-2.5 rounded-2xl border border-emerald-100 dark:border-emerald-500/20">
                            <Wallet className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-slate-900 dark:text-white">Saldos PIPJ da Empresa</h3>
                            <p className="text-xs text-slate-500 mt-0.5">
                                {colabs.length} colaboradores · Total em circulação: <span className="font-bold text-emerald-600 dark:text-emerald-400">R$ {totalSaldo.toFixed(2).replace('.', ',')}</span>
                            </p>
                        </div>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar colaborador..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 bg-slate-50 dark:bg-slate-900 border-none h-9 text-sm rounded-xl"
                        />
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
                        <Wallet className="h-10 w-10 opacity-20 mb-3" />
                        <p className="text-sm font-medium">Nenhum colaborador encontrado</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {filtered.map(colab => {
                            const isEditing = editingId === colab.id
                            const saldo = Number(colab.saldo_pipj || 0)
                            const initials = colab.nome.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()

                            return (
                                <div key={colab.id} className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
                                    {/* Avatar */}
                                    <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400 shrink-0 border border-slate-200 dark:border-white/10">
                                        {initials}
                                    </div>

                                    {/* Info */}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{colab.nome}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            {colab.cargo_atual && (
                                                <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded font-medium">
                                                    {colab.cargo_atual}
                                                </span>
                                            )}
                                            {colab.nivel_consultor && (
                                                <span className="text-[10px] text-slate-400">
                                                    {colab.nivel_consultor}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Saldo + edit */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        {isEditing ? (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-sm text-slate-400 font-medium">R$</span>
                                                <Input
                                                    autoFocus
                                                    value={editValue}
                                                    onChange={e => setEditValue(e.target.value)}
                                                    onKeyDown={e => handleKeyDown(e, colab.id)}
                                                    className="h-8 w-28 text-sm text-right font-bold bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-lg"
                                                />
                                                <button
                                                    onClick={() => saveEdit(colab.id)}
                                                    disabled={saving}
                                                    className="h-7 w-7 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                                                >
                                                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                                                </button>
                                                <button
                                                    onClick={cancelEdit}
                                                    className="h-7 w-7 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/20 transition-colors"
                                                >
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <span className={`text-base font-bold tabular-nums ${saldo > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                                    R$ {saldo.toFixed(2).replace('.', ',')}
                                                </span>
                                                <button
                                                    onClick={() => startEdit(colab)}
                                                    className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                                                    title="Editar saldo"
                                                >
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                            </>
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
