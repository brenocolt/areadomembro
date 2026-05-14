"use client"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Settings2, Plus, Pencil, Trash2, Check, X, Loader2, AlertTriangle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

interface PunishmentType {
    id: string
    grupo: string
    titulo: string
    pontos: number
    disponivel: boolean
}

const GRUPOS = ['Observação', 'Agravante', 'Alerta']
const GRUPO_PONTOS: Record<string, number> = { 'Observação': 1, 'Agravante': 2, 'Alerta': 3 }

const GRUPO_COLORS: Record<string, string> = {
    'Observação': 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    'Agravante': 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-400',
    'Alerta': 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
}

const DEFAULT_TYPES: PunishmentType[] = [
    { id: '1', grupo: 'Observação', titulo: 'Responder fora do prazo os formulários obrigatórios enviados a toda empresa', pontos: 1, disponivel: true },
    { id: '2', grupo: 'Observação', titulo: 'Chegar atrasado em Reunião Geral, de Diretoria, de Núcleo, eventos internos ou treinamentos obrigatórios sem justificativa plausível', pontos: 1, disponivel: true },
    { id: '3', grupo: 'Observação', titulo: 'Sair mais cedo de reuniões sem justificativa plausível', pontos: 1, disponivel: true },
    { id: '4', grupo: 'Observação', titulo: 'Atraso em evento MEJ sem justificativa plausível', pontos: 1, disponivel: true },
    { id: '5', grupo: 'Agravante', titulo: 'Não responder os formulários obrigatórios enviados a toda empresa', pontos: 2, disponivel: true },
    { id: '6', grupo: 'Agravante', titulo: 'Faltar Reunião de Diretoria', pontos: 2, disponivel: true },
    { id: '7', grupo: 'Agravante', titulo: 'Faltar Reunião de Núcleo', pontos: 2, disponivel: true },
    { id: '8', grupo: 'Agravante', titulo: 'Faltar Reunião Geral sem justificativa plausível', pontos: 2, disponivel: true },
    { id: '9', grupo: 'Agravante', titulo: 'Faltar Treinamento obrigatório', pontos: 2, disponivel: true },
    { id: '10', grupo: 'Agravante', titulo: 'Faltar reuniões internas de alinhamento/construção, sejam para projetos externos ou internos', pontos: 2, disponivel: true },
    { id: '11', grupo: 'Agravante', titulo: 'Não seguir a boa postura frente ao cliente', pontos: 2, disponivel: true },
    { id: '12', grupo: 'Agravante', titulo: 'Chegar atrasado em Assembleia Geral Extraordinária', pontos: 2, disponivel: true },
    { id: '13', grupo: 'Agravante', titulo: 'Chegar atrasado em Assembleia Geral Ordinária', pontos: 2, disponivel: true },
    { id: '14', grupo: 'Agravante', titulo: 'Chegar atrasado em reunião com cliente', pontos: 2, disponivel: true },
    { id: '15', grupo: 'Agravante', titulo: 'Faltar eventos internos da empresa sem justificativa plausível (Voa PJ, Aniversário, Conexão)', pontos: 2, disponivel: true },
    { id: '16', grupo: 'Alerta', titulo: 'Faltar Elaboração/Revisão de Planejamento Estratégico sem justificativa plausível', pontos: 3, disponivel: true },
    { id: '17', grupo: 'Alerta', titulo: 'Faltar Assembleia Geral Extraordinária sem justificativa plausível', pontos: 3, disponivel: true },
    { id: '18', grupo: 'Alerta', titulo: 'Faltar Assembleia Geral Ordinária sem justificativa plausível', pontos: 3, disponivel: true },
    { id: '19', grupo: 'Alerta', titulo: 'Faltar reunião do Conselho da RN Júnior sem justificativa plausível', pontos: 3, disponivel: true },
    { id: '20', grupo: 'Alerta', titulo: 'Faltar reunião com cliente sem justificativa plausível', pontos: 3, disponivel: true },
    { id: '21', grupo: 'Alerta', titulo: 'NPS menor que 7 ou CSAT menor que 3', pontos: 3, disponivel: true },
    { id: '22', grupo: 'Alerta', titulo: 'Faltar eventos MEJ sem justificativa plausível', pontos: 3, disponivel: true },
    { id: '23', grupo: 'Alerta', titulo: 'Má conduta em eventos', pontos: 3, disponivel: true },
]

export function ManagePointsTypesDialog({ trigger }: { trigger?: React.ReactNode }) {
    const [open, setOpen] = useState(false)
    const [types, setTypes] = useState<PunishmentType[]>([])
    const [loading, setLoading] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editTitulo, setEditTitulo] = useState("")
    const [editGrupo, setEditGrupo] = useState("Observação")

    const [showAddNew, setShowAddNew] = useState(false)
    const [newTitulo, setNewTitulo] = useState("")
    const [newGrupo, setNewGrupo] = useState("Observação")

    useEffect(() => {
        if (open) loadTypes()
    }, [open])

    const loadTypes = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('pontos_motivos_punicao')
            .select('*')
            .order('pontos', { ascending: true })
            .order('titulo', { ascending: true })

        if (data && data.length > 0) {
            setTypes(data.map((t: any) => ({
                id: t.id,
                grupo: t.grupo,
                titulo: t.titulo,
                pontos: t.pontos,
                disponivel: t.disponivel ?? true,
            })))
        } else {
            setTypes(DEFAULT_TYPES)
        }
        setLoading(false)
    }

    const handleToggle = async (type: PunishmentType) => {
        const newVal = !type.disponivel
        setTypes(prev => prev.map(t => t.id === type.id ? { ...t, disponivel: newVal } : t))
        await supabase.from('pontos_motivos_punicao').update({ disponivel: newVal }).eq('id', type.id)
    }

    const startEdit = (type: PunishmentType) => {
        setEditingId(type.id)
        setEditTitulo(type.titulo)
        setEditGrupo(type.grupo)
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditTitulo("")
        setEditGrupo("Observação")
    }

    const saveEdit = async () => {
        if (!editTitulo.trim()) return
        const pontos = GRUPO_PONTOS[editGrupo] || 1
        setTypes(prev => prev.map(t => t.id === editingId ? { ...t, titulo: editTitulo, grupo: editGrupo, pontos } : t))
        await supabase.from('pontos_motivos_punicao').update({ titulo: editTitulo, grupo: editGrupo, pontos }).eq('id', editingId)
        setEditingId(null)
        toast.success('Motivo atualizado!')
    }

    const handleAdd = async () => {
        if (!newTitulo.trim()) {
            toast.error('Preencha o título do motivo.')
            return
        }
        const pontos = GRUPO_PONTOS[newGrupo] || 1
        const { data } = await supabase
            .from('pontos_motivos_punicao')
            .insert({ grupo: newGrupo, titulo: newTitulo, pontos, disponivel: true })
            .select()
            .single()

        if (data) {
            setTypes(prev => [...prev, { id: data.id, grupo: data.grupo, titulo: data.titulo, pontos: data.pontos, disponivel: true }]
                .sort((a, b) => a.pontos - b.pontos || a.titulo.localeCompare(b.titulo)))
        }
        setNewTitulo("")
        setNewGrupo("Observação")
        setShowAddNew(false)
        toast.success('Motivo adicionado!')
    }

    const handleDelete = async (type: PunishmentType) => {
        setTypes(prev => prev.filter(t => t.id !== type.id))
        await supabase.from('pontos_motivos_punicao').delete().eq('id', type.id)
        toast.success('Motivo removido!')
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {trigger ?? (
                    <Button className="bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/25">
                        <Settings2 className="mr-2 h-4 w-4" />
                        Configurar Motivos
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[680px] bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-3xl p-0 overflow-hidden text-slate-900 dark:text-white">
                <div className="px-6 pt-6 pb-4 border-b border-slate-100 dark:border-white/10">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <div className="bg-amber-50 dark:bg-amber-500/10 p-2 rounded-xl border border-amber-100 dark:border-amber-500/20">
                                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                            </div>
                            Configurar Motivos de Pontuação
                        </DialogTitle>
                        <p className="text-sm text-slate-500 mt-1">Gerencie os motivos disponíveis ao adicionar pontuações negativas.</p>
                    </DialogHeader>
                </div>

                <div className="px-6 py-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {GRUPOS.map(grupo => {
                                const groupTypes = types.filter(t => t.grupo === grupo)
                                const pontos = GRUPO_PONTOS[grupo]
                                return (
                                    <div key={grupo} className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-widest ${GRUPO_COLORS[grupo]}`}>
                                                {grupo} — {pontos} PONTO{pontos > 1 ? 'S' : ''}
                                            </span>
                                        </div>

                                        {groupTypes.length === 0 && (
                                            <p className="text-xs text-slate-400 italic pl-2">Nenhum motivo neste grupo.</p>
                                        )}

                                        {groupTypes.map(type => (
                                            <div key={type.id} className={`flex items-start gap-3 p-3 rounded-xl transition-all ${!type.disponivel ? 'opacity-50 bg-slate-50 dark:bg-white/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                                                {editingId === type.id ? (
                                                    <>
                                                        <div className="flex-1 space-y-2">
                                                            <Input
                                                                value={editTitulo}
                                                                onChange={(e) => setEditTitulo(e.target.value)}
                                                                className="h-8 text-sm bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg"
                                                            />
                                                            <select
                                                                value={editGrupo}
                                                                onChange={(e) => setEditGrupo(e.target.value)}
                                                                className="h-8 text-xs bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-lg px-2 text-slate-700 dark:text-slate-300 w-full"
                                                            >
                                                                {GRUPOS.map(g => (
                                                                    <option key={g} value={g}>{g} ({GRUPO_PONTOS[g]} pt{GRUPO_PONTOS[g] > 1 ? 's' : ''})</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                        <div className="flex gap-1 shrink-0 mt-1">
                                                            <button onClick={saveEdit} className="h-7 w-7 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100">
                                                                <Check className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button onClick={cancelEdit} className="h-7 w-7 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 hover:bg-slate-200">
                                                                <X className="h-3.5 w-3.5" />
                                                            </button>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="flex-1 min-w-0">
                                                            <span className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed">{type.titulo}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1 shrink-0">
                                                            <Badge
                                                                variant="outline"
                                                                className={`text-[10px] border-0 cursor-pointer select-none ${type.disponivel
                                                                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                                                    : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400'
                                                                }`}
                                                                onClick={() => handleToggle(type)}
                                                            >
                                                                {type.disponivel ? 'Ativo' : 'Inativo'}
                                                            </Badge>
                                                            <button onClick={() => startEdit(type)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-500/10">
                                                                <Pencil className="h-3.5 w-3.5" />
                                                            </button>
                                                            <button onClick={() => handleDelete(type)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
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

                            {/* Add New */}
                            {showAddNew ? (
                                <div className="border border-amber-200 dark:border-amber-500/20 bg-amber-50/50 dark:bg-amber-500/5 rounded-2xl p-4 space-y-3">
                                    <p className="text-xs font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Novo Motivo</p>
                                    <select
                                        value={newGrupo}
                                        onChange={(e) => setNewGrupo(e.target.value)}
                                        className="w-full h-9 text-sm bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-lg px-3 text-slate-800 dark:text-slate-200"
                                    >
                                        {GRUPOS.map(g => (
                                            <option key={g} value={g}>{g} ({GRUPO_PONTOS[g]} ponto{GRUPO_PONTOS[g] > 1 ? 's' : ''})</option>
                                        ))}
                                    </select>
                                    <Input
                                        placeholder="Descrição do motivo..."
                                        value={newTitulo}
                                        onChange={(e) => setNewTitulo(e.target.value)}
                                        className="h-9 text-sm bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg"
                                    />
                                    <div className="flex gap-2 justify-end">
                                        <Button variant="ghost" size="sm" onClick={() => { setShowAddNew(false); setNewTitulo("") }} className="h-8 text-slate-500 rounded-lg">
                                            Cancelar
                                        </Button>
                                        <Button size="sm" onClick={handleAdd} className="h-8 bg-amber-600 hover:bg-amber-700 text-white rounded-lg px-4">
                                            <Plus className="h-3.5 w-3.5 mr-1" />
                                            Adicionar
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowAddNew(true)}
                                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10 text-slate-500 hover:border-amber-300 hover:text-amber-600 dark:hover:border-amber-500/30 dark:hover:text-amber-400 transition-colors"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span className="text-sm font-medium">Adicionar Novo Motivo</span>
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
