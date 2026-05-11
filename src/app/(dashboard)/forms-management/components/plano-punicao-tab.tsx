"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Search, UserX, Plus, Trash2, AlertTriangle } from "lucide-react"

export function PlanoPunicaoTab() {
    const [planos, setPlanos] = useState<any[]>([])
    const [colaboradores, setColaboradores] = useState<any[]>([])
    const [search, setSearch] = useState("")
    const [loading, setLoading] = useState(true)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [submitting, setSubmitting] = useState(false)
    const [form, setForm] = useState({
        colaborador_id: "",
        motivo: "",
        data_inicio: new Date().toISOString().slice(0, 10),
        data_fim: "",
        observacoes: "",
    })

    const fetchPlanos = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('plano_punicao')
            .select('*, colaboradores(nome, cargo_atual)')
            .eq('ativo', true)
            .order('created_at', { ascending: false })
        if (data) setPlanos(data)
        setLoading(false)
    }

    const fetchColaboradores = async () => {
        const { data } = await supabase
            .from('colaboradores')
            .select('id, nome, cargo_atual')
            .order('nome')
        if (data) setColaboradores(data)
    }

    useEffect(() => {
        fetchPlanos()
        fetchColaboradores()
    }, [])

    const handleAdd = async () => {
        if (!form.colaborador_id || !form.motivo.trim()) {
            toast.error("Selecione um colaborador e informe o motivo.")
            return
        }
        setSubmitting(true)
        const payload: any = {
            colaborador_id: form.colaborador_id,
            motivo: form.motivo.trim(),
            data_inicio: form.data_inicio,
            observacoes: form.observacoes.trim() || null,
            ativo: true,
        }
        if (form.data_fim) payload.data_fim = form.data_fim

        const { error } = await supabase.from('plano_punicao').insert(payload)
        setSubmitting(false)

        if (error) {
            toast.error("Erro ao adicionar: " + error.message)
            return
        }
        toast.success("Colaborador adicionado ao Plano de Punição.")
        setDialogOpen(false)
        setForm({
            colaborador_id: "",
            motivo: "",
            data_inicio: new Date().toISOString().slice(0, 10),
            data_fim: "",
            observacoes: "",
        })
        fetchPlanos()
    }

    const handleRemove = async (id: string, nome: string) => {
        if (!confirm(`Remover ${nome} do Plano de Punição? O colaborador voltará a receber PIPJ normalmente.`)) return
        const { error } = await supabase.from('plano_punicao').update({ ativo: false }).eq('id', id)
        if (error) {
            toast.error("Erro ao remover: " + error.message)
            return
        }
        toast.success(`${nome} removido do Plano de Punição.`)
        fetchPlanos()
    }

    const filtered = planos.filter(p =>
        (p.colaboradores?.nome || "").toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-rose-500" />
                        Plano de Punição
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">
                        Colaboradores nesta lista <strong>não recebem PIPJ</strong> enquanto estiverem ativos no plano.
                    </p>
                </div>

                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="rounded-xl h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold gap-2 shrink-0">
                            <Plus className="h-4 w-4" />
                            Adicionar ao Plano
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[500px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                        <DialogHeader>
                            <DialogTitle className="font-display text-xl">Adicionar ao Plano de Punição</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label className="font-semibold">Colaborador</Label>
                                <Select
                                    value={form.colaborador_id}
                                    onValueChange={v => setForm(f => ({ ...f, colaborador_id: v }))}
                                >
                                    <SelectTrigger className="rounded-xl dark:bg-slate-800 dark:border-slate-700">
                                        <SelectValue placeholder="Selecione o colaborador..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {colaboradores.map(c => (
                                            <SelectItem key={c.id} value={c.id}>
                                                {c.nome} — {c.cargo_atual || '—'}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="font-semibold">Motivo</Label>
                                <Input
                                    placeholder="Ex: Comportamento inadequado, baixo desempenho..."
                                    value={form.motivo}
                                    onChange={e => setForm(f => ({ ...f, motivo: e.target.value }))}
                                    className="rounded-xl dark:bg-slate-800 dark:border-slate-700"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-semibold">Data de Início</Label>
                                    <Input
                                        type="date"
                                        value={form.data_inicio}
                                        onChange={e => setForm(f => ({ ...f, data_inicio: e.target.value }))}
                                        className="rounded-xl dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-semibold">Data de Fim <span className="text-slate-400 font-normal">(opcional)</span></Label>
                                    <Input
                                        type="date"
                                        value={form.data_fim}
                                        onChange={e => setForm(f => ({ ...f, data_fim: e.target.value }))}
                                        className="rounded-xl dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label className="font-semibold">Observações <span className="text-slate-400 font-normal">(opcional)</span></Label>
                                <Textarea
                                    placeholder="Detalhes adicionais sobre o plano de punição..."
                                    value={form.observacoes}
                                    onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
                                    rows={3}
                                    className="rounded-xl resize-none dark:bg-slate-800 dark:border-slate-700"
                                />
                            </div>

                            <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl p-3">
                                <p className="text-xs text-rose-700 dark:text-rose-400 font-medium">
                                    ⚠ O colaborador será avisado na home que está em plano de punição e seu PIPJ será zerado automaticamente durante o período ativo.
                                </p>
                            </div>

                            <Button
                                onClick={handleAdd}
                                disabled={submitting}
                                className="w-full h-11 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl"
                            >
                                {submitting ? "Adicionando..." : "Adicionar ao Plano de Punição"}
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>

            {/* Search */}
            <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                    placeholder="Buscar colaborador..."
                    className="pl-9 rounded-xl bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Counter */}
            {planos.length > 0 && (
                <Badge className="bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 border-none font-bold py-1 px-3">
                    <AlertTriangle className="h-3 w-3 mr-1.5" />
                    {planos.length} colaborador{planos.length !== 1 ? 'es' : ''} em plano de punição ativo
                </Badge>
            )}

            {/* List */}
            {loading ? (
                <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-20 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-2xl" />
                    ))}
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16 text-slate-400">
                    <UserX className="h-12 w-12 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">
                        {planos.length === 0
                            ? 'Nenhum colaborador em plano de punição'
                            : 'Nenhum resultado para a busca'}
                    </p>
                    <p className="text-sm mt-1">
                        {planos.length === 0
                            ? 'Use o botão acima para adicionar.'
                            : 'Tente outro nome.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(p => (
                        <div
                            key={p.id}
                            className="bg-rose-50 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/20 rounded-2xl p-4 flex items-start justify-between gap-4"
                        >
                            <div className="flex items-start gap-3 min-w-0">
                                <div className="p-2 bg-rose-100 dark:bg-rose-500/10 rounded-xl shrink-0 mt-0.5">
                                    <AlertTriangle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-900 dark:text-white">
                                        {p.colaboradores?.nome || '—'}
                                    </p>
                                    <p className="text-xs text-slate-500">{p.colaboradores?.cargo_atual || '—'}</p>
                                    <p className="text-xs text-rose-600 dark:text-rose-400 mt-1 font-medium">
                                        {p.motivo}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                        <span className="text-[10px] text-slate-400 font-medium">
                                            Início: {new Date(p.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')}
                                        </span>
                                        {p.data_fim ? (
                                            <span className="text-[10px] text-slate-400 font-medium">
                                                Fim: {new Date(p.data_fim + 'T12:00:00').toLocaleDateString('pt-BR')}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] text-amber-500 font-medium">Sem data de fim definida</span>
                                        )}
                                        {p.observacoes && (
                                            <span className="text-[10px] text-slate-400 italic">
                                                Obs: {p.observacoes}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRemove(p.id, p.colaboradores?.nome || '?')}
                                className="h-8 px-3 text-xs font-bold text-rose-600 hover:text-rose-700 hover:bg-rose-100 dark:hover:bg-rose-500/10 rounded-lg shrink-0"
                            >
                                <Trash2 className="h-3.5 w-3.5 mr-1" />
                                Remover
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
