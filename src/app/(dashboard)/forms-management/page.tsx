"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { FileQuestion, Search, PlusCircle, Copy, BarChart3, Clock, CheckCircle2, FileEdit, Trash2, Eye, Users, ChevronDown, ChevronUp, RefreshCw, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { CreateFormDialog, FormInitialData } from "./components/create-form-dialog"
import { FormResponsesDashboard } from "./components/form-responses-dashboard"
import { toast } from "sonner"

function statusBadge(status: string) {
    const map: Record<string, { label: string, class: string }> = {
        rascunho: { label: "Rascunho", class: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400" },
        ativo: { label: "Ativo", class: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" },
        encerrado: { label: "Encerrado", class: "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400" },
    }
    const s = map[status] || map.rascunho
    return <Badge className={`${s.class} font-bold text-[10px] uppercase tracking-wider border-none`}>{s.label}</Badge>
}

export default function FormsManagementPage() {
    const [forms, setForms] = useState<any[]>([])
    const [search, setSearch] = useState("")
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [npsAberto, setNpsAberto] = useState(true)

    // Copy / Edit dialog state
    const [dialogData, setDialogData] = useState<FormInitialData | null>(null)
    const [dialogEditMode, setDialogEditMode] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)



    const fetchForms = async () => {
        // Auto-close expired forms and penalize
        const { data: expired } = await supabase
            .from('formularios')
            .select('id')
            .eq('status', 'ativo')
            .lt('data_prazo', new Date().toISOString())
            .not('data_prazo', 'is', null)

        if (expired && expired.length > 0) {
            await supabase
                .from('formularios')
                .update({ status: 'encerrado' })
                .in('id', expired.map(e => e.id))


        }

        const { data } = await supabase
            .from('formularios')
            .select('*, formulario_perguntas(count), formulario_respostas(count)')
            .order('created_at', { ascending: false })
        if (data) setForms(data)

        const { data: configData } = await supabase
             .from('configuracoes')
             .select('valor')
             .eq('chave', 'nps_projeto_ativo')
             .single()
        
        if (configData) {
            setNpsAberto(configData.valor === true || configData.valor === 'true')
        }
    }

    useEffect(() => { fetchForms() }, [])

    const loadFormWithQuestions = async (form: any): Promise<FormInitialData> => {
        const { data: perguntas } = await supabase
            .from('formulario_perguntas')
            .select('*')
            .eq('formulario_id', form.id)
            .order('ordem')

        return {
            id: form.id,
            titulo: form.titulo,
            descricao: form.descricao || '',
            dataPrazo: form.data_prazo ? new Date(form.data_prazo).toISOString().split('T')[0] : '',
            status: form.status,
            pagina_destino: form.pagina_destino || null,
            tipo_formulario: form.tipo_formulario || 'formulário',
            perguntas: (perguntas || []).map(p => ({
                id: p.id,
                titulo: p.titulo,
                descricao: p.descricao || '',
                tipo: p.tipo,
                opcoes: p.opcoes,
                obrigatoria: p.obrigatoria,
            })),
        }
    }

    const handleCopy = async (form: any) => {
        const data = await loadFormWithQuestions(form)
        setDialogData(data)
        setDialogEditMode(false)
        setDialogOpen(true)
    }

    const handleEdit = async (form: any) => {
        const data = await loadFormWithQuestions(form)
        setDialogData(data)
        setDialogEditMode(true)
        setDialogOpen(true)
    }

    const handleDialogClose = (open: boolean) => {
        setDialogOpen(open)
        if (!open) {
            setDialogData(null)
            setDialogEditMode(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm("Tem certeza que deseja excluir este formulário? Todas as respostas serão perdidas.")) return
        await supabase.from('formularios').delete().eq('id', id)
        toast.success("Formulário excluído")
        fetchForms()
    }

    const handleToggleStatus = async (form: any) => {
        const newStatus = form.status === 'ativo' ? 'encerrado' : 'ativo'
        await supabase.from('formularios').update({ status: newStatus }).eq('id', form.id)
        toast.success(`Formulário ${newStatus === 'ativo' ? 'ativado' : 'encerrado'}!`)



        fetchForms()
    }

    const handleToggleNps = async () => {
        const novoValor = !npsAberto
        await supabase.from('configuracoes').upsert({ chave: 'nps_projeto_ativo', valor: novoValor })
        setNpsAberto(novoValor)
        toast.success(`NPS Projetos ${novoValor ? 'Aberto' : 'Fechado'} para respostas.`)
    }

    const handleReenviar = async (form: any) => {
        if (!confirm('Reenviar formulário? As respostas anteriores serão apagadas e os membros poderão responder novamente.')) return
        try {
            const { data: respostas } = await supabase
                .from('formulario_respostas')
                .select('id')
                .eq('formulario_id', form.id)

            if (respostas && respostas.length > 0) {
                const respostaIds = respostas.map(r => r.id)
                await supabase
                    .from('formulario_respostas_itens')
                    .delete()
                    .in('resposta_id', respostaIds)
            }

            await supabase
                .from('formulario_respostas')
                .delete()
                .eq('formulario_id', form.id)

            const { error } = await supabase.from('formularios').update({
                status: 'ativo',
                data_inicio: new Date().toISOString(),
            }).eq('id', form.id)

            if (error) throw error

            toast.success('Formulário reenviado! Os membros podem responder novamente.')
            fetchForms()
        } catch (err: any) {
            toast.error('Erro ao reenviar formulário: ' + (err.message || 'Erro desconhecido'))
        }
    }

    const filtered = forms.filter(f =>
        f.titulo.toLowerCase().includes(search.toLowerCase())
    )

    return (
        <div className="flex flex-col gap-8 pb-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-violet-50 dark:bg-violet-500/10 p-2.5 rounded-2xl border border-violet-100 dark:border-violet-500/20">
                        <FileQuestion className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestão de Formulários</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            Crie e gerencie formulários para a sua equipe.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar formulário..."
                            className="bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 pl-9 rounded-xl h-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <CreateFormDialog onSuccess={fetchForms} />
                    <Button onClick={() => window.location.href = '/forms-responses'} variant="outline" className="rounded-xl h-10 border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 font-bold hover:bg-violet-50">
                        Ver as Respostas Consolidadas
                    </Button>
                </div>
            </div>

            {/* Copy / Edit Dialog (controlled externally) */}
            <CreateFormDialog
                onSuccess={() => { fetchForms(); handleDialogClose(false) }}
                initialData={dialogData}
                editMode={dialogEditMode}
                open={dialogOpen}
                onOpenChange={handleDialogClose}
                hideTrigger
            />

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-violet-50 dark:bg-violet-500/10 rounded-xl">
                            <FileQuestion className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{forms.length}</p>
                            <p className="text-xs text-slate-500">Total de Formulários</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">{forms.filter(f => f.status === 'ativo').length}</p>
                            <p className="text-xs text-slate-500">Ativos</p>
                        </div>
                    </div>
                </div>
                <div className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 shadow-sm">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl">
                            <Users className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-slate-900 dark:text-white">
                                {forms.reduce((acc, f) => acc + (f.formulario_respostas?.[0]?.count || 0), 0)}
                            </p>
                            <p className="text-xs text-slate-500">Total de Respostas</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* NPS Global Config Card */}
            <div className="bg-white dark:bg-[#0F172A] rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800/50 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                         Controle do NPS Projetos
                    </h2>
                    <p className="text-sm text-slate-500 mt-1">Habilite ou desabilite os envios do formulário de NPS Projetos.</p>
                </div>
                <div className="flex items-center gap-3">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.location.href = '/nps-projeto'}
                        className="rounded-xl h-9 px-4 text-xs font-bold border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 hover:bg-violet-50"
                    >
                        <Pencil className="h-3.5 w-3.5 mr-1.5" />
                        Editar / Visualizar NPS Projetos
                    </Button>
                    <span className={`text-sm font-bold ${npsAberto ? 'text-emerald-500' : 'text-slate-400'}`}>
                        {npsAberto ? 'Aberto para respostas' : 'Fechado'}
                    </span>
                    <Switch checked={npsAberto} onCheckedChange={handleToggleNps} />
                </div>
            </div>

            {/* Forms List */}
            <div className="bg-white dark:bg-[#0F172A] rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800/50">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Formulários</h2>
                        <p className="text-sm text-slate-500">Clique em um formulário para ver as respostas.</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {filtered.length === 0 && (
                        <div className="text-center py-12 text-slate-400">
                            <FileQuestion className="h-12 w-12 mx-auto mb-3 opacity-30" />
                            <p className="font-medium">Nenhum formulário encontrado</p>
                            <p className="text-sm">Crie o primeiro formulário clicando no botão acima.</p>
                        </div>
                    )}

                    {filtered.map(form => (
                        <div key={form.id} className="border border-slate-100 dark:border-slate-800/50 rounded-2xl overflow-hidden transition-all">
                            <div
                                className="p-5 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                                onClick={() => setExpandedId(expandedId === form.id ? null : form.id)}
                            >
                                <div className="flex items-center gap-4 flex-1 min-w-0">
                                    <div className="p-2 bg-violet-50 dark:bg-violet-500/10 rounded-xl shrink-0">
                                        <FileQuestion className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h3 className="font-bold text-slate-900 dark:text-white truncate">{form.titulo}</h3>
                                            {statusBadge(form.status)}
                                            {form.pagina_destino && (
                                                <Badge className="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 font-bold text-[10px] uppercase tracking-wider border-none shrink-0">
                                                    → {form.pagina_destino === 'performance' ? 'Performance' : 'NPS Gerente'}
                                                </Badge>
                                            )}
                                        </div>
                                        {form.descricao && (
                                            <p className="text-sm text-slate-500 line-clamp-2 mt-0.5 whitespace-normal break-words" dangerouslySetInnerHTML={{ __html: form.descricao }}></p>
                                        )}
                                        <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400">
                                            <span className="flex items-center gap-1">
                                                <BarChart3 className="h-3 w-3" />
                                                {form.formulario_perguntas?.[0]?.count || 0} perguntas
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Users className="h-3 w-3" />
                                                {form.formulario_respostas?.[0]?.count || 0} respostas
                                            </span>
                                            {form.data_prazo && (
                                                <span className="flex items-center gap-1">
                                                    <Clock className="h-3 w-3" />
                                                    Prazo: {new Date(form.data_prazo).toLocaleDateString('pt-BR')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0 ml-4">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={(e) => { e.stopPropagation(); handleToggleStatus(form) }}
                                        className="h-8 px-3 text-xs font-bold rounded-lg"
                                    >
                                        {form.status === 'ativo' ? 'Encerrar' : 'Ativar'}
                                    </Button>
                                    {(form.status === 'encerrado') && (
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={(e) => { e.stopPropagation(); handleReenviar(form) }}
                                            className="h-8 px-3 text-xs font-bold rounded-lg text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-500/10"
                                            title="Reenviar para responderem novamente"
                                        >
                                            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Reenviar
                                        </Button>
                                    )}
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => { e.stopPropagation(); handleEdit(form) }}
                                        className="h-8 w-8 text-slate-400 hover:text-amber-600"
                                        title="Editar"
                                    >
                                        <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => { e.stopPropagation(); handleCopy(form) }}
                                        className="h-8 w-8 text-slate-400 hover:text-violet-600"
                                        title="Copiar"
                                    >
                                        <Copy className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={(e) => { e.stopPropagation(); handleDelete(form.id) }}
                                        className="h-8 w-8 text-slate-400 hover:text-rose-600"
                                        title="Excluir"
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                    {expandedId === form.id ? (
                                        <ChevronUp className="h-4 w-4 text-slate-400" />
                                    ) : (
                                        <ChevronDown className="h-4 w-4 text-slate-400" />
                                    )}
                                </div>
                            </div>

                            {expandedId === form.id && (
                                <div className="border-t border-slate-100 dark:border-slate-800/50">
                                    <FormResponsesDashboard formularioId={form.id} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}
