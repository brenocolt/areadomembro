"use client"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { PlusCircle, Trash2, GripVertical, Plus, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"

interface Pergunta {
    id: string
    titulo: string
    descricao: string
    tipo: string
    opcoes: any
    obrigatoria: boolean
}

export interface FormInitialData {
    id?: string // only for edit mode
    titulo: string
    descricao: string
    dataPrazo: string
    status?: string
    pagina_destino?: string | null
    tipo_formulario?: string
    perguntas: Pergunta[]
}

const TIPOS = [
    { value: 'texto', label: 'Texto Livre' },
    { value: 'selecao_unica', label: 'Seleção Única' },
    { value: 'selecao_multipla', label: 'Seleção Múltipla' },
    { value: 'escala', label: 'Escala (1-5)' },
    { value: 'colaborador_unico', label: 'Selecionar 1 Colaborador' },
    { value: 'colaborador_multiplo', label: 'Selecionar Múltiplos Colaboradores' },
]

interface CreateFormDialogProps {
    onSuccess?: () => void
    /** Pre-fill the form with data (copy mode) */
    initialData?: FormInitialData | null
    /** Edit an existing form instead of creating */
    editMode?: boolean
    /** Controlled open state */
    open?: boolean
    onOpenChange?: (open: boolean) => void
    /** Hide the trigger button (when controlled externally) */
    hideTrigger?: boolean
}

export function CreateFormDialog({ onSuccess, initialData, editMode, open: controlledOpen, onOpenChange, hideTrigger }: CreateFormDialogProps) {
    const [internalOpen, setInternalOpen] = useState(false)
    const open = controlledOpen ?? internalOpen
    const setOpen = onOpenChange ?? setInternalOpen

    const [loading, setLoading] = useState(false)

    const [titulo, setTitulo] = useState("")
    const [descricao, setDescricao] = useState("")
    const [dataPrazo, setDataPrazo] = useState("")
    const [status, setStatus] = useState("rascunho")
    const [tipoFormulario, setTipoFormulario] = useState("formulário")
    const [paginaDestino, setPaginaDestino] = useState("")

    const [perguntas, setPerguntas] = useState<Pergunta[]>([
        { id: '1', titulo: '', descricao: '', tipo: 'texto', opcoes: null, obrigatoria: true }
    ])

    // Populate from initialData when it changes
    useEffect(() => {
        if (initialData) {
            setTitulo(editMode ? initialData.titulo : `${initialData.titulo} (Cópia)`)
            setDescricao(initialData.descricao || "")
            setDataPrazo(initialData.dataPrazo || "")
            setStatus(initialData.status || "rascunho")
            setTipoFormulario(initialData.tipo_formulario || "formulário")
            setPaginaDestino(initialData.pagina_destino || "")
            if (initialData.perguntas.length > 0) {
                setPerguntas(initialData.perguntas.map(p => ({
                    ...p,
                    id: editMode ? p.id : Math.random().toString(),
                })))
            }
        }
    }, [initialData, editMode])

    // Reset when dialog closes
    useEffect(() => {
        if (!open && !initialData) {
            resetForm()
        }
    }, [open])

    const resetForm = () => {
        setTitulo("")
        setDescricao("")
        setDataPrazo("")
        setStatus("rascunho")
        setTipoFormulario("formulário")
        setPaginaDestino("")
        setPerguntas([{ id: '1', titulo: '', descricao: '', tipo: 'texto', opcoes: null, obrigatoria: true }])
    }

    const addPergunta = () => {
        setPerguntas([...perguntas, {
            id: Math.random().toString(),
            titulo: '',
            descricao: '',
            tipo: 'texto',
            opcoes: null,
            obrigatoria: true,
        }])
    }

    const removePergunta = (id: string) => {
        setPerguntas(perguntas.filter(p => p.id !== id))
    }

    const updatePergunta = (id: string, field: string, value: any) => {
        setPerguntas(perguntas.map(p => {
            if (p.id !== id) return p
            const updated = { ...p, [field]: value }
            if (field === 'tipo') {
                if (value === 'selecao_unica' || value === 'selecao_multipla') {
                    updated.opcoes = updated.opcoes && Array.isArray(updated.opcoes) ? updated.opcoes : ["Opção 1", "Opção 2"]
                } else if (value === 'escala') {
                    updated.opcoes = updated.opcoes?.min ? updated.opcoes : { min: 1, max: 5, labelMin: "Muito Insatisfeito", labelMax: "Muito Satisfeito" }
                } else {
                    updated.opcoes = null
                }
            }
            return updated
        }))
    }

    const updateOpcao = (perguntaId: string, index: number, value: string) => {
        setPerguntas(perguntas.map(p => {
            if (p.id !== perguntaId || !Array.isArray(p.opcoes)) return p
            const newOpcoes = [...p.opcoes]
            newOpcoes[index] = value
            return { ...p, opcoes: newOpcoes }
        }))
    }

    const addOpcao = (perguntaId: string) => {
        setPerguntas(perguntas.map(p => {
            if (p.id !== perguntaId || !Array.isArray(p.opcoes)) return p
            return { ...p, opcoes: [...p.opcoes, `Opção ${p.opcoes.length + 1}`] }
        }))
    }

    const removeOpcao = (perguntaId: string, index: number) => {
        setPerguntas(perguntas.map(p => {
            if (p.id !== perguntaId || !Array.isArray(p.opcoes)) return p
            return { ...p, opcoes: p.opcoes.filter((_: any, i: number) => i !== index) }
        }))
    }

    const handleSubmit = async () => {
        if (!titulo) {
            toast.error("Informe o título do formulário")
            return
        }
        const validPerguntas = perguntas.filter(p => p.titulo.trim() !== '')
        if (validPerguntas.length === 0) {
            toast.error("Adicione pelo menos uma pergunta")
            return
        }

        setLoading(true)
        if (editMode && initialData?.id) {
            // UPDATE existing form
            const { error: updateError } = await supabase.from('formularios').update({
                titulo,
                descricao,
                data_prazo: dataPrazo ? new Date(dataPrazo).toISOString() : null,
                tipo_formulario: tipoFormulario,
                pagina_destino: paginaDestino || null,
            }).eq('id', initialData.id)

            if (updateError) {
                toast.error("Erro ao atualizar formulário")
                setLoading(false)
                return
            }

            // Delete old questions and insert new ones
            await supabase.from('formulario_perguntas').delete().eq('formulario_id', initialData.id)

            const perguntasToInsert = validPerguntas.map((p, i) => ({
                formulario_id: initialData.id!,
                titulo: p.titulo,
                descricao: p.descricao || null,
                tipo: p.tipo,
                opcoes: p.opcoes,
                obrigatoria: p.obrigatoria,
                ordem: i + 1,
            }))

            await supabase.from('formulario_perguntas').insert(perguntasToInsert)
            toast.success("Formulário atualizado com sucesso!")
        } else {
            // CREATE new form (or copy)
            const { data: formData, error: formError } = await supabase.from('formularios').insert({
                titulo,
                descricao,
                status,
                data_prazo: dataPrazo ? new Date(dataPrazo).toISOString() : null,
                data_prazo_original: dataPrazo ? new Date(dataPrazo).toISOString() : null,
                data_inicio: status === 'ativo' ? new Date().toISOString() : null,
                tipo_formulario: tipoFormulario,
                pagina_destino: paginaDestino || null,
            }).select().single()

            if (formError || !formData) {
                toast.error("Erro ao criar formulário")
                setLoading(false)
                return
            }

            const perguntasToInsert = validPerguntas.map((p, i) => ({
                formulario_id: formData.id,
                titulo: p.titulo,
                descricao: p.descricao || null,
                tipo: p.tipo,
                opcoes: p.opcoes,
                obrigatoria: p.obrigatoria,
                ordem: i + 1,
            }))

            await supabase.from('formulario_perguntas').insert(perguntasToInsert)
            toast.success("Formulário criado com sucesso!")
        }

        setLoading(false)
        setOpen(false)
        resetForm()
        onSuccess?.()
    }

    const dialogTitle = editMode ? "Editar Formulário" : (initialData ? "Copiar Formulário" : "Novo Formulário")
    const dialogDesc = editMode ? "Edite os dados e perguntas do formulário." : "Monte as perguntas do seu formulário."
    const submitLabel = editMode ? "Salvar Alterações" : "Criar Formulário"
    const submitLoadingLabel = editMode ? "Salvando..." : "Criando..."

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            {!hideTrigger && (
                <DialogTrigger asChild>
                    <Button className="bg-violet-600 hover:bg-violet-700 text-white rounded-xl h-10 px-4 flex items-center gap-2">
                        <PlusCircle className="h-4 w-4" />
                        Criar Formulário
                    </Button>
                </DialogTrigger>
            )}
            <DialogContent className="sm:max-w-[700px] bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-3xl p-0 overflow-hidden text-slate-900 dark:text-white">
                <div className="px-8 pt-8 pb-4">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">{dialogTitle}</DialogTitle>
                        <DialogDescription className="text-slate-500 font-medium">
                            {dialogDesc}
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-8 pb-4 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {/* Form metadata */}
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Título</label>
                            <Input
                                placeholder="Ex: Torre de Controle - Março 2026"
                                className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11 focus-visible:ring-violet-500"
                                value={titulo}
                                onChange={(e) => setTitulo(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Descrição</label>
                            <Textarea
                                placeholder="Descreva o objetivo do formulário..."
                                className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl min-h-[80px] resize-none focus-visible:ring-violet-500"
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Prazo</label>
                                <Input
                                    type="date"
                                    className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11 focus-visible:ring-violet-500"
                                    value={dataPrazo}
                                    onChange={(e) => setDataPrazo(e.target.value)}
                                />
                            </div>
                            {!editMode && (
                                <div className="space-y-2">
                                    <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Status Inicial</label>
                                    <Select value={status} onValueChange={setStatus}>
                                        <SelectTrigger className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-xl">
                                            <SelectItem value="rascunho">Rascunho</SelectItem>
                                            <SelectItem value="ativo">Ativo (publicar já)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>

                        {/* Tipo do formulário e Página de Destino */}
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Tipo do Formulário</label>
                                <Input
                                    placeholder="Ex: NPS, Pesquisa, Feedback"
                                    className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11 focus-visible:ring-violet-500"
                                    value={tipoFormulario}
                                    onChange={(e) => setTipoFormulario(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Página de Destino (Opcional)</label>
                                <Input
                                    placeholder="Ex: https://google.com"
                                    className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11 focus-visible:ring-violet-500"
                                    value={paginaDestino}
                                    onChange={(e) => setPaginaDestino(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Questions builder */}
                    <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Perguntas</label>

                        {perguntas.map((p, i) => (
                            <div key={p.id} className="bg-violet-50/50 dark:bg-white/5 border border-violet-100 dark:border-white/10 rounded-2xl p-4 space-y-3">
                                <div className="flex items-start gap-3">
                                    <span className="text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-500/20 rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-1">
                                        {i + 1}
                                    </span>
                                    <div className="flex-1 space-y-3">
                                        <Input
                                            value={p.titulo}
                                            onChange={(e) => updatePergunta(p.id, 'titulo', e.target.value)}
                                            className="bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-xl h-10 focus-visible:ring-violet-500"
                                            placeholder="Texto da pergunta"
                                        />
                                        <div className="grid grid-cols-2 gap-3">
                                            <Select value={p.tipo} onValueChange={(v) => updatePergunta(p.id, 'tipo', v)}>
                                                <SelectTrigger className="bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-xl h-9 text-xs">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-xl">
                                                    {TIPOS.map(t => (
                                                        <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <div className="flex items-center gap-2">
                                                <Switch
                                                    checked={p.obrigatoria}
                                                    onCheckedChange={(v) => updatePergunta(p.id, 'obrigatoria', v)}
                                                />
                                                <span className="text-xs text-slate-500">Obrigatória</span>
                                            </div>
                                        </div>

                                        {/* Options for selecao_unica / selecao_multipla */}
                                        {(p.tipo === 'selecao_unica' || p.tipo === 'selecao_multipla') && Array.isArray(p.opcoes) && (
                                            <div className="space-y-2 pl-2">
                                                {p.opcoes.map((opt: string, oi: number) => (
                                                    <div key={oi} className="flex items-center gap-2">
                                                        <div className={`w-3.5 h-3.5 border-2 border-slate-300 ${p.tipo === 'selecao_unica' ? 'rounded-full' : 'rounded'}`} />
                                                        <Input
                                                            value={opt}
                                                            onChange={(e) => updateOpcao(p.id, oi, e.target.value)}
                                                            className="h-8 text-xs bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg"
                                                        />
                                                        <button onClick={() => removeOpcao(p.id, oi)} className="text-slate-400 hover:text-rose-500">
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                                <button onClick={() => addOpcao(p.id)} className="text-xs text-violet-600 dark:text-violet-400 font-bold hover:underline flex items-center gap-1">
                                                    <Plus className="w-3 h-3" /> Adicionar opção
                                                </button>
                                            </div>
                                        )}

                                        {/* Scale labels */}
                                        {p.tipo === 'escala' && p.opcoes && (
                                            <div className="grid grid-cols-2 gap-2">
                                                <Input
                                                    value={p.opcoes.labelMin || ''}
                                                    onChange={(e) => updatePergunta(p.id, 'opcoes', { ...p.opcoes, labelMin: e.target.value })}
                                                    className="h-8 text-xs bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg"
                                                    placeholder="Label 1 (ex: Muito Insatisfeito)"
                                                />
                                                <Input
                                                    value={p.opcoes.labelMax || ''}
                                                    onChange={(e) => updatePergunta(p.id, 'opcoes', { ...p.opcoes, labelMax: e.target.value })}
                                                    className="h-8 text-xs bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg"
                                                    placeholder="Label 5 (ex: Muito Satisfeito)"
                                                />
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => removePergunta(p.id)} className="text-slate-400 hover:text-rose-500 p-1 mt-1">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        <Button
                            variant="outline"
                            onClick={addPergunta}
                            className="w-full rounded-xl h-10 border-dashed border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 font-bold hover:bg-violet-50 dark:hover:bg-violet-900/20"
                        >
                            <Plus className="w-4 h-4 mr-2" /> Adicionar Pergunta
                        </Button>
                    </div>
                </div>

                <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-black/10">
                    <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl font-bold h-11 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800">
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading} className="rounded-xl font-bold h-11 px-8 bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {loading ? submitLoadingLabel : submitLabel}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
