"use client"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus, AlertTriangle, Settings2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { ManagePointsTypesDialog } from "./manage-points-types-dialog"

interface PunishmentType {
    id: string
    grupo: string
    titulo: string
    pontos: number
    disponivel: boolean
}

const GRUPO_COLORS: Record<string, string> = {
    'Observação': 'text-amber-600 dark:text-amber-400',
    'Agravante': 'text-orange-600 dark:text-orange-400',
    'Alerta': 'text-rose-600 dark:text-rose-400',
}

export function AddPointsDialog() {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [colaboradores, setColaboradores] = useState<any[]>([])
    const [nucleos, setNucleos] = useState<string[]>([])
    const [motivoTypes, setMotivoTypes] = useState<PunishmentType[]>([])

    // Form state
    const [selectedNucleo, setSelectedNucleo] = useState<string>("")
    const [selectedColaboradorId, setSelectedColaboradorId] = useState<string>("")
    const [selectedMotivoId, setSelectedMotivoId] = useState<string>("")

    const selectedMotivo = motivoTypes.find(m => m.id === selectedMotivoId)

    useEffect(() => {
        if (!open) return

        async function fetchData() {
            const [colabRes, motivoRes] = await Promise.all([
                supabase.from('colaboradores').select('id, nome, nucleo_atual, cargo_atual, users!inner(id)'),
                supabase.from('pontos_motivos_punicao').select('*').eq('disponivel', true).order('pontos').order('titulo'),
            ])

            if (colabRes.data) {
                setColaboradores(colabRes.data)
                const uniqueNucleos = Array.from(new Set(colabRes.data.map(c => c.nucleo_atual))).filter(Boolean) as string[]
                setNucleos(uniqueNucleos)
            }

            if (motivoRes.data && motivoRes.data.length > 0) {
                setMotivoTypes(motivoRes.data.map((t: any) => ({
                    id: t.id,
                    grupo: t.grupo,
                    titulo: t.titulo,
                    pontos: t.pontos,
                    disponivel: t.disponivel,
                })))
            }
        }

        fetchData()
    }, [open])

    useEffect(() => { setSelectedColaboradorId("") }, [selectedNucleo])

    const filteredColaboradores = colaboradores.filter(c => c.nucleo_atual === selectedNucleo)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedColaboradorId || !selectedMotivoId || !selectedMotivo) return

        setLoading(true)
        try {
            const colab = colaboradores.find(c => c.id === selectedColaboradorId)

            const { error: insertError } = await supabase
                .from('ocorrencias')
                .insert({
                    colaborador_id: selectedColaboradorId,
                    data: new Date().toISOString(),
                    cargo_na_epoca: colab?.cargo_atual || 'Colaborador',
                    motivo: selectedMotivo.titulo,
                    descricao: `${selectedMotivo.grupo} — ${selectedMotivo.pontos} ponto${selectedMotivo.pontos > 1 ? 's' : ''}`,
                    pontuacao: selectedMotivo.pontos,
                })

            if (insertError) throw insertError

            const { data: currentData } = await supabase
                .from('colaboradores')
                .select('pontos_negativos')
                .eq('id', selectedColaboradorId)
                .single()

            const currentPoints = currentData?.pontos_negativos || 0

            await supabase
                .from('colaboradores')
                .update({ pontos_negativos: currentPoints + selectedMotivo.pontos })
                .eq('id', selectedColaboradorId)

            setOpen(false)
            setSelectedNucleo("")
            setSelectedColaboradorId("")
            setSelectedMotivoId("")

            window.dispatchEvent(new Event('refreshPointsData'))
            window.location.reload()
        } catch (error) {
            console.error(error)
            alert("Erro ao adicionar pontuação")
        } finally {
            setLoading(false)
        }
    }

    // Group motivos by grupo
    const grupos = ['Observação', 'Agravante', 'Alerta']
    const motivosByGrupo = grupos.reduce((acc, g) => {
        acc[g] = motivoTypes.filter(m => m.grupo === g)
        return acc
    }, {} as Record<string, PunishmentType[]>)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Pontuação
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[460px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <DialogHeader>
                    <DialogTitle className="text-slate-900 dark:text-white font-display text-xl flex items-center gap-2">
                        <AlertTriangle className="h-5 w-5 text-amber-500" />
                        Adicionar Pontuação de Punição
                    </DialogTitle>
                    <DialogDescription className="text-slate-500 dark:text-slate-400">
                        Lance ocorrências e pontos negativos para um colaborador.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                    <div className="space-y-4">
                        {/* Nucleo */}
                        <div className="space-y-2">
                            <Label className="text-slate-900 dark:text-slate-200">1. Núcleo</Label>
                            <Select value={selectedNucleo} onValueChange={setSelectedNucleo} required>
                                <SelectTrigger className="bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700">
                                    <SelectValue placeholder="Selecione o núcleo..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {nucleos.map(n => (
                                        <SelectItem key={n} value={n}>{n}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Colaborador */}
                        <div className="space-y-2">
                            <Label className="text-slate-900 dark:text-slate-200">2. Colaborador</Label>
                            <Select value={selectedColaboradorId} onValueChange={setSelectedColaboradorId} disabled={!selectedNucleo} required>
                                <SelectTrigger className="bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700">
                                    <SelectValue placeholder="Selecione o colaborador..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {filteredColaboradores.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Motivo (grouped dropdown) */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label className="text-slate-900 dark:text-slate-200">3. Motivo da Ocorrência</Label>
                                <ManagePointsTypesDialog
                                    trigger={
                                        <button type="button" className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-amber-500 transition-colors font-medium">
                                            <Settings2 className="h-3 w-3" />
                                            Configurar
                                        </button>
                                    }
                                />
                            </div>
                            <Select value={selectedMotivoId} onValueChange={setSelectedMotivoId} required>
                                <SelectTrigger className="bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700">
                                    <SelectValue placeholder="Selecione o motivo..." />
                                </SelectTrigger>
                                <SelectContent className="max-h-72">
                                    {grupos.map(grupo => {
                                        const items = motivosByGrupo[grupo] || []
                                        if (items.length === 0) return null
                                        const pontos = items[0]?.pontos || 0
                                        return (
                                            <div key={grupo}>
                                                <div className={`px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest ${GRUPO_COLORS[grupo]}`}>
                                                    {grupo} — {pontos} ponto{pontos > 1 ? 's' : ''}
                                                </div>
                                                {items.map(m => (
                                                    <SelectItem key={m.id} value={m.id} className="pl-4 text-sm">
                                                        {m.titulo}
                                                    </SelectItem>
                                                ))}
                                            </div>
                                        )
                                    })}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Points preview */}
                        {selectedMotivo && (
                            <div className={`flex items-center gap-3 p-3 rounded-xl border ${
                                selectedMotivo.grupo === 'Observação'
                                    ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20'
                                    : selectedMotivo.grupo === 'Agravante'
                                        ? 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/20'
                                        : 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20'
                            }`}>
                                <AlertTriangle className={`h-5 w-5 shrink-0 ${
                                    selectedMotivo.grupo === 'Observação' ? 'text-amber-500'
                                        : selectedMotivo.grupo === 'Agravante' ? 'text-orange-500'
                                            : 'text-rose-500'
                                }`} />
                                <div className="flex-1 min-w-0">
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{selectedMotivo.grupo}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 mt-0.5">{selectedMotivo.titulo}</p>
                                </div>
                                <div className="shrink-0 text-center">
                                    <div className="text-xl font-black text-slate-900 dark:text-white leading-none">
                                        +{selectedMotivo.pontos}
                                    </div>
                                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">pt{selectedMotivo.pontos > 1 ? 's' : ''}</div>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-slate-600 dark:text-slate-400">
                            Cancelar
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !selectedColaboradorId || !selectedMotivoId}
                            className="bg-primary hover:bg-primary/90 text-white"
                        >
                            {loading ? "Adicionando..." : "Confirmar Pontuação"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
