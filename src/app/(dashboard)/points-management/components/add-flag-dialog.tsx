"use client"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { Flag, Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"

export function AddFlagDialog({ onSuccess }: { onSuccess?: () => void }) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [colaboradores, setColaboradores] = useState<{ id: string, nome: string }[]>([])
    
    // Form state
    const [colaboradorId, setColaboradorId] = useState("")
    const [cor, setCor] = useState<"azul" | "amarela" | "vermelha">("amarela")
    const [motivo, setMotivo] = useState("")

    useEffect(() => {
        if (open && colaboradores.length === 0) {
            fetchColaboradores()
        }
    }, [open])

    async function fetchColaboradores() {
        const { data } = await supabase
            .from('colaboradores')
            .select('id, nome')
            .order('nome')
        if (data) setColaboradores(data)
    }

    const resetForm = () => {
        setColaboradorId("")
        setCor("amarela")
        setMotivo("")
    }

    const handleOpenChange = (newOpen: boolean) => {
        setOpen(newOpen)
        if (!newOpen) {
            resetForm()
        }
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!colaboradorId || !cor || !motivo) {
            toast.error("Preencha todos os campos obrigatórios")
            return
        }

        setLoading(true)
        try {
            const { data: userData } = await supabase.auth.getUser()
            
            const { error } = await supabase.from('flags').insert({
                colaborador_id: colaboradorId,
                cor: cor,
                motivo: motivo,
                criado_por: userData.user?.id
            })

            if (error) throw error

            toast.success("Flag aplicada com sucesso")
            if (onSuccess) onSuccess()
            handleOpenChange(false)
        } catch (error: any) {
            console.error("Erro ao aplicar flag:", error)
            toast.error(error.message || "Erro ao aplicar flag")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl h-11 px-6 shadow-sm flex items-center gap-2">
                    <Flag className="w-5 h-5" />
                    Aplicar Flag
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-white dark:bg-slate-900 border-slate-100 dark:border-slate-800 rounded-3xl">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-2">
                        <div className="bg-indigo-50 dark:bg-indigo-500/10 p-3 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
                            <Flag className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <DialogTitle className="text-xl font-bold dark:text-white">Aplicar Flag</DialogTitle>
                            <DialogDescription className="text-slate-500">
                                Registre uma infração grave.
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-5 mt-4">
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label className="text-slate-700 dark:text-slate-300 font-bold">Colaborador</Label>
                            <Select value={colaboradorId} onValueChange={setColaboradorId}>
                                <SelectTrigger className="w-full bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                                    <SelectValue placeholder="Selecione o colaborador" />
                                </SelectTrigger>
                                <SelectContent>
                                    {colaboradores.map(c => (
                                        <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-700 dark:text-slate-300 font-bold">Cor da Flag</Label>
                            <Select value={cor} onValueChange={(v: "azul"|"amarela"|"vermelha") => setCor(v)}>
                                <SelectTrigger className="w-full bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700">
                                    <SelectValue placeholder="Selecione a cor da flag" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="azul">
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /> Azul</div>
                                    </SelectItem>
                                    <SelectItem value="amarela">
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-yellow-500" /> Amarela</div>
                                    </SelectItem>
                                    <SelectItem value="vermelha">
                                        <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /> Vermelha</div>
                                    </SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-slate-700 dark:text-slate-300 font-bold">Motivo (Qual a infração?)</Label>
                            <Textarea 
                                required
                                value={motivo} 
                                onChange={(e) => setMotivo(e.target.value)} 
                                className="bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 resize-none h-24"
                                placeholder="Descreva os detalhes da infração..."
                            />
                        </div>
                    </div>

                    <div className="flex justify-end pt-2">
                        <Button
                            type="submit"
                            disabled={loading || !colaboradorId || !motivo}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-8 h-11 w-full font-bold shadow-sm"
                        >
                            {loading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                "Aplicar Flag"
                            )}
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    )
}
