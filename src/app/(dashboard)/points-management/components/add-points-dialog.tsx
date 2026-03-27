"use client"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Plus } from "lucide-react"
import { supabase } from "@/lib/supabase"

export function AddPointsDialog() {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [colaboradores, setColaboradores] = useState<any[]>([])
    const [nucleos, setNucleos] = useState<string[]>([])

    // Form state
    const [selectedNucleo, setSelectedNucleo] = useState<string>("")
    const [selectedColaboradorId, setSelectedColaboradorId] = useState<string>("")
    const [points, setPoints] = useState<string>("")
    const [reason, setReason] = useState<string>("")

    useEffect(() => {
        async function fetchColaboradores() {
            const { data } = await supabase.from('colaboradores').select('id, nome, nucleo_atual, cargo_atual, users!inner(id)')
            if (data) {
                setColaboradores(data)
                const uniqueNucleos = Array.from(new Set(data.map(c => c.nucleo_atual))).filter(Boolean) as string[]
                setNucleos(uniqueNucleos)
            }
        }
        if (open) {
            fetchColaboradores()
        }
    }, [open])

    // Reset when nucleo changes
    useEffect(() => {
        setSelectedColaboradorId("")
    }, [selectedNucleo])

    const filteredColaboradores = colaboradores.filter(c => c.nucleo_atual === selectedNucleo)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!selectedColaboradorId || !points || !reason) return

        setLoading(true)
        try {
            const colab = colaboradores.find(c => c.id === selectedColaboradorId)

            // First, insert occurrence
            const { error: insertError } = await supabase
                .from('ocorrencias')
                .insert({
                    colaborador_id: selectedColaboradorId,
                    data: new Date().toISOString(),
                    cargo_na_epoca: colab?.cargo_atual || 'Colaborador',
                    motivo: reason,
                    descricao: reason,
                    pontuacao: parseInt(points, 10)
                })

            if (insertError) throw insertError

            // Then update the colaborador's points
            const { data: currentData } = await supabase.from('colaboradores').select('pontos_negativos').eq('id', selectedColaboradorId).single()
            const currentPoints = currentData?.pontos_negativos || 0

            await supabase
                .from('colaboradores')
                .update({ pontos_negativos: currentPoints + parseInt(points, 10) })
                .eq('id', selectedColaboradorId)

            setOpen(false)
            // Reset state
            setSelectedNucleo("")
            setSelectedColaboradorId("")
            setPoints("")
            setReason("")

            // Allow parent to refresh or just reload page
            window.location.reload()

        } catch (error) {
            console.error(error)
            alert("Erro ao adicionar pontuação")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/25">
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Pontuação
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <DialogHeader>
                    <DialogTitle className="text-slate-900 dark:text-white font-display text-xl">Adicionar Pontuação de Punição</DialogTitle>
                    <DialogDescription className="text-slate-500 dark:text-slate-400">
                        Lance ocorrências e pontos negativos para um colaborador.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6 mt-4">
                    <div className="space-y-4">
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

                        <div className="space-y-2">
                            <Label className="text-slate-900 dark:text-slate-200">3. Quantidade de Pontos</Label>
                            <Input
                                type="number"
                                placeholder="Ex: 5"
                                min="1"
                                className="bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700"
                                value={points}
                                onChange={(e) => setPoints(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-900 dark:text-slate-200">4. Motivo da Ocorrência</Label>
                            <Textarea
                                placeholder="Descreva brevemente o motivo..."
                                className="bg-slate-50 border-slate-200 dark:bg-slate-800/50 dark:border-slate-700 resize-none h-20"
                                value={reason}
                                onChange={(e) => setReason(e.target.value)}
                                required
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="ghost" onClick={() => setOpen(false)} className="text-slate-600 dark:text-slate-400">
                            Cancelar
                        </Button>
                        <Button type="submit" disabled={loading} className="bg-primary hover:bg-primary/90 text-white">
                            {loading ? "Adicionando..." : "Confirmar Pontuação"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    )
}
