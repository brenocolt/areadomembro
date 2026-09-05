"use client"
import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlusCircle, Trash2, GripVertical, Plus, Loader2, Copy, Bold, Italic, ImagePlus, X, Heading1, Columns, FileEdit, Users } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { PublicoParesEditor } from "./publico-pares-editor"
import { saveFormularioPublico, type PublicoPar } from "@/lib/forms-publico"
import { isSchemaDesatualizado, semColunas, type ErroPostgrest } from "@/lib/db-compat"
import { RichTextInput, aplicarFormatoRichText } from "@/components/forms/rich-text-input"

// Colunas criadas pela migração 20260825 (competência, "Não avaliar" e
// sub-aba). Enquanto ela não for aplicada, o banco recusa a gravação INTEIRA
// só por causa delas — ou seja, ninguém consegue criar ou editar formulário
// nenhum, nem os que não usam esses recursos.
const COLUNAS_MIGRACAO_20260825 = ['gerar_subaba', 'competencia', 'permite_nao_avaliar']

function mensagemErroGravacao(error: { message?: string, details?: string } | null): string {
    const msg = `${error?.message || ''} ${error?.details || ''}`
    if (COLUNAS_MIGRACAO_20260825.some(c => msg.includes(c))) {
        return 'O banco ainda não tem as colunas de competência/sub-aba. Aplique a migração supabase/migrations/20260825_formularios_subabas_competencias.sql e tente de novo.'
    }
    return error?.message || 'Erro desconhecido'
}

// Grava tentando primeiro com as colunas da migração 20260825 e, se o banco
// ainda não as tiver, repete sem elas. O formulário é salvo do mesmo jeito;
// só os extras (competência, "Não avaliar", sub-aba em Performance) ficam de
// fora até a migração rodar — em vez de a gravação inteira ser recusada.
// `degradado` diz se caímos nesse segundo caminho, para avisar quem salvou.
type PayloadGravacao = Record<string, unknown>

async function gravarComFallback<T>(
    executar: (payload: PayloadGravacao | PayloadGravacao[]) => PromiseLike<{ data: T | null, error: ErroPostgrest | null }>,
    payload: PayloadGravacao | PayloadGravacao[],
): Promise<{ data: T | null, error: ErroPostgrest | null, degradado: boolean }> {
    const tentativa = await executar(payload)
    if (!tentativa.error || !isSchemaDesatualizado(tentativa.error)) {
        return { ...tentativa, degradado: false }
    }
    const semExtras = Array.isArray(payload)
        ? payload.map(p => semColunas(p, COLUNAS_MIGRACAO_20260825))
        : semColunas(payload, COLUNAS_MIGRACAO_20260825)
    const repeticao = await executar(semExtras)
    return { ...repeticao, degradado: !repeticao.error }
}

// Salvou, mas o banco recusou as colunas novas: quem salvou precisa saber
// que competência, "Não avaliar" e sub-aba não foram gravadas.
function avisarSemExtras(degradado: boolean) {
    if (!degradado) return
    toast.warning('Salvo sem competência/"Não avaliar"/sub-aba: o banco ainda não tem essas colunas. Rode a migração 20260825_formularios_subabas_competencias.sql e salve de novo para aplicá-las.', { duration: 10000 })
}

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
    // Só usado em perguntas do tipo 'selecao_unica'. Mapa { índice da opção
    // em `opcoes` -> alvo }, onde alvo é o id de uma pergunta do tipo
    // 'secao' ou "enviar". Ausência de chave = continuar sequência normal.
    logica_condicional?: Record<string, string> | null
    // Só em perguntas do tipo 'escala'. `competencia` é o nome curto exibido
    // na sub-aba de Performance no lugar do texto da pergunta;
    // `permite_nao_avaliar` libera a opção "Não avaliar" para quem não tem
    // insumo — essa resposta não é gravada e não entra em nenhuma média.
    competencia?: string | null
    permite_nao_avaliar?: boolean
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
    // Público do formulário (aba "Público") — ver src/lib/forms-publico.ts.
    // Ausente/vazio = "Todos" (quemResponde) / "Ninguém" (quemRecebe).
    quemResponde?: PublicoPar[]
    quemRecebe?: PublicoPar[]
    // Gera uma sub-aba dentro de Performance com a visualização de
    // competências deste formulário. Só se aplica a formulário direcionado.
    gerarSubaba?: boolean
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

function SortableQuestion({ p, i, updatePergunta, removePergunta, duplicatePergunta, updateOpcao, addOpcao, removeOpcao, insertFormatQuestion, secoes, updateLogicaCondicional }: any) {
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
                        <RichTextInput
                            id={`pergunta-titulo-${p.id}`}
                            value={p.titulo}
                            onChange={(html) => updatePergunta(p.id, 'titulo', html)}
                            className="flex items-center bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-700 rounded-xl h-10 px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500 pr-16"
                            placeholder="Texto da pergunta"
                        />
                        <div className="absolute right-1.5 top-1.5 flex items-center">
                            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatoRichText(`pergunta-titulo-${p.id}`, 'bold')} title="Negrito">
                                <Bold className="h-3.5 w-3.5" />
                            </Button>
                            <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatoRichText(`pergunta-titulo-${p.id}`, 'italic')} title="Itálico">
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
                        <div className="flex items-center gap-3 flex-wrap">
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={p.obrigatoria}
                                    onCheckedChange={(v) => updatePergunta(p.id, 'obrigatoria', v)}
                                />
                                <span className="text-xs text-slate-500">Obrigatória</span>
                            </div>
                            {p.tipo === 'escala' && (
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={!!p.permite_nao_avaliar}
                                        onCheckedChange={(v) => updatePergunta(p.id, 'permite_nao_avaliar', v)}
                                    />
                                    <span className="text-xs text-slate-500" title="Deixa quem responde marcar que não tem insumo para avaliar — a resposta não é gravada e não entra nas médias.">
                                        Não avaliar
                                    </span>
                                </div>
                            )}
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

                    {p.tipo === 'selecao_unica' && Array.isArray(p.opcoes) && (
                        <div className="pl-2 pt-2 mt-1 border-t border-dashed border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-2">
                                <Switch
                                    checked={!!p.logica_condicional}
                                    onCheckedChange={(v: boolean) => updatePergunta(p.id, 'logica_condicional', v ? {} : null)}
                                />
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                    Lógica condicional (ir para seção conforme a resposta)
                                </span>
                            </div>
                            {p.logica_condicional && (
                                secoes.length === 0 ? (
                                    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-2">
                                        Crie ao menos uma &quot;Seção&quot; no formulário para poder direcionar respostas para ela.
                                    </p>
                                ) : (
                                    <div className="space-y-2 mt-2">
                                        {p.opcoes.map((opt: string, oi: number) => (
                                            <div key={oi} className="flex items-center gap-2">
                                                <span className="text-[11px] text-slate-500 dark:text-slate-400 w-28 truncate shrink-0" title={opt}>
                                                    Se &quot;{opt}&quot;:
                                                </span>
                                                <Select
                                                    value={p.logica_condicional?.[oi] ?? 'continuar'}
                                                    onValueChange={(v) => updateLogicaCondicional(p.id, oi, v)}
                                                >
                                                    <SelectTrigger className="h-8 text-xs bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg flex-1">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent className="bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-xl">
                                                        <SelectItem value="continuar" className="text-xs">Continuar sequência normal</SelectItem>
                                                        <SelectItem value="enviar" className="text-xs">Enviar formulário</SelectItem>
                                                        {secoes.map((s: Pergunta) => (
                                                            <SelectItem key={s.id} value={s.id} className="text-xs">
                                                                Ir para seção: {s.titulo || '(sem título)'}
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                        ))}
                                    </div>
                                )
                            )}
                        </div>
                    )}

                    {p.tipo === 'escala' && p.opcoes && (
                        <div className="space-y-2">
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
                            <div className="space-y-1">
                                <Input
                                    value={p.competencia || ''}
                                    onChange={(e) => updatePergunta(p.id, 'competencia', e.target.value)}
                                    className="h-8 text-xs bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg"
                                    placeholder="Competência avaliada (ex: Pontualidade)"
                                />
                                <p className="text-[11px] text-slate-400">
                                    Nome curto mostrado na sub-aba de Performance no lugar do texto da pergunta.
                                </p>
                            </div>

                            <div className="pl-2 pt-2 mt-1 border-t border-dashed border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-2">
                                    <Switch
                                        checked={!!p.opcoes.criterios}
                                        onCheckedChange={(v: boolean) => updatePergunta(p.id, 'opcoes', {
                                            ...p.opcoes,
                                            criterios: v ? { 1: '', 2: '', 3: '', 4: '', 5: '' } : undefined,
                                        })}
                                    />
                                    <span className="text-xs font-bold text-slate-600 dark:text-slate-400">
                                        Definir critério de cada nota (1 a 5), manualmente
                                    </span>
                                </div>
                                {p.opcoes.criterios && (
                                    <div className="space-y-1.5 mt-2">
                                        <p className="text-[11px] text-slate-400">
                                            Aparece para quem responde ao passar o mouse/tocar em cada nota. Deixe em branco a(s) nota(s) sem critério específico.
                                        </p>
                                        {[1, 2, 3, 4, 5].map(v => (
                                            <div key={v} className="flex items-start gap-2">
                                                <span className="text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-500/20 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-1">
                                                    {v}
                                                </span>
                                                <Textarea
                                                    value={p.opcoes.criterios[v] || ''}
                                                    onChange={(e) => updatePergunta(p.id, 'opcoes', {
                                                        ...p.opcoes,
                                                        criterios: { ...p.opcoes.criterios, [v]: e.target.value },
                                                    })}
                                                    className="min-h-[36px] h-9 text-xs bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg resize-none py-1.5"
                                                    placeholder={`Critério da nota ${v} (ex: descreva o que caracteriza essa nota)`}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
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

    // Público do formulário — ver aba "Público" mais abaixo e src/lib/forms-publico.ts.
    const [quemResponde, setQuemResponde] = useState<PublicoPar[]>([])
    const [quemRecebe, setQuemRecebe] = useState<PublicoPar[]>([])
    const [gerarSubaba, setGerarSubaba] = useState(false)
    // Lista de colaboradores só para a prévia de alcance na aba "Público".
    const [colaboradores, setColaboradores] = useState<{ id: string, nome: string, cargo_atual?: string | null, nucleo_atual?: string | null }[]>([])

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
            setQuemResponde(initialData.quemResponde || [])
            setQuemRecebe(initialData.quemRecebe || [])
            setGerarSubaba(!!initialData.gerarSubaba)
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

    // Colaboradores para a prévia de alcance dos grupos na aba "Público".
    useEffect(() => {
        if (!open) return
        supabase.from('colaboradores').select('id, nome, cargo_atual, nucleo_atual').then(({ data }) => {
            if (data) setColaboradores(data)
        })
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
        setQuemResponde([])
        setQuemRecebe([])
        setGerarSubaba(false)
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
                // Lógica condicional só existe em perguntas de seleção única.
                if (value !== 'selecao_unica') {
                    updated.logica_condicional = null
                }
                // Competência e "Não avaliar" só existem em perguntas de escala.
                if (value !== 'escala') {
                    updated.competencia = null
                    updated.permite_nao_avaliar = false
                }
            }
            return updated
        }))
    }

    // Atualiza o alvo da lógica condicional para uma opção específica (pelo
    // índice dela em `opcoes`). "continuar" remove a chave — ausência de
    // chave já significa "seguir sequência normal", mantendo o objeto limpo.
    const updateLogicaCondicional = (perguntaId: string, optionIndex: number, target: string) => {
        setPerguntas(perguntas.map(p => {
            if (p.id !== perguntaId) return p
            const logica = { ...(p.logica_condicional || {}) }
            if (target === 'continuar') delete logica[optionIndex]
            else logica[optionIndex] = target
            return { ...p, logica_condicional: logica }
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
            const newOpcoes = p.opcoes.filter((_: any, i: number) => i !== index)
            // Reindexa a lógica condicional para acompanhar o deslocamento dos
            // índices das opções remanescentes (senão a lógica passaria a
            // apontar para a opção errada após a remoção).
            let newLogica = p.logica_condicional
            if (newLogica) {
                const reindexed: Record<string, string> = {}
                Object.entries(newLogica).forEach(([key, val]) => {
                    const k = parseInt(key, 10)
                    if (k === index) return
                    reindexed[k > index ? k - 1 : k] = val
                })
                newLogica = reindexed
            }
            return { ...p, opcoes: newOpcoes, logica_condicional: newLogica }
        }))
    }

    // Grava a lógica condicional depois que TODAS as perguntas já foram
    // salvas — os alvos podem referenciar o id de uma seção nova, que só
    // existe de fato após o insert dela. `idMap` traduz o id client-side
    // (temporário ou já real) de cada pergunta para o id real no banco.
    const saveLogicaCondicional = async (perguntasList: Pergunta[], idMap: Map<string, string>) => {
        const secaoIdSet = new Set(perguntasList.filter(p => p.tipo === 'secao').map(p => p.id))
        for (const p of perguntasList) {
            if (p.tipo !== 'selecao_unica') continue
            const realId = idMap.get(p.id)
            if (!realId) continue

            if (!p.logica_condicional || Object.keys(p.logica_condicional).length === 0) {
                await supabase.from('formulario_perguntas').update({ logica_condicional: null }).eq('id', realId)
                continue
            }

            const traduzida: Record<string, string> = {}
            for (const [optionIndex, target] of Object.entries(p.logica_condicional)) {
                if (target === 'enviar') {
                    traduzida[optionIndex] = 'enviar'
                } else if (secaoIdSet.has(target)) {
                    traduzida[optionIndex] = idMap.get(target) || target
                }
                // Alvo inválido/removido (ex: seção excluída): a entrada é
                // descartada, caindo no comportamento padrão (continuar).
            }
            await supabase.from('formulario_perguntas').update({ logica_condicional: traduzida }).eq('id', realId)
        }
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

        // Sub-aba só existe em formulário direcionado — sem "Quem Recebe" não
        // há sobre quem montar a visualização de competências.
        const subabaEfetiva = quemRecebe.length > 0 && gerarSubaba

        // Vira true se alguma gravação só passou depois de tirar as colunas
        // da migração 20260825 — o formulário foi salvo, mas sem os extras.
        let salvouSemExtras = false

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
            const { error: updateError, degradado: updateDegradado } = await gravarComFallback(
                (payload) => supabase.from('formularios').update(payload).eq('id', initialData.id!).select('id').maybeSingle(),
                {
                    titulo,
                    descricao,
                    data_prazo: localDatetimeInputToIso(dataPrazo),
                    tipo_formulario: tipoFormulario,
                    pagina_destino: paginaDestino || null,
                    banner_url: finalBannerUrl,
                    gerar_subaba: subabaEfetiva,
                },
            )
            salvouSemExtras = salvouSemExtras || updateDegradado

            if (updateError) {
                toast.error("Erro ao atualizar formulário: " + mensagemErroGravacao(updateError))
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
            const idMap = new Map<string, string>()
            for (let i = 0; i < validPerguntas.length; i++) {
                const p = validPerguntas[i]
                const payload = {
                    titulo: p.titulo,
                    descricao: p.descricao || null,
                    tipo: p.tipo,
                    opcoes: p.opcoes,
                    obrigatoria: p.obrigatoria,
                    ordem: i + 1,
                    competencia: p.tipo === 'escala' ? (p.competencia?.trim() || null) : null,
                    permite_nao_avaliar: p.tipo === 'escala' ? !!p.permite_nao_avaliar : false,
                }
                if (p.id && isUuid(p.id) && existingIds.has(p.id)) {
                    const { error: upErr, degradado: upDegradado } = await gravarComFallback(
                        (corpo) => supabase.from('formulario_perguntas').update(corpo).eq('id', p.id).select('id').maybeSingle(),
                        payload,
                    )
                    salvouSemExtras = salvouSemExtras || upDegradado
                    if (upErr) {
                        toast.error('Erro ao atualizar pergunta: ' + mensagemErroGravacao(upErr))
                        setLoading(false)
                        return
                    }
                    idMap.set(p.id, p.id)
                    keptIds.push(p.id)
                } else {
                    const { data: insData, error: insErr, degradado: insDegradado } = await gravarComFallback<{ id: string }>(
                        (corpo) => supabase.from('formulario_perguntas').insert(corpo).select('id').single(),
                        { formulario_id: initialData.id!, ...payload },
                    )
                    salvouSemExtras = salvouSemExtras || insDegradado
                    if (insErr || !insData) {
                        toast.error('Erro ao criar pergunta: ' + mensagemErroGravacao(insErr))
                        setLoading(false)
                        return
                    }
                    idMap.set(p.id, insData.id)
                }
            }

            const toDelete = Array.from(existingIds).filter(id => !keptIds.includes(id))
            if (toDelete.length > 0) {
                await supabase.from('formulario_perguntas').delete().in('id', toDelete)
            }

            await saveLogicaCondicional(validPerguntas, idMap)
            try {
                await saveFormularioPublico(initialData.id, { quemResponde, quemRecebe })
            } catch (err: any) {
                toast.error(err?.message || 'Erro ao salvar o público do formulário.')
                setLoading(false)
                return
            }

            toast.success("Formulário atualizado com sucesso!")
            avisarSemExtras(salvouSemExtras)
        } else {
            const { data: formData, error: formError, degradado: formDegradado } = await gravarComFallback<{ id: string }>(
                (payload) => supabase.from('formularios').insert(payload).select().single(),
                {
                    titulo,
                    descricao,
                    status,
                    data_prazo: localDatetimeInputToIso(dataPrazo),
                    data_prazo_original: localDatetimeInputToIso(dataPrazo),
                    data_inicio: status === 'ativo' ? new Date().toISOString() : null,
                    tipo_formulario: tipoFormulario,
                    pagina_destino: paginaDestino || null,
                    banner_url: finalBannerUrl,
                    gerar_subaba: subabaEfetiva,
                },
            )
            salvouSemExtras = salvouSemExtras || formDegradado

            if (formError || !formData) {
                toast.error("Erro ao criar formulário: " + mensagemErroGravacao(formError))
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
                competencia: p.tipo === 'escala' ? (p.competencia?.trim() || null) : null,
                permite_nao_avaliar: p.tipo === 'escala' ? !!p.permite_nao_avaliar : false,
            }))

            const { data: insertedPerguntas, error: perguntasError, degradado: perguntasDegradado } = await gravarComFallback<{ id: string }[]>(
                (payload) => supabase.from('formulario_perguntas').insert(payload).select('id'),
                perguntasToInsert,
            )
            salvouSemExtras = salvouSemExtras || perguntasDegradado

            if (perguntasError || !insertedPerguntas) {
                toast.error('Erro ao criar perguntas: ' + mensagemErroGravacao(perguntasError))
                setLoading(false)
                return
            }

            // O Postgres preserva a ordem de um INSERT em lote, então o i-ésimo
            // registro retornado corresponde ao i-ésimo item enviado.
            const idMap = new Map<string, string>()
            validPerguntas.forEach((p, i) => idMap.set(p.id, insertedPerguntas[i].id))
            await saveLogicaCondicional(validPerguntas, idMap)
            try {
                await saveFormularioPublico(formData.id, { quemResponde, quemRecebe })
            } catch (err: any) {
                toast.error(err?.message || 'Erro ao salvar o público do formulário.')
                setLoading(false)
                return
            }

            toast.success("Formulário criado com sucesso!")
            avisarSemExtras(salvouSemExtras)
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

                <Tabs defaultValue="detalhes" className="w-full min-w-0">
                    <div className="px-8">
                        <TabsList className="bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl w-full">
                            <TabsTrigger value="detalhes" className="flex-1 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white font-semibold text-xs">
                                <FileEdit className="h-3.5 w-3.5 mr-1.5" /> Detalhes
                            </TabsTrigger>
                            <TabsTrigger value="publico" className="flex-1 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white font-semibold text-xs">
                                <Users className="h-3.5 w-3.5 mr-1.5" /> Público
                            </TabsTrigger>
                        </TabsList>
                    </div>

                <TabsContent value="detalhes" className="px-8 pb-4 space-y-6 max-h-[60vh] min-w-0 overflow-y-auto overflow-x-hidden custom-scrollbar mt-4">
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
                                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatoRichText('descricao-textarea', 'bold')} title="Negrito">
                                        <Bold className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onMouseDown={(e) => e.preventDefault()} onClick={() => aplicarFormatoRichText('descricao-textarea', 'italic')} title="Itálico">
                                        <Italic className="h-3.5 w-3.5" />
                                    </Button>
                                </div>
                            </div>
                            <RichTextInput
                                id="descricao-textarea"
                                placeholder="Descreva o objetivo do formulário..."
                                multiline
                                className="block w-full bg-transparent border border-slate-200 dark:border-slate-700 rounded-xl min-h-[80px] px-3 py-2 text-sm focus:ring-2 focus:ring-violet-500"
                                value={descricao}
                                onChange={setDescricao}
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
                                        secoes={perguntas.filter(x => x.tipo === 'secao' && x.id !== p.id)}
                                        updateLogicaCondicional={updateLogicaCondicional}
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
                </TabsContent>

                <TabsContent value="publico" className="px-8 pb-4 space-y-6 max-h-[60vh] min-w-0 overflow-y-auto overflow-x-hidden custom-scrollbar mt-4">
                    <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Por padrão, o formulário é comum: aparece para <strong>Todos</strong> e cada resposta é sobre o próprio respondente
                        (<strong>Ninguém</strong> é recebido). Se você selecionar cargo + núcleo em qualquer uma das seções abaixo, a lógica muda.
                    </p>

                    <div className="space-y-2">
                        <label className="text-sm font-bold text-slate-900 dark:text-slate-200">1. Quem Responde</label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Quem vê e pode preencher este formulário. Cada grupo é um par Cargo + Núcleo — qualquer pessoa que bata com algum dos grupos vê o formulário.
                        </p>
                        <PublicoParesEditor pares={quemResponde} onChange={setQuemResponde} defaultLabel="Todos" addLabel="Restringir a um grupo" colaboradores={colaboradores} />
                    </div>

                    <div className="space-y-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                        <label className="text-sm font-bold text-slate-900 dark:text-slate-200 mt-4 block">2. Quem Recebe</label>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                            Sobre quem o formulário é respondido. Se preenchido, cada colaborador que bate com algum dos grupos vira uma aba de preenchimento
                            separada para quem está respondendo (a própria pessoa nunca aparece como aba de si mesma).
                        </p>
                        <PublicoParesEditor pares={quemRecebe} onChange={setQuemRecebe} defaultLabel="Ninguém" addLabel="Direcionar a um grupo" colaboradores={colaboradores} />
                    </div>

                    {quemRecebe.length > 0 && (
                        <div className="space-y-2 pt-2 border-t border-dashed border-slate-200 dark:border-slate-700">
                            <label className="text-sm font-bold text-slate-900 dark:text-slate-200 mt-4 block">3. Sub-aba em Performance</label>
                            <div className="flex items-start gap-3 bg-violet-50/50 dark:bg-violet-500/5 border border-violet-100 dark:border-violet-500/20 rounded-xl px-4 py-3">
                                <Switch checked={gerarSubaba} onCheckedChange={setGerarSubaba} className="mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-slate-800 dark:text-slate-200">Criar sub-aba deste formulário</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Quem é avaliado passa a ver, dentro de Performance, uma sub-aba com as notas por competência
                                        (média, nº de avaliações, evolução no tempo e detalhamento) — sem quantidade de projetos.
                                        Defina a <strong>competência</strong> de cada pergunta de escala na aba Detalhes.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </TabsContent>
                </Tabs>

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
