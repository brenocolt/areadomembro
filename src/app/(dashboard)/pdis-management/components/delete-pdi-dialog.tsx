"use client"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Trash2, AlertTriangle, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

interface DeletePdiDialogProps {
    pdi: any
    onSuccess?: () => void
    children?: React.ReactNode
}

export function DeletePdiDialog({ pdi, onSuccess, children }: DeletePdiDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleDelete = async () => {
        setLoading(true)
        try {
            // Delete objectives first
            const { error: tasksError } = await supabase
                .from('pdi_objetivos')
                .delete()
                .eq('plano_id', pdi.id)

            if (tasksError) throw tasksError

            // Delete plan
            const { error: planError } = await supabase
                .from('pdi_planos')
                .delete()
                .eq('id', pdi.id)

            if (planError) throw planError

            toast.success("PDI excluído com sucesso!")
            setOpen(false)
            onSuccess?.()
        } catch (error: any) {
            console.error(error)
            toast.error("Erro ao excluir PDI")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || (
                    <Button variant="ghost" size="sm" className="w-full justify-start text-slate-600 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 h-9 px-2 rounded-lg transition-colors">
                        <Trash2 className="h-4 w-4 mr-2" />
                        Excluir PDI
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px] border-slate-200 dark:border-slate-800 rounded-3xl p-8 text-center bg-white dark:bg-[#0f172a]">
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 rounded-full bg-rose-50 dark:bg-rose-500/10 flex items-center justify-center text-rose-500">
                        <AlertTriangle className="w-8 h-8" />
                    </div>
                </div>

                <DialogTitle className="text-2xl font-bold mb-2 text-center text-slate-900 dark:text-white">Excluir PDI</DialogTitle>
                <DialogDescription className="text-slate-500 font-medium mb-8 text-center dark:text-slate-400">
                    Tem certeza que deseja excluir o PDI de <span className="font-bold text-slate-900 dark:text-white">{pdi.colaborador_nome || pdi.perfis?.nome || 'colaborador'}</span>? Esta ação não pode ser desfeita e todos os dados de progresso serão perdidos.
                </DialogDescription>

                <div className="grid grid-cols-2 gap-3">
                    <Button
                        variant="ghost"
                        onClick={() => setOpen(false)}
                        className="rounded-xl font-bold h-12 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 tracking-wide order-2 sm:order-1"
                    >
                        Cancelar
                    </Button>
                    <Button
                        variant="destructive"
                        onClick={handleDelete}
                        disabled={loading}
                        className="rounded-xl font-bold h-12 bg-rose-500 hover:bg-rose-600 text-white tracking-wide order-1 sm:order-2"
                    >
                        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
