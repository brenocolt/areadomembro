"use client"
import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { PlusCircle, Trash2, GripVertical, Plus, Loader2, Copy, Bold, Italic, ImagePlus, X, Heading1, Columns } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

function localDatetimeInputToIso(local: string | null | undefined): string | null {
    if (!local) return null
    const d = new Date(local)
    if (isNaN(d.getTime())) return null
    return d.toISOString()
}

interface Pergunta {
    id: string
    titulo: string
    descricao: string
    tipo: string
    opcoes: any
    obrigatoria: boolean
}

export interface FormInitialData {
    id?: string
    titulo: string
    descricao: string
    dataPrazo: string
    status?: string
    pagina_destino?: string | null
    tipo_formulario?: string
    perguntas: Pergunta[]
    banner_url?: string | null
}

const TIPOS = [
    { value: 'texto', label: 'Texto Livre' },
    { value: 'selecao_unica', label: 'Seleção Única' },
    { value: 'selecao_multipla', label: 'Seleção Múltipla' },
    { value: 'escala', label: 'Escala (1-5)' },
    { value: 'colaborador_unico', label: 'Selecionar 1 Colaborador' },
    { value: 'colaborador_multiplo', label: 'Selecionar Múltiplos Colaboradores' },
    { value: 'grade_multipla_escolha', label: 'Grade de Múltipla Escolha' },
]

interface CreateFormDialogProps {
    onSuccess?: () => void
    initialData?: FormInitialData | null
    editMode?: boolean
    open?: boolean
    onOpenChange?: (open: boolean) => void
    hideTrigger?: boolean
}

function SortableQuestion({ p, i, updatePergunta, removePergunta, duplicatePergunta, updateOpcao, addOpcao, removeOpcao, insertFormatQuestion }: any) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
    } = useSortable({ id: p.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
    };

    if (p.tipo === 'titulo') {
        return (
            <div ref={setNodeRef} style={style} className="bg-violet-100/30 dark:bg-violet-500/10 border border-violet-200 dark:border-violet-500/20 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                    <div {...attributes} {...listeners} className="cursor-grab hover:text-violet-500 text-slate-400 mt-1">
                        <GripVertical className="h-5 w-5" />
                    </div>
                    <div className="bg-violet-100 dark:bg-violet-500/20 rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-1">
                        <Heading1 className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div className="flex-1 space-y-3">
                        <Input
                            value={p.titulo}
                            onChange={(e) => updatePergunta(p.id, 'titulo', e.target.value)}
                            className="bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-xl h-10 focus-visible:ring-violet-500 font-bold text-base"
                            placeholder="Título do formulário"
                        />
                        <Input
                            value={p.descricao || ''}
                            onChange={(e) => updatePergunta(p.id, 'descricao', e.target.value)}
                            className="bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-xl h-9 focus-visible:ring-violet-500 text-sm"
                            placeholder="Subtítulo ou descrição (opcional)"
                        />
                    </div>
                    <button type="button" onClick={() => removePergunta(p.id)} className="text-slate-400 hover:text-rose-500 p-1 mt-1" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )
    }

    if (p.tipo === 'secao') {
        return (
            <div ref={setNodeRef} style={style} className="border border-dashed border-slate-300 dark:border-slate-600 rounded-2xl p-4 space-y-3">
                <div className="flex items-start gap-3">
                    <div {...attributes} {...listeners} className="cursor-grab hover:text-violet-500 text-slate-400 mt-1">
                        <GripVertical className="h-5 w-5" />
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-700 rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-1">
                        <Columns className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
                    </div>
                    <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Seção</span>
                            <div className="flex-1 h-px bg-slate-200 dark:bg-slate-700" />
                        </div>
                        <Input
                            value={p.titulo}
                            onChange={(e) => updatePergunta(p.id, 'titulo', e.target.value)}
                            className="bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-xl h-9 focus-visible:ring-violet-500 font-semibold"
                            placeholder="Nome da seção"
                        />
                        <Input
                            value={p.descricao || ''}
                            onChange={(e) => updatePergunta(p.id, 'descricao', e.target.value)}
                            className="bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-xl h-8 focus-visible:ring-violet-500 text-sm"
                            placeholder="Descrição da seção (opcional)"
                        />
                    </div>
                    <button type="button" onClick={() => removePergunta(p.id)} className="text-slate-400 hover:text-rose-500 p-1 mt-1" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        )
    }

    return (
        <div ref={setNodeRef} style={style} className="bg-violet-50/50 dark:bg-white/5 border border-violet-100 dark:border-white/10 rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
                <div {...attributes} {...listeners} className="cursor-grab hover:text-violet-500 text-slate-400 mt-1">
                    <GripVertical className="h-5 w-5" />
                </div>
                <span className="text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-500/20 rounded-full w-6 h-6 flex items-center justify-center shrink-0 mt-1">
                    {i + 1}
                </span>
                <div className="flex-1 space-y-3">
                    <div className="relative">
                        <Input
                            id={`pergunta-titulo-${p.id}`}
                            value={p.titulo}
                            onChange={(e) => updatePergunta(p.id, 'titulo', e.target.value)}
                            className="bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-xl h-10 focus-visible:ring-violet-500 pr-16"
                            placeholder="Texto da pergunta"
                        />
                        <div className="absolute right-1.5 top-1.5 flex items-center">
                            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" onClick={() => insertFormatQuestion(p.id, 'bold')} title="Negrito">
                                <Bold className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" onClick={() => insertFormatQuestion(p.id, 'italic')} title="Itálico">
                                <Italic className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
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
                                    <button type="button" onClick={() => removeOpcao(p.id, oi)} className="text-slate-400 hover:text-rose-500">
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                            <button type="button" onClick={() => addOpcao(p.id)} className="text-xs text-violet-600 dark:text-violet-400 font-bold hover:underline flex items-center gap-1">
                                <Plus className="w-3 h-3" /> Adicionar opção
                            </button>
                        </div>
                    )}

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

                    {p.tipo === 'grade_multipla_escolha' && p.opcoes && (
                        <div className="space-y-3 pl-2">
                            <div className="space-y-2">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Linhas</span>
                                {(p.opcoes.linhas || []).map((linha: string, li: number) => (
                                    <div key={li} className="flex items-center gap-2">
                                        <div className="w-3.5 h-3.5 border-2 border-slate-300 rounded" />
                                        <Input
                                            value={linha}
                                            onChange={(e) => {
                                                const novas = [...p.opcoes.linhas]
                                                novas[li] = e.target.value
                                                updatePergunta(p.id, 'opcoes', { ...p.opcoes, linhas: novas })
                                            }}
                                            className="h-8 text-xs bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg"
                                        />
                                        <button type="button" onClick={() => {
                                            const novas = p.opcoes.linhas.filter((_: string, idx: number) => idx !== li)
                                            updatePergunta(p.id, 'opcoes', { ...p.opcoes, linhas: novas })
                                        }} className="text-slate-400 hover:text-rose-500">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => {
                                    const novas = [...(p.opcoes.linhas || []), `Linha ${(p.opcoes.linhas || []).length + 1}`]
                                    updatePergunta(p.id, 'opcoes', { ...p.opcoes, linhas: novas })
                                }} className="text-xs text-violet-600 dark:text-violet-400 font-bold hover:underline flex items-center gap-1">
                                    <Plus className="w-3 h-3" /> Adicionar linha
                                </button>
                            </div>
                            <div className="space-y-2">
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Colunas</span>
                                {(p.opcoes.colunas || []).map((coluna: string, ci: number) => (
                                    <div key={ci} className="flex items-center gap-2">
                                        <div className="w-3.5 h-3.5 border-2 border-slate-300 rounded-full" />
                                        <Input
                                            value={coluna}
                                            onChange={(e) => {
                                                const novas = [...p.opcoes.colunas]
                                                novas[ci] = e.target.value
                                                updatePergunta(p.id, 'opcoes', { ...p.opcoes, colunas: novas })
                                            }}
                                            className="h-8 text-xs bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg"
                                        />
                                        <button type="button" onClick={() => {
                                            const novas = p.opcoes.colunas.filter((_: string, idx: number) => idx !== ci)
                                            updatePergunta(p.id, 'opcoes', { ...p.opcoes, colunas: novas })
                                        }} className="text-slate-400 hover:text-rose-500">
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                                <button type="button" onClick={() => {
                                    const novas = [...(p.opcoes.colunas || []), `Coluna ${(p.opcoes.colunas || []).length + 1}`]
                                    updatePergunta(p.id, 'opcoes', { ...p.opcoes, colunas: novas })
                                }} className="text-xs text-violet-600 dark:text-violet-400 font-bold hover:underline flex items-center gap-1">
                                    <Plus className="w-3 h-3" /> Adicionar coluna
                                </button>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex flex-col gap-2 mt-1">
                    <button type="button" onClick={() => duplicatePergunta(p.id)} className="text-slate-400 hover:text-violet-500 p-1" title="Duplicar">
                        <Copy className="w-4 h-4" />
                    </button>
                    <button type="button" onClick={() => removePergunta(p.id)} className="text-slate-400 hover:text-rose-500 p-1" title="Excluir">
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    )
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
    const [bannerFile, setBannerFile] = useState<File | null>(null)
    const [bannerPreview, setBannerPreview] = useState<string | null>(null)
    const [existingBannerUrl, setExistingBannerUrl] = useState<string | null>(null)
    const bannerInputRef = useRef<HTMLInputElement>(null)

    const [perguntas, setPerguntas] = useState<Pergunta[]>([
        { id: '1', titulo: '', descricao: '', tipo: 'texto', opcoes: null, obrigatoria: true }
    ])

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    useEffect(() => {
        if (initialData) {
            setTitulo(editMode ? initialData.titulo : `${initialData.titulo} (Cópia)`)
            setDescricao(initialData.descricao || "")
            setDataPrazo(initialData.dataPrazo || "")
            setStatus(initialData.status || "rascunho")
            setTipoFormulario(initialData.tipo_formulario || "formulário")
            setPaginaDestino(initialData.pagina_destino || "")
            setExistingBannerUrl(initialData.banner_url || null)
            setBannerPreview(initialData.banner_url || null)
            setBannerFile(null)
            if (initialData.perguntas.length > 0) {
                setPerguntas(initialData.perguntas.map(p => ({
                    ...p,
                    id: editMode ? p.id : Math.random().toString(),
                })))
            }
        }
    }, [initialData, editMode])

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
        setBannerFile(null)
        setBannerPreview(null)
        setExistingBannerUrl(null)
        setPerguntas([{ id: '1', titulo: '', descricao: '', tipo: 'texto', opcoes: null, obrigatoria: true }])
    }

    const handleBannerSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setBannerFile(file)
        setBannerPreview(URL.createObjectURL(file))
    }

    const removeBanner = () => {
        setBannerFile(null)
        setBannerPreview(null)
        setExistingBannerUrl(null)
        if (bannerInputRef.current) bannerInputRef.current.value = ''
    }

    const insertFormat = (format: 'bold' | 'italic') => {
        const textarea = document.getElementById('descricao-textarea') as HTMLTextAreaElement;
        if (!textarea) return;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const selectedText = descricao.substring(start, end);
        let newText = '';
        if (format === 'bold') {
            newText = `${descricao.substring(0, start)}<b>${selectedText}</b>${descricao.substring(end)}`;
        } else if (format === 'italic') {
            newText = `${descricao.substring(0, start)}<i>${selectedText}</i>${descricao.substring(end)}`;
        }
        setDescricao(newText);
        setTimeout(() => {
            textarea.focus();
            textarea.setSelectionRange(start + 3, end + 3);
        }, 0);
    }

    const insertFormatQuestion = (id: string, format: 'bold' | 'italic') => {
        const input = document.getElementById(`pergunta-titulo-${id}`) as HTMLInputElement;
        if (!input) return;
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const p = perguntas.find(x => x.id === id);
        if (!p) return;
        const text = p.titulo;
        const selectedText = text.substring(start, end);
        let newText = '';
        if (format === 'bold') {
            newText = `${text.substring(0, start)}<b>${selectedText}</b>${text.substring(end)}`;
        } else if (format === 'italic') {
            newText = `${text.substring(0, start)}<i>${selectedText}</i>${text.substring(end)}`;
        }
        updatePergunta(id, 'titulo', newText);
        setTimeout(() => {
            input.focus();
            input.setSelectionRange(start + 3, end + 3);
        }, 0);
    }

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setPerguntas((items) => {
                const oldIndex = items.findIndex((i) => i.id === active.id);
                const newIndex = items.findIndex((i) => i.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

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

    const addTitulo = () => {
        setPerguntas([...perguntas, {
            id: Math.random().toString(),
            titulo: '',
            descricao: '',
            tipo: 'titulo',
            opcoes: null,
            obrigatoria: false,
        }])
    }

    const addSecao = () => {
        setPerguntas([...perguntas, {
            id: Math.random().toString(),
            titulo: '',
            descricao: '',
            tipo: 'secao',
            opcoes: null,
            obrigatoria: false,
        }])
    }

    const duplicatePergunta = (id: string) => {
        const p = perguntas.find(x => x.id === id)
        if (!p) return
        const idx = perguntas.findIndex(x => x.id === id)
        const nova = { ...p, id: Math.random().toString() }
        const novasPerguntas = [...perguntas]
        novasPerguntas.splice(idx + 1, 0, nova)
        setPerguntas(novasPerguntas)
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
                } else if (value === 'grade_multipla_escolha') {
                    updated.opcoes = { linhas: ['Linha 1', 'Linha 2'], colunas: ['Coluna 1', 'Coluna 2', 'Coluna 3'] }
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
        const validPerguntas = perguntas.filter(p => p.tipo === 'titulo' || p.tipo === 'secao' || p.titulo.trim() !== '')
        if (validPerguntas.filter(p => p.tipo !== 'titulo' && p.tipo !== 'secao').length === 0) {
            toast.error("Adicione pelo menos uma pergunta")
            return
        }

        setLoading(true)

        let finalBannerUrl: string | null = existingBannerUrl || null

        if (bannerFile) {
            const fileName = `${Date.now()}_${bannerFile.name}`
            const { error: uploadError } = await supabase.storage.from('form-banners').upload(fileName, bannerFile, { upsert: true })
            if (uploadError) {
                toast.error("Erro ao fazer upload do banner: " + uploadError.message)
                setLoading(false)
                return
            }
            const { data: urlData } = supabase.storage.from('form-banners').getPublicUrl(fileName)
            finalBannerUrl = urlData.publicUrl
        }

        if (editMode && initialData?.id) {
            const { error: updateError } = await supabase.from('formularios').update({
                titulo,
                descricao,
                data_prazo: localDatetimeInputToIso(dataPrazo),
                tipo_formulario: tipoFormulario,
                pagina_destino: paginaDestino || null,
                banner_url: finalBannerUrl,
            }).eq('id', initialData.id)

            if (updateError) {
                toast.error("Erro ao atualizar formulário")
                setLoading(false)
                return
            }

            const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)

            const { data: existingPerguntas } = await supabase
                .from('formulario_perguntas')
                .select('id')
                .eq('formulario_id', initialData.id)
            const existingIds = new Set((existingPerguntas || []).map((p: any) => p.id))

            const keptIds: string[] = []
            for (let i = 0; i < validPerguntas.length; i++) {
                const p = validPerguntas[i]
                const payload = {
                    titulo: p.titulo,
                    descricao: p.descricao || null,
                    tipo: p.tipo,
                    opcoes: p.opcoes,
                    obrigatoria: p.obrigatoria,
                    ordem: i + 1,
                }
                if (p.id && isUuid(p.id) && existingIds.has(p.id)) {
                    const { error: upErr } = await supabase
                        .from('formulario_perguntas')
                        .update(payload)
                        .eq('id', p.id)
                    if (upErr) {
                        toast.error('Erro ao atualizar pergunta: ' + upErr.message)
                        setLoading(false)
                        return
                    }
                    keptIds.push(p.id)
                } else {
                    const { error: insErr } = await supabase
                        .from('formulario_perguntas')
                        .insert({ formulario_id: initialData.id!, ...payload })
                    if (insErr) {
                        toast.error('Erro ao criar pergunta: ' + insErr.message)
                        setLoading(false)
                        return
                    }
                }
            }

            const toDelete = Array.from(existingIds).filter(id => !keptIds.includes(id))
            if (toDelete.length > 0) {
                await supabase.from('formulario_perguntas').delete().in('id', toDelete)
            }

            toast.success("Formulário atualizado com sucesso!")
        } else {
            const { data: formData, error: formError } = await supabase.from('formularios').insert({
                titulo,
                descricao,
                status,
                data_prazo: localDatetimeInputToIso(dataPrazo),
                data_prazo_original: localDatetimeInputToIso(dataPrazo),
                data_inicio: status === 'ativo' ? new Date().toISOString() : null,
                tipo_formulario: tipoFormulario,
                pagina_destino: paginaDestino || null,
                banner_url: finalBannerUrl,
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
                    <div className="space-y-4">
                        {/* Banner upload */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Banner do Formulário (Opcional)</label>
                            <input
                                ref={bannerInputRef}
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleBannerSelect}
                            />
                            {bannerPreview ? (
                                <div className="relative rounded-xl overflow-hidden">
                                    <img src={bannerPreview} alt="Banner preview" className="w-full h-32 object-cover" />
                                    <button
                                        type="button"
                                        onClick={removeBanner}
                                        className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1 transition-colors"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            ) : (
                                <button
                                    type="button"
                                    onClick={() => bannerInputRef.current?.click()}
                                    className="w-full h-24 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-2 text-slate-400 hover:border-violet-300 dark:hover:border-violet-600 hover:text-violet-500 transition-colors"
                                >
                                    <ImagePlus className="h-6 w-6" />
                                    <span className="text-xs font-medium">Clique para adicionar uma imagem de banner</span>
                                </button>
                            )}
                        </div>

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
                            <div className="flex items-center justify-between mb-1">
                                <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Descrição</label>
                                <div className="flex items-center gap-1">
                                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => insertFormat('bold')} title="Negrito">
                                        <Bold className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => insertFormat('italic')} title="Itálico">
                                        <Italic className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                            <Textarea
                                id="descricao-textarea"
                                placeholder="Descreva o objetivo do formulário..."
                                className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl min-h-[80px] resize-none focus-visible:ring-violet-500"
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Agendar Fechamento</label>
                                <Input
                                    type="datetime-local"
                                    className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11 focus-visible:ring-violet-500"
                                    value={dataPrazo}
                                    onChange={(e) => setDataPrazo(e.target.value)}
                                />
                                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                                    No prazo, o formulário é encerrado e quem não respondeu é enviado para "Usuários Pré Pontuados" como "Não envio do {tipoFormulario || 'formulário'}".
                                </p>
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

                    <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Perguntas</label>
                        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={perguntas.map(p => p.id)} strategy={verticalListSortingStrategy}>
                                {perguntas.map((p, i) => (
                                    <SortableQuestion
                                        key={p.id}
                                        p={p}
                                        i={i}
                                        updatePergunta={updatePergunta}
                                        removePergunta={removePergunta}
                                        duplicatePergunta={duplicatePergunta}
                                        updateOpcao={updateOpcao}
                                        addOpcao={addOpcao}
                                        removeOpcao={removeOpcao}
                                        insertFormatQuestion={insertFormatQuestion}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>

                        <Button
                            variant="outline"
                            onClick={addPergunta}
                            className="w-full rounded-xl h-10 border-dashed border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 font-bold hover:bg-violet-50 dark:hover:bg-violet-900/20"
                        >
                            <Plus className="w-4 h-4 mr-2" /> Adicionar Pergunta
                        </Button>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant="outline"
                                onClick={addTitulo}
                                className="w-full rounded-xl h-9 border-dashed border-violet-100 dark:border-violet-900 text-violet-500 dark:text-violet-500 text-xs font-bold hover:bg-violet-50 dark:hover:bg-violet-900/20"
                            >
                                <Heading1 className="w-3.5 h-3.5 mr-1.5" /> Adicionar Título
                            </Button>
                            <Button
                                variant="outline"
                                onClick={addSecao}
                                className="w-full rounded-xl h-9 border-dashed border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800"
                            >
                                <Columns className="w-3.5 h-3.5 mr-1.5" /> Nova Seção
                            </Button>
                        </div>
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
