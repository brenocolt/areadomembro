"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle
} from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase"
import { CARGO_FANTASMA } from "@/lib/cargos"
import { OCULTOS_SALDOS_EQUIPE } from "@/lib/pipj-oculto"
import { toast } from "sonner"
import { useSession } from "next-auth/react"
import { Search, Wallet, Pencil, Loader2, Plus, Minus } from "lucide-react"

interface ColabSaldo {
    id: string
    nome: string
    cargo_atual: string
    nivel_consultor: string
    saldo_pipj: number
    status?: string
}

export function PipjSaldos() {
    const { data: session } = useSession()
    const [colabs, setColabs] = useState<ColabSaldo[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [editingColab, setEditingColab] = useState<ColabSaldo | null>(null)
    const [tipoAjuste, setTipoAjuste] = useState<'ADICAO' | 'DEDUCAO'>('ADICAO')
    const [valorAjuste, setValorAjuste] = useState("")
    const [motivoAjuste, setMotivoAjuste] = useState("")
    const [saving, setSaving] = useState(false)

    const fetchData = useCallback(async () => {
        setLoading(true)
        const { data } = await supabase
            .from('colaboradores')
            .select('id, nome, cargo_atual, nivel_consultor, saldo_pipj, status')
            .eq('status', 'Ativo')
            .neq('cargo_atual', CARGO_FANTASMA)
            .order('nome', { ascending: true })
        if (data) setColabs((data as ColabSaldo[]).filter(c => !OCULTOS_SALDOS_EQUIPE.includes(c.id)))
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

    const openEdit = (colab: ColabSaldo) => {
        setEditingColab(colab)
        setTipoAjuste('ADICAO')
        setValorAjuste("")
        setMotivoAjuste("")
    }

    const closeEdit = () => {
        setEditingColab(null)
        setValorAjuste("")
        setMotivoAjuste("")
    }

    const confirmarAjuste = async () => {
        if (!editingColab) return
        const valor = parseFloat(valorAjuste.replace(',', '.'))
        if (isNaN(valor) || valor <= 0) {
            toast.error('Informe um valor válido, maior que zero.')
            return
        }
        if (!motivoAjuste.trim()) {
            toast.error('Informe o motivo do ajuste.')
            return
        }

        setSaving(true)
        const saldoAtual = Number(editingColab.saldo_pipj || 0)
        const delta = tipoAjuste === 'ADICAO' ? valor : -valor
        const novoSaldo = saldoAtual + delta
        const editorName = (session?.user as any)?.name || (session?.user as any)?.email || 'Sistema'

        const { error } = await supabase
            .from('colaboradores')
            .update({ saldo_pipj: novoSaldo })
            .eq('id', editingColab.id)

        if (error) {
            toast.error('Erro ao salvar.')
        } else {
            await supabase.from('transacoes_pipj').insert({
                colaborador_id: editingColab.id,
                tipo: tipoAjuste === 'ADICAO' ? 'ENTRADA' : 'SAIDA',
                valor,
                descricao: `Ajuste manual de saldo: ${motivoAjuste.trim()}`,
                status: 'CREDITADO',
                data: new Date().toISOString(),
                realizado_por: editorName,
            })
            setColabs(prev => prev.map(c => c.id === editingColab.id ? { ...c, saldo_pipj: novoSaldo } : c))
            toast.success('Saldo ajustado!')
            window.dispatchEvent(new Event('refreshPipjData'))
            closeEdit()
        }

        setSaving(false)
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
                                        <span className={`text-base font-bold tabular-nums ${saldo > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                                            R$ {saldo.toFixed(2).replace('.', ',')}
                                        </span>
                                        <button
                                            onClick={() => openEdit(colab)}
                                            className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-300 dark:text-slate-600 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 opacity-0 group-hover:opacity-100 transition-all"
                                            title="Editar saldo"
                                        >
                                            <Pencil className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>

            <Dialog open={!!editingColab} onOpenChange={(open) => { if (!open) closeEdit() }}>
                <DialogContent className="sm:max-w-[440px]">
                    <DialogHeader>
                        <DialogTitle className="font-display text-xl">Ajustar Saldo PIPJ</DialogTitle>
                        <DialogDescription>
                            {editingColab && (
                                <>
                                    {editingColab.nome} · Saldo atual: <strong>R$ {Number(editingColab.saldo_pipj || 0).toFixed(2).replace('.', ',')}</strong>
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-2">
                        <div className="space-y-2">
                            <Label>Tipo de ajuste</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setTipoAjuste('ADICAO')}
                                    className={`flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-bold border transition-colors ${tipoAjuste === 'ADICAO'
                                        ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/40 text-emerald-700 dark:text-emerald-400'
                                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                                        }`}
                                >
                                    <Plus className="h-4 w-4" /> Adição
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setTipoAjuste('DEDUCAO')}
                                    className={`flex items-center justify-center gap-1.5 h-10 rounded-xl text-sm font-bold border transition-colors ${tipoAjuste === 'DEDUCAO'
                                        ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-400'
                                        : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500'
                                        }`}
                                >
                                    <Minus className="h-4 w-4" /> Dedução
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="valor-ajuste">Valor (R$)</Label>
                            <Input
                                id="valor-ajuste"
                                type="number"
                                min="0.01"
                                step="0.01"
                                placeholder="0,00"
                                value={valorAjuste}
                                onChange={e => setValorAjuste(e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="motivo-ajuste">Motivo</Label>
                            <Textarea
                                id="motivo-ajuste"
                                placeholder="Descreva o motivo do ajuste..."
                                value={motivoAjuste}
                                onChange={e => setMotivoAjuste(e.target.value)}
                                className="resize-none"
                                rows={3}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="ghost" onClick={closeEdit} disabled={saving}>Cancelar</Button>
                        <Button onClick={confirmarAjuste} disabled={saving} className="bg-primary hover:bg-primary/90">
                            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Confirmar Ajuste
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
