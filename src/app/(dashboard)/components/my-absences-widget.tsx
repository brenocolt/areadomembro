"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { CalendarClock, MapPin, Pencil, Loader2, Lock } from "lucide-react"
import { useColaborador } from "@/hooks/use-supabase"

interface Ausencia {
    id: string
    colaborador_id: string
    localizacao: string
    data_ida: string
    data_volta: string
    justificativa: string
    status: string
    created_at: string
}

function formatDate(dateStr: string) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR')
}

function getAusenciaState(a: Ausencia) {
    const now = new Date()
    const dataIda = new Date(a.data_ida + 'T00:00:00')
    const dataVolta = new Date(a.data_volta + 'T23:59:59')
    const jaIniciou = now >= dataIda
    const jaConcluiu = now > dataVolta
    return { jaIniciou, jaConcluiu }
}

function EditAbsenceDialog({
    ausencia,
    open,
    onOpenChange,
    onSaved,
}: {
    ausencia: Ausencia | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onSaved: () => void
}) {
    const [form, setForm] = useState({ localizacao: '', data_ida: '', data_volta: '', justificativa: '' })
    const [saving, setSaving] = useState(false)
    const [msg, setMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null)

    useEffect(() => {
        if (ausencia) {
            setForm({
                localizacao: ausencia.localizacao,
                data_ida: ausencia.data_ida,
                data_volta: ausencia.data_volta,
                justificativa: ausencia.justificativa,
            })
            setMsg(null)
        }
    }, [ausencia])

    if (!ausencia) return null

    const { jaIniciou } = getAusenciaState(ausencia)

    async function handleSave() {
        setSaving(true)
        setMsg(null)
        try {
            const res = await fetch(`/api/ausencias/${ausencia!.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    localizacao: form.localizacao,
                    data_ida: form.data_ida,
                    data_volta: form.data_volta,
                    justificativa: form.justificativa,
                }),
            })
            const json = await res.json()
            if (!res.ok) {
                setMsg({ text: json.error || 'Erro ao atualizar ausência.', type: 'error' })
                return
            }
            setMsg({ text: 'Ausência atualizada com sucesso!', type: 'success' })
            onSaved()
            setTimeout(() => onOpenChange(false), 1200)
        } catch {
            setMsg({ text: 'Erro ao atualizar ausência.', type: 'error' })
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[480px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <DialogHeader>
                    <DialogTitle className="text-xl font-display">Editar Ausência</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                        <Label htmlFor="edit-localizacao" className="font-semibold">Localização da Viagem</Label>
                        <Input
                            id="edit-localizacao"
                            value={form.localizacao}
                            onChange={(e) => setForm(f => ({ ...f, localizacao: e.target.value }))}
                            className="dark:bg-slate-800 dark:border-slate-700"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-data-ida" className="font-semibold">Data de Ida</Label>
                            <Input
                                id="edit-data-ida"
                                type="date"
                                value={form.data_ida}
                                disabled={jaIniciou}
                                onChange={(e) => setForm(f => ({ ...f, data_ida: e.target.value }))}
                                className="dark:bg-slate-800 dark:border-slate-700 disabled:opacity-60"
                            />
                            {jaIniciou && (
                                <p className="text-xs text-muted-foreground">Não é possível alterar: a ausência já começou.</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-data-volta" className="font-semibold">Data de Volta</Label>
                            <Input
                                id="edit-data-volta"
                                type="date"
                                value={form.data_volta}
                                onChange={(e) => setForm(f => ({ ...f, data_volta: e.target.value }))}
                                className="dark:bg-slate-800 dark:border-slate-700"
                            />
                        </div>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="edit-justificativa" className="font-semibold">Justificativa da Viagem</Label>
                        <Textarea
                            id="edit-justificativa"
                            rows={3}
                            value={form.justificativa}
                            onChange={(e) => setForm(f => ({ ...f, justificativa: e.target.value }))}
                            className="dark:bg-slate-800 dark:border-slate-700 resize-none"
                        />
                    </div>

                    {msg && (
                        <div className={`p-3 rounded-lg text-sm text-center border ${msg.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
                            {msg.text}
                        </div>
                    )}

                    <Button
                        onClick={handleSave}
                        disabled={saving}
                        className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-bold"
                    >
                        {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Salvar Alterações
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}

export function MyAbsencesWidget() {
    const { colaboradorId } = useColaborador()
    const [ausencias, setAusencias] = useState<Ausencia[]>([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState<Ausencia | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)

    const [refreshTick, setRefreshTick] = useState(0)

    useEffect(() => {
        if (!colaboradorId) return
        async function fetchAusencias() {
            const res = await fetch('/api/ausencias')
            if (res.ok) {
                const json = await res.json()
                setAusencias(json.ausencias || [])
            }
            setLoading(false)
        }
        fetchAusencias()
    }, [colaboradorId, refreshTick])

    function handleSaved() {
        setRefreshTick(t => t + 1)
    }

    function openEdit(a: Ausencia) {
        setEditing(a)
        setDialogOpen(true)
    }

    return (
        <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
            <CardHeader className="border-b border-slate-50 dark:border-slate-800/50 pb-4">
                <CardTitle className="text-lg font-display flex items-center gap-2">
                    <CalendarClock className="h-5 w-5" />
                    Minhas Ausências Agendadas
                </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                {loading ? (
                    <div className="space-y-3">
                        {[...Array(2)].map((_, i) => (
                            <div key={i} className="h-16 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl" />
                        ))}
                    </div>
                ) : ausencias.length === 0 ? (
                    <p className="text-sm text-slate-400 italic text-center py-8">
                        Você ainda não possui ausências agendadas.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {ausencias.map((a) => {
                            const { jaIniciou, jaConcluiu } = getAusenciaState(a)
                            const podeEditar = !jaConcluiu

                            return (
                                <div
                                    key={a.id}
                                    className="rounded-xl border border-slate-100 dark:border-slate-800 p-4 flex items-start justify-between gap-3"
                                >
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-1.5 font-semibold text-sm text-slate-900 dark:text-white">
                                            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                            <span className="truncate">{a.localizacao}</span>
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1">
                                            {formatDate(a.data_ida)} → {formatDate(a.data_volta)}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 truncate">{a.justificativa}</p>
                                        <Badge
                                            variant="outline"
                                            className={`mt-2 text-[10px] ${
                                                jaConcluiu
                                                    ? 'bg-slate-500/10 text-slate-500 border-slate-200 dark:border-slate-700'
                                                    : jaIniciou
                                                        ? 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800'
                                                        : 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800'
                                            }`}
                                        >
                                            {jaConcluiu ? 'Concluída' : jaIniciou ? 'Em andamento' : 'Agendada'}
                                        </Badge>
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="icon"
                                        className="h-8 w-8 shrink-0"
                                        disabled={!podeEditar}
                                        onClick={() => openEdit(a)}
                                        title={podeEditar ? 'Editar ausência' : 'Período já concluído, não pode ser editado'}
                                    >
                                        {podeEditar ? <Pencil className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                                    </Button>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>

            <EditAbsenceDialog
                ausencia={editing}
                open={dialogOpen}
                onOpenChange={setDialogOpen}
                onSaved={handleSaved}
            />
        </Card>
    )
}
