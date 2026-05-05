"use client"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Settings2, Plus, Pencil, Trash2, Check, X, Loader2, ShieldCheck } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

interface RemovalType {
    id: string
    groupLabel: string
    title: string
    dbValue: string
    points: number
    disponivel: boolean
}

// Default removal types from the request-removal-dialog.tsx
const DEFAULT_REMOVAL_TYPES: RemovalType[] = [
    // Group 1: 1 point
    { id: '1', groupLabel: 'DESENVOLVIMENTO', title: 'Curso com certificado', dbValue: 'Fazer um curso que agregue a sua formação e a Produtiva, com certificado', points: 1, disponivel: true },
    { id: '2', groupLabel: 'DESENVOLVIMENTO', title: 'Treinamento interno', dbValue: 'Dar treinamento interno para Produtiva (Turbinar, Calcificar, PTPJ, Take Off, entre outros)', points: 1, disponivel: true },
    { id: '3', groupLabel: 'DESENVOLVIMENTO', title: 'Participar de um bench', dbValue: 'Participar de um bench', points: 1, disponivel: true },
    { id: '4', groupLabel: 'DESENVOLVIMENTO', title: 'Indicar lead quente', dbValue: 'Indicar um lead quente que seja convertido em reunião de proposta', points: 1, disponivel: true },
    { id: '5', groupLabel: 'DESENVOLVIMENTO', title: 'Participação de GT', dbValue: 'Participação de GT (Grupo de Trabalho)', points: 1, disponivel: true },
    // Group 2: 2 points
    { id: '6', groupLabel: 'CRESCIMENTO', title: 'Treinamento outra EJ', dbValue: 'Dar treinamento para outra EJ', points: 2, disponivel: true },
    { id: '7', groupLabel: 'CRESCIMENTO', title: 'Consultoria externa', dbValue: 'Dar treinamento em consultoria/assessoria desde que esse não esteja previsto em cronograma', points: 2, disponivel: true },
    { id: '8', groupLabel: 'CRESCIMENTO', title: 'CSAT 5 ou NPS 10', dbValue: 'Obter CSAT 5 ou NPS 10 em uma consultoria/assessoria', points: 2, disponivel: true },
    { id: '9', groupLabel: 'CRESCIMENTO', title: 'Fidelizar projeto', dbValue: 'Fidelizar projeto que o membro faça parte da equipe de consultoria', points: 2, disponivel: true },
    { id: '10', groupLabel: 'CRESCIMENTO', title: 'Finalizar edital', dbValue: 'Finalizar a participação em edital (PSC, PSGP, Edital de Coordenadorias do PTPJ Edital de Diretoria)', points: 2, disponivel: true },
    { id: '11', groupLabel: 'CRESCIMENTO', title: 'Finalizar PDI no prazo', dbValue: 'Finalizar um PDI no prazo', points: 2, disponivel: true },
    { id: '12', groupLabel: 'CRESCIMENTO', title: 'Concretização parcerias', dbValue: 'Auxiliar na concretização de parcerias em conjunto com o núcleo da presidência', points: 2, disponivel: true },
    // Group 3: 3 points
    { id: '13', groupLabel: 'FORTALECIMENTO', title: 'Escrever um case', dbValue: 'Escrever um case (mesmo que não tenha sido montado um edital, para ficar no banco de dados)', points: 3, disponivel: true },
    { id: '14', groupLabel: 'FORTALECIMENTO', title: 'Projeto de melhoria', dbValue: 'Desenvolver e finalizar um projeto de melhoria/iniciativa interna juntamente a algum dos núcleos', points: 3, disponivel: true },
]

export function ManageRemovalTypesDialog() {
    const [open, setOpen] = useState(false)
    const [types, setTypes] = useState<RemovalType[]>([])
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editTitle, setEditTitle] = useState("")
    const [editPoints, setEditPoints] = useState("")

    // New type state
    const [showAddNew, setShowAddNew] = useState(false)
    const [newTitle, setNewTitle] = useState("")
    const [newDbValue, setNewDbValue] = useState("")
    const [newPoints, setNewPoints] = useState("")
    const [newGroup, setNewGroup] = useState("DESENVOLVIMENTO")

    useEffect(() => {
        if (open) {
            loadTypes()
        }
    }, [open])

    const loadTypes = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('pontos_tipos_remocao')
            .select('*')
            .order('pontos', { ascending: true })

        if (data && data.length > 0) {
            setTypes(data.map((t: any) => ({
                id: t.id,
                groupLabel: t.grupo,
                title: t.titulo,
                dbValue: t.db_value,
                points: t.pontos,
                disponivel: t.disponivel ?? true
            })))
        } else {
            // Use defaults if table doesn't exist yet
            setTypes(DEFAULT_REMOVAL_TYPES)
        }
        setLoading(false)
    }

    const handleToggleAvailability = async (type: RemovalType) => {
        const newDisponivel = !type.disponivel
        setTypes(prev => prev.map(t => t.id === type.id ? { ...t, disponivel: newDisponivel } : t))

        await supabase
            .from('pontos_tipos_remocao')
            .update({ disponivel: newDisponivel })
            .eq('id', type.id)
    }

    const startEdit = (type: RemovalType) => {
        setEditingId(type.id)
        setEditTitle(type.title)
        setEditPoints(type.points.toString())
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditTitle("")
        setEditPoints("")
    }

    const saveEdit = async () => {
        if (!editTitle || !editPoints) return
        const pointsNum = parseInt(editPoints)
        if (isNaN(pointsNum) || pointsNum <= 0) {
            toast.error('Quantidade de pontos inválida.')
            return
        }

        setTypes(prev => prev.map(t => t.id === editingId ? { ...t, title: editTitle, points: pointsNum } : t))

        await supabase
            .from('pontos_tipos_remocao')
            .update({ titulo: editTitle, pontos: pointsNum })
            .eq('id', editingId)

        setEditingId(null)
        toast.success('Tipo de remoção atualizado!')
    }

    const handleAddType = async () => {
        if (!newTitle || !newPoints || !newDbValue) {
            toast.error('Preencha todos os campos.')
            return
        }
        const pointsNum = parseInt(newPoints)
        if (isNaN(pointsNum) || pointsNum <= 0) {
            toast.error('Quantidade de pontos inválida.')
            return
        }

        const newType: RemovalType = {
            id: Math.random().toString(36).slice(2),
            groupLabel: newGroup,
            title: newTitle,
            dbValue: newDbValue,
            points: pointsNum,
            disponivel: true,
        }

        const { data } = await supabase
            .from('pontos_tipos_remocao')
            .insert({ grupo: newGroup, titulo: newTitle, db_value: newDbValue, pontos: pointsNum, disponivel: true })
            .select()
            .single()

        if (data) {
            newType.id = data.id
        }

        setTypes(prev => [...prev, newType].sort((a, b) => a.points - b.points))
        setNewTitle("")
        setNewDbValue("")
        setNewPoints("")
        setNewGroup("DESENVOLVIMENTO")
        setShowAddNew(false)
        toast.success('Tipo de remoção adicionado!')
    }

    const handleDeleteType = async (type: RemovalType) => {
        setTypes(prev => prev.filter(t => t.id !== type.id))

        await supabase
            .from('pontos_tipos_remocao')
            .delete()
            .eq('id', type.id)

        toast.success('Tipo de remoção removido!')
    }

    const groupColor: Record<string, string> = {
        'DESENVOLVIMENTO': 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400',
        'CRESCIMENTO': 'bg-cyan-50 text-cyan-600 dark:bg-cyan-500/10 dark:text-cyan-400',
        'FORTALECIMENTO': 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400',
    }

    const groups = ['DESENVOLVIMENTO', 'CRESCIMENTO', 'FORTALECIMENTO']

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-sky-500 hover:bg-sky-600 text-white shadow-lg shadow-sky-500/25">
                    <Settings2 className="mr-2 h-4 w-4" />
                    Gerenciar Tipos de Remoção
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-3xl p-0 overflow-hidden text-slate-900 dark:text-white">
                <div className="px-6 pt-6 pb-4">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <div className="bg-sky-50 dark:bg-sky-500/10 p-2 rounded-xl border border-sky-100 dark:border-sky-500/20">
                                <ShieldCheck className="h-5 w-5 text-sky-600 dark:text-sky-400" />
                            </div>
                            Gerenciar Tipos de Remoção de Pontos
                        </DialogTitle>
                    </DialogHeader>
                </div>

                <div className="px-6 pb-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {groups.map(group => {
                                const groupTypes = types.filter(t => t.groupLabel === group)
                                if (groupTypes.length === 0) return null

                                const pointsLabel = group === 'DESENVOLVIMENTO' ? '1 PONTO' : group === 'CRESCIMENTO' ? '2 PONTOS' : '3 PONTOS'

                                return (
                                    <div key={group} className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                                {group} — RETIRADA DE {pointsLabel}
                                            </h4>
                                        </div>

                                        {groupTypes.map(type => (
                                            <div key={type.id} className={`flex items-center gap-3 p-3 rounded-xl transition-all ${!type.disponivel ? 'opacity-50 bg-slate-50 dark:bg-white/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                                                {editingId === type.id ? (
                                                    <>
                                                        <div className="flex-1">
                                                            <Input
                                                                value={editTitle}
                                                                onChange={(e) => setEditTitle(e.target.value)}
                                                                className="h-8 text-sm bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg"
                                                            />
                                                        </div>
                                                        <Input
                                                            type="number"
                                                            value={editPoints}
                                                            onChange={(e) => setEditPoints(e.target.value)}
                                                            className="h-8 text-sm text-center bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg w-20"
                                                        />
                                                        <div className="flex gap-1">
                                                            <button onClick={saveEdit} className="h-7 w-7 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20">
                                                                <Check className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button onClick={cancelEdit} className="h-7 w-7 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/20">
                                                                <X className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate block">{type.title}</span>
                                                        </div>
                                                        <Badge variant="outline" className={`text-[10px] border-0 font-bold shrink-0 ${groupColor[type.groupLabel] || 'bg-slate-100 text-slate-600'}`}>
                                                            {type.points} {type.points === 1 ? 'pt' : 'pts'}
                                                        </Badge>
                                                        <Badge
                                                            variant="outline"
                                                            className={`text-[10px] border-0 cursor-pointer select-none shrink-0 ${type.disponivel
                                                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                                                : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400'
                                                            }`}
                                                            onClick={() => handleToggleAvailability(type)}
                                                        >
                                                            {type.disponivel ? 'Ativo' : 'Inativo'}
                                                        </Badge>
                                                        <div className="flex gap-1 shrink-0">
                                                            <button onClick={() => startEdit(type)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-sky-600 hover:bg-sky-50 dark:hover:bg-sky-500/10">
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button onClick={() => handleDeleteType(type)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                                                                <Trash2 className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )
                            })}

                            {/* Add New Type */}
                            {showAddNew ? (
                                <div className="border border-sky-200 dark:border-sky-500/20 bg-sky-50/50 dark:bg-sky-500/5 rounded-2xl p-4 space-y-3">
                                    <p className="text-xs font-bold text-sky-600 dark:text-sky-400 uppercase tracking-wider">Novo Tipo de Remoção</p>
                                    <div className="space-y-3">
                                        <Input
                                            placeholder="Título (ex: Participar de evento)"
                                            value={newTitle}
                                            onChange={(e) => setNewTitle(e.target.value)}
                                            className="h-9 text-sm bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg"
                                        />
                                        <Input
                                            placeholder="Descrição para o banco de dados..."
                                            value={newDbValue}
                                            onChange={(e) => setNewDbValue(e.target.value)}
                                            className="h-9 text-sm bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg"
                                        />
                                        <div className="grid grid-cols-2 gap-3">
                                            <select
                                                value={newGroup}
                                                onChange={(e) => setNewGroup(e.target.value)}
                                                className="h-9 text-sm bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-slate-800 dark:text-slate-200"
                                            >
                                                <option value="DESENVOLVIMENTO">Desenvolvimento (1 pt)</option>
                                                <option value="CRESCIMENTO">Crescimento (2 pts)</option>
                                                <option value="FORTALECIMENTO">Fortalecimento (3 pts)</option>
                                            </select>
                                            <Input
                                                type="number"
                                                placeholder="Pontos"
                                                value={newPoints}
                                                onChange={(e) => setNewPoints(e.target.value)}
                                                className="h-9 text-sm bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg"
                                            />
                                        </div>
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <Button variant="ghost" size="sm" onClick={() => { setShowAddNew(false); setNewTitle(""); setNewDbValue(""); setNewPoints("") }} className="h-8 text-slate-500 rounded-lg">
                                            Cancelar
                                        </Button>
                                        <Button size="sm" onClick={handleAddType} className="h-8 bg-sky-600 hover:bg-sky-700 text-white rounded-lg px-4">
                                            <Plus className="h-3.5 w-3.5 mr-1" />
                                            Adicionar
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowAddNew(true)}
                                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10 text-slate-500 hover:border-sky-300 hover:text-sky-600 dark:hover:border-sky-500/30 dark:hover:text-sky-400 transition-colors"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span className="text-sm font-medium">Adicionar Novo Tipo de Remoção</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-black/10">
                    <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl font-bold h-10 text-slate-700 dark:text-slate-300">
                        Fechar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
