"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { FileQuestion, Search, PlusCircle, Copy, BarChart3, Clock, CheckCircle2, FileEdit, Trash2, Users, ChevronDown, ChevronUp, RefreshCw, Pencil, FlaskConical, FolderKanban } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { CreateFormDialog, FormInitialData } from "./components/create-form-dialog"
import { FormResponsesDashboard } from "./components/form-responses-dashboard"
import { SimularFormularioDialog } from "./components/simular-formulario-dialog"
import { PastaInsights } from "./components/pasta-insights"
import { toast } from "sonner"
import { loadFormularioPublico, resolveAlvos, colaboradorNoPublico } from "@/lib/forms-publico"
import { isSchemaDesatualizado } from "@/lib/db-compat"

// Convert ISO/UTC string -> "YYYY-MM-DDTHH:mm" in LOCAL timezone (input format).
function isoToLocalDatetimeInput(iso: string | null | undefined): string {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

// Contagem exata de uma relação por formulário, isolada em uma query só
// dela. Cada relação é pedida separadamente de propósito: um embed que não
// resolve (tabela criada por migração ainda não aplicada, ou cache de schema
// do PostgREST desatualizado) faz o PostgREST recusar a requisição inteira,
// então juntar as três num select só significava perder a LISTA por causa de
// uma contagem. Devolve null quando a contagem não pôde ser lida — quem
// mostra precisa distinguir "não sei" de "zero".
async function contarRelacao(relacao: string): Promise<Map<string, number> | null> {
    const { data, error } = await supabase.from('formularios').select(`id, ${relacao}(count)`)
    if (error || !data) {
        console.error(`Não foi possível contar ${relacao}:`, error)
        return null
    }
    const contagens = new Map<string, number>()
    for (const linha of data as unknown as Record<string, unknown>[]) {
        const embutido = linha[relacao] as { count?: number }[] | undefined
        contagens.set(linha.id as string, embutido?.[0]?.count || 0)
    }
    return contagens
}

// Uma linha de formulário na listagem — extraída para ser reaproveitada
// dentro de cada "Pasta" (ver mais abaixo) sem duplicar o JSX inteiro.
function FormRow({ form, expandedId, setExpandedId, handleToggleStatus, handleReenviar, setSimularForm, handleEdit, handleCopy, handleDelete }: {
    form: any
    expandedId: string | null
    setExpandedId: (id: string | null) => void
    handleToggleStatus: (form: any) => void
    handleReenviar: (form: any) => void
    setSimularForm: (v: { id: string, titulo: string } | null) => void
    handleEdit: (form: any) => void
    handleCopy: (form: any) => void
    handleDelete: (id: string) => void
}) {
    return (
        <div className="border border-slate-100 dark:border-slate-800/50 rounded-2xl overflow-hidden transition-all">
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
                            {(form._cRecebe || 0) > 0 && (
                                <Badge className="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 font-bold text-[10px] uppercase tracking-wider border-none shrink-0">
                                    Direcionado
                                </Badge>
                            )}
                        </div>
                        {form.descricao && (
                            <p className="text-sm text-slate-500 line-clamp-2 mt-0.5 whitespace-normal break-words" dangerouslySetInnerHTML={{ __html: form.descricao }}></p>
                        )}
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                                <BarChart3 className="h-3 w-3" />
                                {form._cPerguntas === null ? '—' : form._cPerguntas} perguntas
                            </span>
                            <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {form._cRespostas === null ? '—' : form._cRespostas} respostas
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
                        onClick={(e) => { e.stopPropagation(); setSimularForm({ id: form.id, titulo: form.titulo }) }}
                        className="h-8 w-8 text-slate-400 hover:text-violet-600"
                        title="Simular resposta (nada é salvo)"
                    >
                        <FlaskConical className="h-4 w-4" />
                    </Button>
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
    )
}

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
    // Pasta = Tipo do Formulário (ver "Tipo do Formulário" em CreateFormDialog).
    // Aberta por padrão; guarda só quem foi explicitamente fechado.
    const [expandedPastas, setExpandedPastas] = useState<Record<string, boolean>>({})

    // Copy / Edit dialog state
    const [dialogData, setDialogData] = useState<FormInitialData | null>(null)
    const [dialogEditMode, setDialogEditMode] = useState(false)
    const [dialogOpen, setDialogOpen] = useState(false)
    const [simularForm, setSimularForm] = useState<{ id: string, titulo: string } | null>(null)


    // Sinaliza colaboradores que não responderam um formulário encerrado no mês atual.
    // Idempotente: pula quem já está como PENDENTE com a mesma descrição (inclui Mês/Ano).
    const prePontuarNaoRespondentes = async (form: { id: string, titulo: string, tipo_formulario?: string | null }) => {
        const now = new Date()
        const mes = now.getMonth() + 1
        const ano = now.getFullYear()
        const MESES_NOMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
        const mesLabel = `${MESES_NOMES[mes - 1]}/${ano}`
        const pad = (n: number) => String(n).padStart(2, '0')
        const firstDay = `${ano}-${pad(mes)}-01`
        const lastDayDate = new Date(ano, mes, 0).getDate()
        const lastDay = `${ano}-${pad(mes)}-${pad(lastDayDate)}T23:59:59.999Z`

        const [{ data: allColabs }, publico, { data: respostas }] = await Promise.all([
            supabase.from('colaboradores').select('id, cargo_atual, nucleo_atual'),
            loadFormularioPublico(form.id),
            supabase
                .from('formulario_respostas')
                .select('colaborador_id, alvo_colaborador_id')
                .eq('formulario_id', form.id)
                .gte('enviado_em', firstDay)
                .lte('enviado_em', lastDay),
        ])

        const colaboradoresList = allColabs || []
        // Só quem bate com "quem responde" é candidato a ser cobrado por não ter respondido.
        const elegiveis = colaboradoresList.filter((c: any) => colaboradorNoPublico(c, publico.quemResponde))

        // colaborador_id -> conjunto de alvos já respondidos neste período
        // ('__self__' representa uma resposta sem alvo, isto é, o formulário
        // comum de sempre).
        const respondidoPor = new Map<string, Set<string>>()
        for (const r of respostas || []) {
            if (!r.colaborador_id) continue
            const set = respondidoPor.get(r.colaborador_id) || new Set<string>()
            set.add(r.alvo_colaborador_id || '__self__')
            respondidoPor.set(r.colaborador_id, set)
        }

        const naoResponderam = elegiveis.filter((c: any) => {
            if (publico.quemRecebe.length === 0) {
                return !respondidoPor.get(c.id)?.size
            }
            // Formulário direcionado: só é cobrado quem tem pelo menos um
            // alvo esperado, e só conta como respondido quando TODOS os
            // alvos atuais foram preenchidos neste período.
            const alvos = resolveAlvos(colaboradoresList, publico.quemRecebe, c.id)
            if (alvos.length === 0) return false
            const respondidos = respondidoPor.get(c.id) || new Set<string>()
            return !alvos.every((a: any) => respondidos.has(a.id))
        })
        if (naoResponderam.length === 0) return 0

        const tipo = form.tipo_formulario || 'formulário'
        const descricao = `Não envio do ${tipo}: ${form.titulo} - ${mesLabel}`

        const { data: existing } = await supabase
            .from('pontos_pre_pontuacao')
            .select('colaborador_id')
            .eq('descricao', descricao)
            .eq('status', 'PENDENTE')
        const jaCadastrados = new Set((existing || []).map((e: any) => e.colaborador_id))

        const rows = naoResponderam
            .filter((c: any) => !jaCadastrados.has(c.id))
            .map((c: any) => ({
                colaborador_id: c.id,
                formulario_id: form.id,
                descricao,
                origem: 'auto',
                status: 'PENDENTE',
            }))
        if (rows.length === 0) return 0
        await supabase.from('pontos_pre_pontuacao').insert(rows)
        return rows.length
    }

    const fetchForms = async () => {
        // Auto-close expired forms and pre-pontuar quem não respondeu
        const { data: expired } = await supabase
            .from('formularios')
            .select('id, titulo, tipo_formulario')
            .eq('status', 'ativo')
            .lt('data_prazo', new Date().toISOString())
            .not('data_prazo', 'is', null)

        if (expired && expired.length > 0) {
            // Isolado: uma falha aqui (ex.: pré-pontuação) não pode impedir a
            // listagem dos formulários mais abaixo.
            try {
                await supabase
                    .from('formularios')
                    .update({ status: 'encerrado' })
                    .in('id', expired.map(e => e.id))

                for (const form of expired) {
                    await prePontuarNaoRespondentes(form)
                }
            } catch (err) {
                console.error('Falha ao encerrar formulários vencidos / pré-pontuar:', err)
            }
        }

        // A listagem não depende de relação nenhuma: só a própria tabela de
        // formulários. Antes as contagens vinham embutidas neste mesmo select
        // (`formulario_perguntas(count), formulario_respostas(count), ...`) e
        // bastava UMA relação não resolver — migração pendente ou cache de
        // schema desatualizado — para o PostgREST recusar a query inteira e a
        // tela mostrar "Nenhum formulário encontrado", com todos os
        // formulários intactos no banco.
        const { data: lista, error: erroLista } = await supabase
            .from('formularios')
            .select('*')
            .order('created_at', { ascending: false })

        if (!lista) {
            console.error('Erro ao listar formulários:', erroLista)
            toast.error('Erro ao carregar os formulários: ' + (erroLista?.message || 'erro desconhecido'))
            return
        }

        // Cada contagem é lida em uma query própria, isolando as relações umas
        // das outras: uma tabela ausente custa só a sua contagem, e nunca a
        // lista. Contagem desconhecida vira `null` (exibida como "—") — dizer
        // 0 seria mentira.
        const [cPerguntas, cRespostas, cRecebe] = await Promise.all([
            contarRelacao('formulario_perguntas'),
            contarRelacao('formulario_respostas'),
            contarRelacao('formulario_publico_recebe'),
        ])

        setForms(lista.map(f => ({
            ...f,
            _cPerguntas: cPerguntas ? (cPerguntas.get(f.id) ?? 0) : null,
            _cRespostas: cRespostas ? (cRespostas.get(f.id) ?? 0) : null,
            _cRecebe: cRecebe ? (cRecebe.get(f.id) ?? 0) : null,
        })))

        if (!cPerguntas || !cRespostas || !cRecebe) {
            toast.warning('Os formulários carregaram, mas algumas contagens não — provavelmente falta aplicar uma migração do banco.')
        }
    }

    useEffect(() => { fetchForms() }, [])

    const loadFormWithQuestions = async (form: any): Promise<FormInitialData> => {
        // Só perguntas ativas — uma arquivada (removida numa edição
        // anterior, ver 20260909_formulario_perguntas_ativa.sql) não deve
        // voltar a aparecer na tela de edição.
        const perguntasComAtiva = supabase.from('formulario_perguntas').select('*').eq('formulario_id', form.id).eq('ativa', true).order('ordem')
        const [comAtivaResult, publico] = await Promise.all([perguntasComAtiva, loadFormularioPublico(form.id)])
        const { data: perguntas } = isSchemaDesatualizado(comAtivaResult.error)
            ? await supabase.from('formulario_perguntas').select('*').eq('formulario_id', form.id).order('ordem')
            : comAtivaResult

        return {
            id: form.id,
            titulo: form.titulo,
            descricao: form.descricao || '',
            dataPrazo: isoToLocalDatetimeInput(form.data_prazo),
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
                logica_condicional: p.logica_condicional || null,
                competencia: p.competencia || null,
                permite_nao_avaliar: !!p.permite_nao_avaliar,
            })),
            quemResponde: publico.quemResponde,
            quemRecebe: publico.quemRecebe,
            gerarSubaba: !!form.gerar_subaba,
            subabaNome: form.subaba_nome || null,
            npsInterno: !!form.nps_interno,
            npsProjetosGenerico: !!form.nps_projetos_generico,
            modoResposta: form.modo_resposta || 'multipla',
        }
    }

    const handleCopy = async (form: any) => {
        const data = await loadFormWithQuestions(form)
        // Uma cópia nunca nasce marcada como fonte do NPS Interno/Projetos —
        // copiar não deve inscrever silenciosamente uma segunda fonte ao
        // salvar, mesmo sem exclusividade entre formulários.
        setDialogData({ ...data, npsInterno: false, npsProjetosGenerico: false })
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

        if (newStatus === 'encerrado') {
            const count = await prePontuarNaoRespondentes(form)
            if (count > 0) {
                toast.success(`Formulário encerrado. ${count} colaborador${count !== 1 ? 'es' : ''} sinalizado${count !== 1 ? 's' : ''} como pré pontuado${count !== 1 ? 's' : ''}.`)
            } else {
                toast.success('Formulário encerrado!')
            }
        } else {
            toast.success('Formulário ativado!')
        }

        fetchForms()
    }

    const handleReenviar = async (form: any) => {
        if (!confirm('Reenviar formulário? Ele será reaberto para novas respostas. As respostas anteriores são MANTIDAS no histórico.')) return
        try {
            // IMPORTANTE: não apagamos as respostas anteriores — apenas reabrimos o
            // formulário. O histórico de respostas é preservado e continua visível.
            const { error } = await supabase.from('formularios').update({
                status: 'ativo',
                data_inicio: new Date().toISOString(),
            }).eq('id', form.id)

            if (error) throw error

            toast.success('Formulário reaberto! As respostas anteriores foram mantidas e os membros podem responder novamente.')
            fetchForms()
        } catch (err: any) {
            toast.error('Erro ao reenviar formulário: ' + (err.message || 'Erro desconhecido'))
        }
    }

    const filtered = forms.filter(f =>
        f.titulo.toLowerCase().includes(search.toLowerCase())
    )

    // Agrupa a listagem em "Pastas de Formulários" — uma por Tipo do
    // Formulário (mesmo campo usado no dropdown de CreateFormDialog).
    // Formulário sem tipo definido cai numa pasta "Sem tipo" só para não
    // sumir da lista. Ordenado alfabeticamente, exceto "Sem tipo" que sempre
    // fica por último (é o balde de exceção, não um tipo de verdade).
    const SEM_TIPO = 'Sem tipo'
    const pastasMap = new Map<string, any[]>()
    for (const f of filtered) {
        const nome = (f.tipo_formulario || '').trim() || SEM_TIPO
        const arr = pastasMap.get(nome) || []
        arr.push(f)
        pastasMap.set(nome, arr)
    }
    const pastas = Array.from(pastasMap.entries())
        .map(([nome, forms]) => ({ nome, forms }))
        .sort((a, b) => {
            if (a.nome === SEM_TIPO) return 1
            if (b.nome === SEM_TIPO) return -1
            return a.nome.localeCompare(b.nome, 'pt-BR')
        })

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

            {/* Simulação de resposta (não grava nada) */}
            <SimularFormularioDialog
                formulario={simularForm}
                open={!!simularForm}
                onOpenChange={(o) => { if (!o) setSimularForm(null) }}
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
                                {forms.some(f => f._cRespostas === null)
                                    ? '—'
                                    : forms.reduce((acc, f) => acc + (f._cRespostas || 0), 0)}
                            </p>
                            <p className="text-xs text-slate-500">Total de Respostas</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pastas de Formulários — cada Tipo do Formulário vira sua própria
                sessão, com as médias recebidas pelos membros daquele tipo
                antes da lista. */}
            {filtered.length === 0 ? (
                <div className="bg-white dark:bg-[#0F172A] rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800/50">
                    <div className="text-center py-12 text-slate-400">
                        <FileQuestion className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">Nenhum formulário encontrado</p>
                        <p className="text-sm">Crie o primeiro formulário clicando no botão acima.</p>
                    </div>
                </div>
            ) : (
                pastas.map(pasta => {
                    const aberta = expandedPastas[pasta.nome] ?? true
                    return (
                        <div key={pasta.nome} className="bg-white dark:bg-[#0F172A] rounded-3xl p-6 shadow-sm border border-slate-100 dark:border-slate-800/50">
                            <div
                                className="flex items-center justify-between mb-6 cursor-pointer select-none"
                                onClick={() => setExpandedPastas(prev => ({ ...prev, [pasta.nome]: !aberta }))}
                            >
                                <div className="flex items-center gap-3">
                                    <div className="bg-violet-50 dark:bg-violet-500/10 p-2 rounded-xl border border-violet-100 dark:border-violet-500/20">
                                        <FolderKanban className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-bold text-slate-900 dark:text-white">{pasta.nome}</h2>
                                        <p className="text-sm text-slate-500">{pasta.forms.length} formulário{pasta.forms.length !== 1 ? 's' : ''} — clique em um para ver as respostas.</p>
                                    </div>
                                </div>
                                {aberta ? <ChevronUp className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                            </div>

                            {aberta && (
                                <>
                                    <PastaInsights formularioIds={pasta.forms.map(f => f.id)} />
                                    <div className="space-y-3">
                                        {pasta.forms.map(form => (
                                            <FormRow
                                                key={form.id}
                                                form={form}
                                                expandedId={expandedId}
                                                setExpandedId={setExpandedId}
                                                handleToggleStatus={handleToggleStatus}
                                                handleReenviar={handleReenviar}
                                                setSimularForm={setSimularForm}
                                                handleEdit={handleEdit}
                                                handleCopy={handleCopy}
                                                handleDelete={handleDelete}
                                            />
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    )
                })
            )}
        </div>
    )
}
