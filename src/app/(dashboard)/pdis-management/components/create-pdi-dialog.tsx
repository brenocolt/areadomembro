"use client"
import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PlusCircle, Trash2, CalendarIcon, BookOpen, PlayCircle, CheckSquare, Plus, Paperclip, Loader2 } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { normalizeUrl } from "@/lib/utils/normalize-url"
import { format } from "date-fns"

export function CreatePdiDialog() {
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [colaboradores, setColaboradores] = useState<any[]>([])

    // Form state
    const [colaboradorId, setColaboradorId] = useState("")
    const [titulo, setTitulo] = useState("")
    const [descricao, setDescricao] = useState("")
    const [observacaoInterna, setObservacaoInterna] = useState("")
    const [dataInicio, setDataInicio] = useState("")
    const [dataPrazo, setDataPrazo] = useState("")

    // Atividades state
    const [atividades, setAtividades] = useState<{ id: string, titulo: string, descricao: string, tipo: string, links: string[], arquivos: { url: string, nome: string }[] }[]>([
        { id: '1', titulo: 'Treinamento de Gestão Ágil', descricao: 'Curso Online', tipo: 'video', links: [''], arquivos: [] },
        { id: '2', titulo: 'Leitura: "Extreme Programming Explained"', descricao: 'Material de Estudo', tipo: 'leitura', links: [''], arquivos: [] }
    ])
    const [uploadingId, setUploadingId] = useState<string | null>(null)

    useEffect(() => {
        async function fetchColaboradores() {
            const { data } = await supabase.from('colaboradores').select('id, nome')
            if (data) setColaboradores(data)
        }
        if (open) {
            fetchColaboradores()
        }
    }, [open])

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
            arquivos: []
        }])
    }

    const handleFileUpload = async (atividadeId: string, file: File) => {
        setUploadingId(atividadeId)
        const ext = file.name.split('.').pop()
        const path = `${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
        const { data, error } = await supabase.storage.from('pdi-anexos').upload(path, file)
        if (error) {
            console.error('Upload error:', error)
            alert('Erro ao fazer upload do arquivo.')
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
            alert('Preencha os campos obrigatórios (Colaborador, Título e Prazo).')
            return
        }

        setLoading(true)

        const { data: planData, error: planError } = await supabase.from('pdi_planos').insert({
            colaborador_id: colaboradorId,
            titulo,
            descricao,
            observacao_interna: observacaoInterna || null,
            data_inicio: dataInicio ? new Date(dataInicio).toISOString() : new Date().toISOString(),
            data_prazo: new Date(dataPrazo).toISOString(),
            status: 'Em Dia',
            progresso: 0
        }).select().single()

        if (planError) {
            console.error(planError)
            alert('Erro ao criar plano')
            setLoading(false)
            return
        }

        if (atividades.length > 0 && planData) {
            const tasksToInsert = atividades.map(a => {
                const anexos: any[] = []
                a.links.forEach(link => {
                    if (link && link.trim() !== '') {
                        anexos.push({ nome: 'Acessar Anexo', url: link.trim(), tipo: 'link' })
                    }
                })
                a.arquivos.forEach(arq => {
                    if (arq.url) {
                        anexos.push({ nome: arq.nome || 'Arquivo', url: arq.url, tipo: 'arquivo' })
                    }
                })
                return {
                    plano_id: planData.id,
                    titulo: a.titulo,
                    descricao: a.descricao,
                    tipo: a.tipo,
                    status: 'Não Iniciada',
                    anexos
                }
            })

            await supabase.from('pdi_tarefas').insert(tasksToInsert)
        }

        setLoading(false)
        setOpen(false)

        // Reset form
        setColaboradorId("")
        setTitulo("")
        setDescricao("")
        setObservacaoInterna("")
        setDataInicio("")
        setDataPrazo("")
        setAtividades([{ id: '1', titulo: 'Treinamento de Gestão Ágil', descricao: 'Curso Online', tipo: 'video', links: [''], arquivos: [] }])

        window.location.reload()
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-cyan-600 hover:bg-cyan-700 text-white rounded-xl h-10 px-4 flex items-center gap-2">
                    <PlusCircle className="h-4 w-4" />
                    Adicionar PDI
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[600px] bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-3xl p-0 overflow-hidden text-slate-900 dark:text-white">
                <div className="px-8 pt-8 pb-4">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">Adicionar Novo PDI</DialogTitle>
                        <DialogDescription className="text-slate-500 font-medium">
                            Estruture o plano de desenvolvimento do seu colaborador.
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
                            <div className="relative">
                                <Input
                                    type="date"
                                    className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11 w-full pl-3 pr-10 focus-visible:ring-cyan-500"
                                    value={dataInicio}
                                    onChange={(e) => setDataInicio(e.target.value)}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-slate-900 dark:text-slate-200">Prazo Final</label>
                            <div className="relative">
                                <Input
                                    type="date"
                                    className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11 w-full pl-3 pr-10 focus-visible:ring-cyan-500"
                                    value={dataPrazo}
                                    onChange={(e) => setDataPrazo(e.target.value)}
                                />
                            </div>
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
                                            {a.links.map((link, li) => (
                                                <div key={li} className="flex items-center gap-1">
                                                    <Input
                                                        value={link}
                                                        onChange={(e) => {
                                                            const newLinks = [...a.links]
                                                            newLinks[li] = e.target.value
                                                            updateAtividade(a.id, 'links', newLinks)
                                                        }}
                                                        className="h-7 text-xs bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-300 w-full"
                                                        placeholder="🔗 Link do anexo (Opcional)"
                                                    />
                                                    {a.links.length > 1 && (
                                                        <button onClick={() => { const nl = a.links.filter((_, idx) => idx !== li); updateAtividade(a.id, 'links', nl) }} className="text-slate-400 hover:text-rose-500 p-0.5"><Trash2 className="w-3 h-3" /></button>
                                                    )}
                                                </div>
                                            ))}
                                            <button onClick={() => updateAtividade(a.id, 'links', [...a.links, ''])} className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Adicionar link</button>
                                        </div>

                                        {/* Multiple files */}
                                        <div className="space-y-1">
                                            {a.arquivos.map((arq, fi) => (
                                                <div key={fi} className="flex items-center gap-1 text-xs text-cyan-600 dark:text-cyan-400">
                                                    <Paperclip className="w-3 h-3" />
                                                    <a href={normalizeUrl(arq.url)} target="_blank" rel="noreferrer" className="hover:underline truncate">{arq.nome}</a>
                                                    <button onClick={() => { const na = a.arquivos.filter((_, idx) => idx !== fi); updateAtividade(a.id, 'arquivos', na) }} className="text-slate-400 hover:text-rose-500 p-0.5 ml-1"><Trash2 className="w-3 h-3" /></button>
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
                        {loading ? "Criando..." : "Criar Plano"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
