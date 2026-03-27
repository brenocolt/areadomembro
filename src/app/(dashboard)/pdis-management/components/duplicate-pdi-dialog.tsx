"use client"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Copy, Loader2, Search, Users } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

interface DuplicatePdiDialogProps {
    pdi: any
    onSuccess?: () => void
    children?: React.ReactNode
}

export function DuplicatePdiDialog({ pdi, onSuccess, children }: DuplicatePdiDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [colaboradores, setColaboradores] = useState<any[]>([])
    const [selectedIds, setSelectedIds] = useState<string[]>([])
    const [search, setSearch] = useState("")

    useEffect(() => {
        async function fetchColaboradores() {
            const { data } = await supabase
                .from('colaboradores')
                .select('id, nome, cargo_atual, email_corporativo')
                .order('nome')

            if (data) {
                // Exclude the original collaborator
                setColaboradores(data.filter(c => c.id !== pdi.colaboradores?.id))
            }
        }
        if (open) {
            fetchColaboradores()
            setSelectedIds([])
            setSearch("")
        }
    }, [open, pdi])

    const toggleColaborador = (id: string) => {
        setSelectedIds(prev =>
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        )
    }

    const filteredColaboradores = colaboradores.filter(c =>
        c.nome?.toLowerCase().includes(search.toLowerCase()) ||
        c.cargo_atual?.toLowerCase().includes(search.toLowerCase())
    )

    const handleDuplicate = async () => {
        if (selectedIds.length === 0) {
            toast.error("Selecione ao menos um colaborador.")
            return
        }
        setLoading(true)
        try {
            // Fetch the original plan's full details
            const { data: originalPlan } = await supabase
                .from('pdi_planos')
                .select('*')
                .eq('id', pdi.id)
                .single()

            if (!originalPlan) throw new Error("Plano original não encontrado")

            // Fetch original tasks
            const { data: originalTasks } = await supabase
                .from('pdi_tarefas')
                .select('*')
                .eq('plano_id', pdi.id)

            // Create one plan for each selected collaborator
            for (const colabId of selectedIds) {
                const { data: newPlan, error: planError } = await supabase
                    .from('pdi_planos')
                    .insert({
                        colaborador_id: colabId,
                        titulo: originalPlan.titulo,
                        descricao: originalPlan.descricao,
                        data_inicio: new Date().toISOString(),
                        data_prazo: originalPlan.data_prazo,
                        status: 'Em Dia',
                        progresso: 0
                    })
                    .select()
                    .single()

                if (planError) throw planError

                if (originalTasks && originalTasks.length > 0 && newPlan) {
                    const newTasks = originalTasks.map(t => ({
                        plano_id: newPlan.id,
                        titulo: t.titulo,
                        descricao: t.descricao,
                        tipo: t.tipo,
                        status: 'Não Iniciada',
                        anexos: t.anexos,
                        observacoes: t.observacoes
                    }))
                    await supabase.from('pdi_tarefas').insert(newTasks)
                }
            }

            toast.success(`PDI duplicado para ${selectedIds.length} colaborador${selectedIds.length > 1 ? 'es' : ''}!`)
            setOpen(false)
            onSuccess?.()
        } catch (error: any) {
            console.error(error)
            toast.error("Erro ao duplicar PDI")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || (
                    <Button variant="ghost" size="sm">
                        <Copy className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-3xl p-0 overflow-hidden text-slate-900 dark:text-white">
                <div className="px-8 pt-8 pb-4">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                            <Copy className="w-5 h-5 text-cyan-500" />
                            Duplicar PDI
                        </DialogTitle>
                        <DialogDescription className="text-slate-500 font-medium">
                            Selecione os colaboradores para receber uma cópia deste PDI.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-8 pb-4 space-y-4 max-h-[50vh] overflow-y-auto custom-scrollbar">
                    {/* Original PDI info */}
                    <div className="bg-cyan-50/50 dark:bg-white/5 border border-cyan-100 dark:border-white/10 rounded-2xl p-4">
                        <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">PDI Original</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white">
                            {pdi.titulo || `PDI de ${pdi.colaboradores?.nome}`}
                        </p>
                        <p className="text-xs text-cyan-600 dark:text-cyan-400 mt-0.5">
                            {pdi.colaboradores?.nome} · {pdi.colaboradores?.cargo_atual}
                        </p>
                    </div>

                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Buscar colaborador..."
                            className="pl-9 bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-10 text-sm focus-visible:ring-cyan-500"
                        />
                    </div>

                    {/* Collaborator list */}
                    <div className="space-y-1">
                        {filteredColaboradores.map(c => {
                            const initials = (c.nome || '??').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
                            const isSelected = selectedIds.includes(c.id)
                            return (
                                <button
                                    key={c.id}
                                    onClick={() => toggleColaborador(c.id)}
                                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left ${
                                        isSelected
                                            ? 'bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800'
                                            : 'hover:bg-slate-50 dark:hover:bg-white/5 border border-transparent'
                                    }`}
                                >
                                    <Checkbox
                                        checked={isSelected}
                                        className="border-slate-300 dark:border-slate-600 data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600"
                                    />
                                    <Avatar className="h-8 w-8 border border-slate-100 dark:border-white/10">
                                        <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(c.nome || '')}&background=random`} />
                                        <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold">
                                            {initials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate capitalize-first">{c.nome?.toLowerCase()}</p>
                                        <p className="text-xs text-slate-500 truncate">{c.cargo_atual || 'Sem cargo'}</p>
                                    </div>
                                </button>
                            )
                        })}
                        {filteredColaboradores.length === 0 && (
                            <p className="text-center text-sm text-slate-400 py-8">Nenhum colaborador encontrado.</p>
                        )}
                    </div>
                </div>

                <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-black/10">
                    <p className="text-xs text-slate-500 font-medium">
                        {selectedIds.length > 0 ? (
                            <span className="flex items-center gap-1">
                                <Users className="w-3.5 h-3.5" />
                                {selectedIds.length} selecionado{selectedIds.length > 1 ? 's' : ''}
                            </span>
                        ) : 'Nenhum selecionado'}
                    </p>
                    <div className="flex gap-3">
                        <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl font-bold h-11 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 tracking-wide">
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleDuplicate}
                            disabled={loading || selectedIds.length === 0}
                            className="rounded-xl font-bold h-11 px-8 bg-cyan-600 hover:bg-cyan-700 text-white tracking-wide shadow-lg shadow-cyan-500/20 disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Copy className="h-4 w-4 mr-2" />}
                            {loading ? "Duplicando..." : "Duplicar PDI"}
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
