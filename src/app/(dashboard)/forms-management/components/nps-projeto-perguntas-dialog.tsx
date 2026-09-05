"use client"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Star, Users } from "lucide-react"
import { toast } from "sonner"
import type { CriterioEscala } from "@/components/forms/escala-picker"
import {
    GERENTE_CAMPOS, CONSULTOR_CAMPOS, loadNpsProjetoConfig, saveNpsProjetoConfig, resolverPergunta,
    type NpsProjetoConfig,
} from "@/lib/nps-projeto-config"

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
}

// Estado local de edição: por bloco (gerente/consultor) e campo, o título e
// os 5 critérios — já resolvidos (padrão + personalizado), prontos para
// edição direta.
type Edicao = Record<string, { titulo: string, criterios: Record<number, CriterioEscala>, obs?: string }>

function blocoParaEdicao(campos: { campo: string, tituloPadrao: string, obs?: string }[], config: NpsProjetoConfig, bloco: 'gerente' | 'consultor'): Edicao {
    const out: Edicao = {}
    for (const c of campos) {
        const resolvido = resolverPergunta(config, bloco, c.campo, c.tituloPadrao)
        out[c.campo] = { ...resolvido, obs: c.obs }
    }
    return out
}

function BlocoEditor({ titulo, icon, edicao, setCampo }: {
    titulo: string
    icon: React.ReactNode
    edicao: Edicao
    setCampo: (campo: string, patch: Partial<{ titulo: string, criterios: Record<number, CriterioEscala> }>) => void
}) {
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">{icon} {titulo}</h3>
            {Object.entries(edicao).map(([campo, d]) => (
                <div key={campo} className="bg-violet-50/50 dark:bg-white/5 border border-violet-100 dark:border-white/10 rounded-2xl p-4 space-y-3">
                    <Textarea
                        value={d.titulo}
                        onChange={(e) => setCampo(campo, { titulo: e.target.value })}
                        className="bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-xl text-sm min-h-[52px] resize-none"
                    />
                    {d.obs && <p className="text-[11px] text-slate-400 italic">{d.obs}</p>}
                    <div className="space-y-2">
                        <p className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Critério de cada nota</p>
                        {[1, 2, 3, 4, 5].map(v => {
                            const criterio = d.criterios[v] || {}
                            return (
                                <div key={v} className="flex items-start gap-2">
                                    <span className="text-xs font-bold text-violet-600 dark:text-violet-400 bg-violet-100 dark:bg-violet-500/20 rounded-full w-5 h-5 flex items-center justify-center shrink-0 mt-1.5">
                                        {v}
                                    </span>
                                    <div className="flex-1 space-y-1">
                                        <Input
                                            value={criterio.titulo || ''}
                                            onChange={(e) => setCampo(campo, { criterios: { ...d.criterios, [v]: { ...criterio, titulo: e.target.value } } })}
                                            className="h-8 text-xs bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg font-bold"
                                            placeholder={`Rótulo curto da nota ${v}`}
                                        />
                                        <Textarea
                                            value={criterio.descricao || ''}
                                            onChange={(e) => setCampo(campo, { criterios: { ...d.criterios, [v]: { ...criterio, descricao: e.target.value } } })}
                                            className="min-h-[36px] h-9 text-xs bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg resize-none py-1.5"
                                            placeholder="Descrição (opcional)"
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ))}
        </div>
    )
}

// Edita o texto de cada pergunta do NPS Projeto e o critério de 1 a 5 de
// cada uma — nos mesmos moldes do editor de perguntas de escala do motor
// genérico de formulários (ver create-form-dialog.tsx). As RESPOSTAS
// continuam gravadas em avaliacoes_nps exatamente como hoje; só o texto
// exibido em /nps-projeto muda.
export function NpsProjetoPerguntasDialog({ open, onOpenChange }: Props) {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [gerente, setGerente] = useState<Edicao>({})
    const [consultor, setConsultor] = useState<Edicao>({})

    useEffect(() => {
        if (!open) return
        setLoading(true)
        loadNpsProjetoConfig().then(config => {
            setGerente(blocoParaEdicao(GERENTE_CAMPOS, config, 'gerente'))
            setConsultor(blocoParaEdicao(CONSULTOR_CAMPOS, config, 'consultor'))
            setLoading(false)
        })
    }, [open])

    const setCampoGerente = (campo: string, patch: Partial<{ titulo: string, criterios: Record<number, CriterioEscala> }>) =>
        setGerente(prev => ({ ...prev, [campo]: { ...prev[campo], ...patch } }))
    const setCampoConsultor = (campo: string, patch: Partial<{ titulo: string, criterios: Record<number, CriterioEscala> }>) =>
        setConsultor(prev => ({ ...prev, [campo]: { ...prev[campo], ...patch } }))

    const handleSave = async () => {
        setSaving(true)
        try {
            const config: NpsProjetoConfig = {
                gerente: Object.fromEntries(Object.entries(gerente).map(([campo, d]) => [campo, {
                    titulo: d.titulo,
                    criterios: { 1: d.criterios[1] || {}, 2: d.criterios[2] || {}, 3: d.criterios[3] || {}, 4: d.criterios[4] || {}, 5: d.criterios[5] || {} },
                }])),
                consultor: Object.fromEntries(Object.entries(consultor).map(([campo, d]) => [campo, {
                    titulo: d.titulo,
                    criterios: { 1: d.criterios[1] || {}, 2: d.criterios[2] || {}, 3: d.criterios[3] || {}, 4: d.criterios[4] || {}, 5: d.criterios[5] || {} },
                }])),
            }
            await saveNpsProjetoConfig(config)
            toast.success('Perguntas do NPS Projeto atualizadas!')
            onOpenChange(false)
        } catch (err: any) {
            toast.error(err?.message || 'Erro ao salvar as perguntas do NPS Projeto.')
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-3xl p-0 overflow-hidden text-slate-900 dark:text-white">
                <div className="px-8 pt-8 pb-4">
                    <DialogHeader>
                        <DialogTitle className="text-2xl font-bold">Editar Perguntas do NPS Projetos</DialogTitle>
                        <DialogDescription className="text-slate-500 font-medium">
                            Muda o texto de cada pergunta e o critério de cada nota (1 a 5). As respostas continuam gravadas normalmente — nada se perde.
                        </DialogDescription>
                    </DialogHeader>
                </div>

                <div className="px-8 pb-4 space-y-8 max-h-[62vh] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="p-8 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
                            <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
                        </div>
                    ) : (
                        <>
                            <BlocoEditor titulo="NPS Gerente" icon={<Users className="h-4 w-4 text-violet-500" />} edicao={gerente} setCampo={setCampoGerente} />
                            <BlocoEditor titulo="NPS Consultor" icon={<Star className="h-4 w-4 text-violet-500" />} edicao={consultor} setCampo={setCampoConsultor} />
                        </>
                    )}
                </div>

                <div className="px-8 py-5 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3 bg-slate-50/50 dark:bg-black/10">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} className="rounded-xl font-bold h-11 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-800">
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={loading || saving} className="rounded-xl font-bold h-11 px-8 bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20">
                        {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                        {saving ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
