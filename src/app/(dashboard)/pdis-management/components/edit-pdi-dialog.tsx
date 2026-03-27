"use client"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Pencil, Trash2, BookOpen, PlayCircle, CheckSquare, Plus, Loader2, Paperclip } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { normalizeUrl } from "@/lib/utils/normalize-url"
import { toast } from "sonner"

interface EditPdiDialogProps {
    pdi: any
    onSuccess?: () => void
    children?: React.ReactNode
}

export function EditPdiDialog({ pdi, onSuccess, children }: EditPdiDialogProps) {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [colaboradores, setColaboradores] = useState<any[]>([])

    // Form state
    const [colaboradorId, setColaboradorId] = useState(pdi.colaborador_id)
    const [titulo, setTitulo] = useState(pdi.titulo)
    const [descricao, setDescricao] = useState(pdi.descricao || "")
    const [observacaoInterna, setObservacaoInterna] = useState(pdi.observacao_interna || "")
    const [dataInicio, setDataInicio] = useState(pdi.data_inicio ? pdi.data_inicio.split('T')[0] : "")
    const [dataPrazo, setDataPrazo] = useState(pdi.data_prazo ? pdi.data_prazo.split('T')[0] : "")

    // Atividades state
    const [atividades, setAtividades] = useState<any[]>([])
    const [uploadingId, setUploadingId] = useState<string | null>(null)

    useEffect(() => {
        async function fetchColaboradores() {
            const { data } = await supabase.from('colaboradores').select('id, nome')
            if (data) setColaboradores(data)
        }
        
        async function fetchAtividades() {
            const { data } = await supabase
                .from('pdi_tarefas')
                .select('*')
                .eq('plano_id', pdi.id)
            
            if (data) {
                setAtividades(data.map(task => {
                    const links: string[] = []
                    const arquivos: { url: string; nome: string }[] = []
                    if (task.anexos && Array.isArray(task.anexos)) {
                        task.anexos.forEach((a: any) => {
                            if (a.tipo === 'link') links.push(a.url || '')
                            if (a.tipo === 'arquivo') arquivos.push({ url: a.url || '', nome: a.nome || 'Arquivo' })
                        })
                    }
                    if (links.length === 0) links.push('')
                    return {
                        id: task.id,
                        titulo: task.titulo,
                        descricao: task.descricao,
                        tipo: task.tipo,
                        links,
                        arquivos,
                        isExisting: true
                    }
                }))
            }
        }

        if (open) {
            // Re-sync form state from pdi prop every time dialog opens
            setColaboradorId(pdi.colaborador_id)
            setTitulo(pdi.titulo)
            setDescricao(pdi.descricao || "")
            setObservacaoInterna(pdi.observacao_interna || "")
            setDataInicio(pdi.data_inicio ? pdi.data_inicio.split('T')[0] : "")
            setDataPrazo(pdi.data_prazo ? pdi.data_prazo.split('T')[0] : "")

            fetchColaboradores()
            fetchAtividades()
        }
    }, [open, pdi.id])

    const handleAddAtividade = (tipo: string) => {
        let desc = 'Nova Atividade'
        let title = ''
        if (tipo === 'video') { desc = 'Curso Online'; title = 'Novo Treinamento' }
        if (tipo === 'leitura') { desc = 'Material de Estudo'; title = 'Nova Leitura' }
        if (tipo === 'atividade') { desc = 'Atividade Prática'; title = 'Nova Atividade' }

        setAtividades([...atividades, {
            id: Math.random().toString(),
            titulo: title,
            descricao: desc,
            tipo,
            links: [''],
            arquivos: [],
            isExisting: false
        }])
    }

    const handleFileUpload = async (atividadeId: string, file: File) => {
        setUploadingId(atividadeId)
        const ext = file.name.split('.').pop()
        const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { data, error } = await supabase.storage.from('pdi-anexos').upload(path, file)
        if (error) {
            console.error('Upload error:', error)
            toast.error('Erro ao fazer upload do arquivo.')
            setUploadingId(null)
            return
        }
        const { data: urlData } = supabase.storage.from('pdi-anexos').getPublicUrl(path)
        setAtividades(prev => prev.map(a => a.id === atividadeId ? { ...a, arquivos: [...a.arquivos, { url: urlData.publicUrl, nome: file.name }] } : a))
        setUploadingId(null)
    }

    const handleRemoveAtividade = (id: string) => {
        setAtividades(atividades.filter(a => a.id !== id))
    }

    const updateAtividade = (id: string, field: string, value: any) => {
        setAtividades(atividades.map(a => a.id === id ? { ...a, [field]: value } : a))
    }

    const handleSubmit = async () => {
        if (!colaboradorId || !titulo || !dataPrazo) {
            toast.error('Preencha os campos obrigatórios (Colaborador, Título e Prazo).')
            return
        }

        setLoading(true)

        try {
            // Update the PDI plan
            const { error: planError } = await supabase
                .from('pdi_planos')
                .update({
                    colaborador_id: colaboradorId,
                    titulo,
                    descricao,
                    observacao_interna: observacaoInterna || null,
                    data_inicio: dataInicio ? new Date(dataInicio).toISOString() : pdi.data_inicio,
                    data_prazo: new Date(dataPrazo).toISOString(),
                })
                .eq('id', pdi.id)

            if (planError) throw planError

            // Manage tasks
            // For simplicity in this edit, we'll delete existing tasks and re-insert 
            // OR we can do a more complex sync. Let's do delete and re-insert for reliability in this POC.
            
            const { error: deleteError } = await supabase
                .from('pdi_tarefas')
                .delete()
                .eq('plano_id', pdi.id)

            if (deleteError) throw deleteError

            if (atividades.length > 0) {
                const tasksToInsert = atividades.map(a => {
                    const anexos: any[] = []
                    a.links.forEach((link: string) => {
                        if (link && link.trim() !== '') {
                            anexos.push({ nome: 'Acessar Anexo', url: link.trim(), tipo: 'link' })
                        }
                    })
                    a.arquivos.forEach((arq: any) => {
                        if (arq.url) {
                            anexos.push({ nome: arq.nome || 'Arquivo', url: arq.url, tipo: 'arquivo' })
                        }
                    })
                    return {
                        plano_id: pdi.id,
                        titulo: a.titulo,
                        descricao: a.descricao,
                        tipo: a.tipo,
                        status: 'Não Iniciada',
                        anexos
                    }
                })

                await supabase.from('pdi_tarefas').insert(tasksToInsert)
            }

            toast.success("PDI atualizado com sucesso!")
            setOpen(false)
            onSuccess?.()
        } catch (error: any) {
            console.error(error)
            toast.error('Erro ao atualizar PDI')
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || (
                    <Button variant="ghost" size="sm" className="text-slate-600 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-500/10 h-8 px-2">
                        <Pencil className="h-4 w-4" />
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-3xl p-0 overflow-hidden text-slate-900 dark:text-white">
                <div className="px-8 pt-8 pb-4">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">Editar PDI</DialogTitle>
                        <DialogDescription className="text-slate-500 font-medium">
                            Atualize as informações do plano de desenvolvimento.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-8 pb-4 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Colaborador</label>
                        <Select value={colaboradorId} onValueChange={setColaboradorId}>
                            <SelectTrigger className="w-full bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11 focus:ring-cyan-500">
                                <SelectValue placeholder="Selecione o colaborador" />
                            </SelectTrigger>
                            <SelectContent className="bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-xl">
                                {colaboradores.map(c => (
                                    <SelectItem key={c.id} value={c.id} className="cursor-pointer">{c.nome}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Título do Plano</label>
                        <Input
                            placeholder="Ex: Desenvolvimento de Liderança Técnica"
                            className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11 focus-visible:ring-cyan-500"
                            value={titulo}
                            onChange={(e) => setTitulo(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Descrição</label>
                        <Textarea
                            placeholder="Quais são os principais objetivos deste plano?"
                            className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl min-h-[100px] resize-none focus-visible:ring-cyan-500"
                            value={descricao}
                            onChange={(e) => setDescricao(e.target.value)}
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                            Observação Interna
                            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-0.5 rounded-full">Gestão</span>
                        </label>
                        <Textarea
                            placeholder="Anotações internas visíveis apenas para a gestão..."
                            className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl min-h-[80px] resize-none focus-visible:ring-cyan-500 text-sm"
                            value={observacaoInterna}
                            onChange={(e) => setObservacaoInterna(e.target.value)}
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Data de Início</label>
                            <Input
                                type="date"
                                className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11 w-full pl-3 pr-10 focus-visible:ring-cyan-500"
                                value={dataInicio}
                                onChange={(e) => setDataInicio(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Prazo Final</label>
                            <Input
                                type="date"
                                className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11 w-full pl-3 pr-10 focus-visible:ring-cyan-500"
                                value={dataPrazo}
                                onChange={(e) => setDataPrazo(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Módulos e Atividades</label>

                        <div className="space-y-3">
                            {atividades.map((a, i) => (
                                <div key={a.id} className="bg-cyan-50/50 dark:bg-white/5 border border-cyan-100 dark:border-white/10 rounded-2xl p-4 flex gap-4 items-center group relative">
                                    <div className="shrink-0 text-cyan-600 dark:text-cyan-400">
                                        {a.tipo === 'video' && <PlayCircle className="w-5 h-5" />}
                                        {a.tipo === 'leitura' && <BookOpen className="w-5 h-5" />}
                                        {a.tipo === 'atividade' && <CheckSquare className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1 space-y-2 py-1">
                                        <Input
                                            value={a.titulo}
                                            onChange={(e) => updateAtividade(a.id, 'titulo', e.target.value)}
                                            className="h-7 text-sm font-bold bg-transparent border-transparent hover:border-slate-200 focus-visible:border-cyan-500 focus-visible:ring-0 p-0 px-2 -ml-2 text-slate-900 dark:text-white"
                                            placeholder="Título da Atividade"
                                        />
                                        <p className="text-xs text-slate-500">{a.descricao}</p>
                                        
                                        {/* Multiple links */}
                                        <div className="space-y-1">
                                            {(a.links || ['']).map((link: string, li: number) => (
                                                <div key={li} className="flex items-center gap-1">
                                                    <Input
                                                        value={link}
                                                        onChange={(e) => {
                                                            const newLinks = [...(a.links || [''])]
                                                            newLinks[li] = e.target.value
                                                            updateAtividade(a.id, 'links', newLinks)
                                                        }}
                                                        className="h-7 text-xs bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-300 w-full"
                                                        placeholder="🔗 Link do anexo (Opcional)"
                                                    />
                                                    {(a.links || []).length > 1 && (
                                                        <button onClick={() => { const nl = (a.links || []).filter((_: any, idx: number) => idx !== li); updateAtividade(a.id, 'links', nl) }} className="text-slate-400 hover:text-rose-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                                                    )}
                                                </div>
                                            ))}
                                            <button onClick={() => updateAtividade(a.id, 'links', [...(a.links || ['']), ''])} className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar link</button>
                                        </div>

                                        {/* Multiple files */}
                                        <div className="space-y-1">
                                            {(a.arquivos || []).map((arq: any, fi: number) => (
                                                <div key={fi} className="flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400">
                                                    <Paperclip className="w-3 h-3" />
                                                    <a href={normalizeUrl(arq.url)} target="_blank" rel="noreferrer" className="hover:underline truncate">{arq.nome}</a>
                                                    <button onClick={() => { const na = (a.arquivos || []).filter((_: any, idx: number) => idx !== fi); updateAtividade(a.id, 'arquivos', na) }} className="text-slate-400 hover:text-rose-500 p-0.5 ml-1"><Trash2 className="w-3 h-3" /></button>
                                                </div>
                                            ))}
                                            <label className="flex items-center gap-1.5 text-xs text-cyan-600 dark:text-cyan-400 cursor-pointer hover:underline">
                                                {uploadingId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                                                Anexar arquivo
                                                <input
                                                    type="file"
                                                    className="hidden"
                                                    disabled={uploadingId === a.id}
                                                    onChange={(e) => {
                                                        const file = e.target.files?.[0]
                                                        if (file) handleFileUpload(a.id, file)
                                                    }}
                                                />
                                            </label>
                                        </div>
                                    </div>
                                    <button onClick={() => handleRemoveAtividade(a.id)} className="text-slate-400 hover:text-rose-500 transition-colors p-2 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 pt-2 flex-wrap">
                            <Button
                                variant="outline"
                                onClick={() => handleAddAtividade('video')}
                                className="rounded-full h-8 px-4 text-xs font-bold text-cyan-600 border-cyan-200 hover:bg-cyan-50 dark:bg-transparent dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-900/30"
                            >
                                <Plus className="w-3 h-3 mr-1" /> Treinamento
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => handleAddAtividade('leitura')}
                                className="rounded-full h-8 px-4 text-xs font-bold text-cyan-600 border-cyan-200 hover:bg-cyan-50 dark:bg-transparent dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-900/30"
                            >
                                <Plus className="w-3 h-3 mr-1" /> Material
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => handleAddAtividade('atividade')}
                                className="rounded-full h-8 px-4 text-xs font-bold text-cyan-600 border-cyan-200 hover:bg-cyan-50 dark:bg-transparent dark:border-cyan-800 dark:text-cyan-400 dark:hover:bg-cyan-900/30"
                            >
                                <Plus className="w-3 h-3 mr-1" /> Atividade
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-black/10">
                    <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl font-bold h-11 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800 tracking-wide">
                        Cancelar
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading} className="rounded-xl font-bold h-11 px-8 bg-cyan-600 hover:bg-cyan-700 text-white tracking-wide shadow-lg shadow-cyan-500/20">
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : "Salvar Alterações"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
