"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Pencil, Plus, XCircle } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MultiSelectBusca } from "@/components/ui/multi-select-busca"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { api, mensagemDeErro } from "@/lib/reconhecimentos/cliente"
import { SITUACOES_ENTREGA, SITUACAO_LABEL, STATUS_ACEITA_ENTREGAS } from "@/lib/reconhecimentos/constantes"
import { formatarData, hojeISO } from "@/lib/reconhecimentos/datas"
import { podeCancelar, podeConcluir } from "@/lib/reconhecimentos/motor"
import { sujeitoDe, textoPremiacao } from "@/lib/reconhecimentos/apresentacao"
import type { Bonificacao, DadosReconhecimentos, Entrega, EventoHistorico } from "@/lib/reconhecimentos/tipos"
import type { ColaboradorOpcao } from "../use-reconhecimentos"
import { LinhaDoTempo } from "./linha-do-tempo"
import { SituacaoBadge, StatusBadge } from "./status-badge"

interface Detalhe { bonificacao: Bonificacao; entregas: Entrega[]; historico: EventoHistorico[] }

interface Props {
    bonificacaoId: string | null
    onFechar: () => void
    dados: DadosReconhecimentos
    colaboradores: ColaboradorOpcao[]
    /** Chamado após qualquer alteração, para atualizar o quadro e os indicadores. */
    onAlterado: () => void
}

interface FormEntrega { situacao: string; solicitada_em: string; aprovada_em: string; entregue_em: string; observacao: string }

const formDe = (e?: Entrega): FormEntrega => ({
    situacao: e?.situacao ?? "solicitada", solicitada_em: e?.solicitada_em ?? hojeISO(), aprovada_em: e?.aprovada_em ?? "", entregue_em: e?.entregue_em ?? "", observacao: e?.observacao ?? "",
})

function CamposEntrega({ valor, onChange }: { valor: FormEntrega; onChange: (v: FormEntrega) => void }) {
    const set = (p: Partial<FormEntrega>) => onChange({ ...valor, ...p })
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
                <Label>Situação</Label>
                <SearchableSelect value={valor.situacao} onValueChange={v => set({ situacao: v })} options={SITUACOES_ENTREGA.map(s => ({ value: s, label: SITUACAO_LABEL[s] }))} />
            </div>
            <div className="space-y-1.5">
                <Label>Data da solicitação</Label>
                <Input type="date" max={hojeISO()} value={valor.solicitada_em} onChange={e => set({ solicitada_em: e.target.value })} aria-label="Data da solicitação" />
            </div>
            {valor.situacao !== "solicitada" && (
                <div className="space-y-1.5">
                    <Label>Data de aprovação</Label>
                    <Input type="date" max={hojeISO()} value={valor.aprovada_em} onChange={e => set({ aprovada_em: e.target.value })} aria-label="Data de aprovação" />
                </div>
            )}
            {valor.situacao === "entregue" && (
                <div className="space-y-1.5">
                    <Label>Data da entrega</Label>
                    <Input type="date" max={hojeISO()} value={valor.entregue_em} onChange={e => set({ entregue_em: e.target.value })} aria-label="Data da entrega" />
                </div>
            )}
            <div className="space-y-1.5 sm:col-span-2">
                <Label>Observação</Label>
                <Input value={valor.observacao} maxLength={1000} onChange={e => set({ observacao: e.target.value })} aria-label="Observação da entrega" />
            </div>
        </div>
    )
}

const corpoDe = (f: FormEntrega) => ({ situacao: f.situacao, solicitada_em: f.solicitada_em || null, aprovada_em: f.aprovada_em || null, entregue_em: f.entregue_em || null, observacao: f.observacao })

export function PainelBonificacao({ bonificacaoId, onFechar, dados, colaboradores, onAlterado }: Props) {
    const [detalhe, setDetalhe] = useState<Detalhe | null>(null)
    const [erro, setErro] = useState("")
    const [selecionados, setSelecionados] = useState<string[]>([])
    const [novo, setNovo] = useState<FormEntrega>(formDe())
    const [editando, setEditando] = useState<{ entrega: Entrega; form: FormEntrega } | null>(null)
    const [cancelando, setCancelando] = useState(false)
    const [justificativa, setJustificativa] = useState("")
    const [ocupado, setOcupado] = useState(false)

    const carregar = useCallback(async (id: string) => {
        try {
            const r = await api<Detalhe>(`/api/reconhecimentos/bonificacoes/${id}`)
            setDetalhe(r); setErro("")
        } catch (e) {
            setErro(mensagemDeErro(e, "Não foi possível carregar a bonificação."))
        }
    }, [])

    useEffect(() => {
        if (!bonificacaoId) return
        // Reinicia o estado local ao trocar de bonificação.
         
        setDetalhe(null); setSelecionados([]); setNovo(formDe()); setEditando(null); setCancelando(false); setJustificativa("")
        void carregar(bonificacaoId)
    }, [bonificacaoId, carregar])

    async function executar(acao: () => Promise<unknown>, sucesso: string) {
        if (!bonificacaoId) return
        setOcupado(true)
        try {
            await acao()
            toast.success(sucesso)
            await carregar(bonificacaoId)
            onAlterado()
        } catch (e) {
            toast.error(mensagemDeErro(e, "Não foi possível concluir a operação."))
        } finally {
            setOcupado(false)
        }
    }

    const b = detalhe?.bonificacao
    const entregas = detalhe?.entregas ?? []
    const jaNaBonificacao = new Set(entregas.map(e => e.colaborador_id))
    const opcoes = colaboradores.filter(c => !jaNaBonificacao.has(c.id)).map(c => ({ value: c.id, label: c.nome, hint: c.nucleo ?? undefined }))
    const aceitaEntregas = !!b && STATUS_ACEITA_ENTREGAS.includes(b.status)
    const concluir = podeConcluir(entregas)
    const cancelar = podeCancelar(entregas)

    return (
        <Sheet open={!!bonificacaoId} onOpenChange={o => { if (!o) onFechar() }}>
            <SheetContent className="w-full overflow-y-auto sm:max-w-xl" data-testid="painel-bonificacao">
                <SheetHeader>
                    <SheetTitle>{b ? sujeitoDe(b) : "Bonificação"}</SheetTitle>
                    <SheetDescription>{b ? `${b.tipo_nome} · ${b.motivo}` : "Carregando..."}</SheetDescription>
                </SheetHeader>

                {erro && <p className="px-4 text-sm text-destructive">{erro}</p>}

                {b && (
                    <div className="space-y-6 px-4 pb-8">
                        <dl className="grid grid-cols-2 gap-3 text-sm">
                            <div><dt className="text-muted-foreground">Status</dt><dd className="mt-0.5"><StatusBadge status={b.status} /></dd></div>
                            <div><dt className="text-muted-foreground">Premiação</dt><dd className="font-medium">{textoPremiacao(b)}</dd></div>
                            <div><dt className="text-muted-foreground">Data de liberação</dt><dd>{formatarData(b.liberada_em)}</dd></div>
                            <div><dt className="text-muted-foreground">Prazo para entrega</dt><dd>{b.prazo_limite ? formatarData(b.prazo_limite) : "Sem prazo"}</dd></div>
                            {b.status === "cancelada" && <div className="col-span-2"><dt className="text-muted-foreground">Justificativa do cancelamento</dt><dd>{b.justificativa_cancelamento}</dd></div>}
                        </dl>

                        {b.origem_alterada && (
                            <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                                <p>O reconhecimento que originou esta bonificação foi alterado depois da geração. A bonificação foi mantida; veja o histórico abaixo.</p>
                            </div>
                        )}

                        <section aria-label="Entregas por colaborador" className="space-y-3">
                            <h3 className="font-semibold">Controle de entrega por colaborador</h3>
                            {entregas.length === 0 ? (
                                <p className="text-sm text-muted-foreground">Nenhum colaborador vinculado ainda. O status do cartão não significa que alguém recebeu: registre cada pessoa abaixo.</p>
                            ) : (
                                <ul className="space-y-2" data-testid="lista-entregas">
                                    {entregas.map(e => (
                                        <li key={e.id} className="rounded-md border p-3 text-sm" data-testid="entrega">
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="font-medium">{e.colaborador_nome}</p>
                                                <div className="flex items-center gap-1">
                                                    <SituacaoBadge situacao={e.situacao} />
                                                    {aceitaEntregas && <Button variant="ghost" size="icon" aria-label={`Editar entrega de ${e.colaborador_nome}`} onClick={() => setEditando({ entrega: e, form: formDe(e) })}><Pencil className="h-4 w-4" /></Button>}
                                                </div>
                                            </div>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                Solicitada: {e.solicitada_em ? formatarData(e.solicitada_em) : "—"} · Aprovada: {e.aprovada_em ? formatarData(e.aprovada_em) : "—"} · Entregue: {e.entregue_em ? formatarData(e.entregue_em) : "—"}
                                            </p>
                                            {e.observacao && <p className="mt-1 text-xs">{e.observacao}</p>}
                                        </li>
                                    ))}
                                </ul>
                            )}

                            {aceitaEntregas ? (
                                <div className="space-y-3 rounded-md border border-dashed p-3">
                                    <Label>Adicionar colaboradores</Label>
                                    <MultiSelectBusca value={selecionados} onChange={setSelecionados} options={opcoes} placeholder="Selecione os colaboradores" searchPlaceholder="Buscar colaborador..." />
                                    {selecionados.length > 0 && <CamposEntrega valor={novo} onChange={setNovo} />}
                                    <Button size="sm" disabled={ocupado || selecionados.length === 0}
                                        onClick={() => executar(async () => {
                                            await api(`/api/reconhecimentos/bonificacoes/${b.id}/entregas`, "POST", { colaborador_ids: selecionados, ...corpoDe(novo) })
                                            setSelecionados([]); setNovo(formDe())
                                        }, "Colaborador(es) adicionado(s).")}>
                                        <Plus className="mr-1 h-4 w-4" />Adicionar
                                    </Button>
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">Esta bonificação está {b.status === "cancelada" ? "cancelada" : "expirada"} e não aceita novas entregas.</p>
                            )}
                        </section>

                        {(b.status === "disponivel" || b.status === "entregue") && (
                            <section className="space-y-2" aria-label="Ações da bonificação">
                                <div className="flex flex-wrap gap-2">
                                    {b.status === "disponivel" && (
                                        <Button disabled={ocupado || !concluir.ok} onClick={() => executar(() => api(`/api/reconhecimentos/bonificacoes/${b.id}/concluir`, "POST"), "Bonificação concluída.")}>
                                            <CheckCircle2 className="mr-2 h-4 w-4" />Concluir bonificação
                                        </Button>
                                    )}
                                    <Button variant="outline" className="text-destructive" disabled={ocupado || !cancelar.ok} onClick={() => setCancelando(true)}>
                                        <XCircle className="mr-2 h-4 w-4" />Cancelar bonificação
                                    </Button>
                                </div>
                                {b.status === "disponivel" && !concluir.ok && <p className="text-xs text-muted-foreground">{concluir.motivo}</p>}
                                {!cancelar.ok && <p className="text-xs text-muted-foreground">{cancelar.motivo}</p>}
                            </section>
                        )}

                        <section aria-label="Histórico da bonificação" className="space-y-3">
                            <h3 className="font-semibold">Histórico</h3>
                            <LinhaDoTempo eventos={detalhe?.historico ?? []} contexto={{ tipos: dados.tipos, bonificacoes: dados.bonificacoes }} />
                        </section>
                    </div>
                )}

                <Dialog open={!!editando} onOpenChange={o => { if (!o) setEditando(null) }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Entrega de {editando?.entrega.colaborador_nome}</DialogTitle>
                            <DialogDescription>A alteração fica registrada no histórico com data, hora e responsável.</DialogDescription>
                        </DialogHeader>
                        {editando && <CamposEntrega valor={editando.form} onChange={form => setEditando({ ...editando, form })} />}
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setEditando(null)}>Cancelar</Button>
                            <Button disabled={ocupado} onClick={() => {
                                const alvo = editando
                                if (!alvo || !b) return
                                void executar(async () => {
                                    await api(`/api/reconhecimentos/bonificacoes/${b.id}/entregas/${alvo.entrega.id}`, "PUT", corpoDe(alvo.form))
                                    setEditando(null)
                                }, "Entrega atualizada.")
                            }}>Salvar</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                <Dialog open={cancelando} onOpenChange={o => { if (!o) { setCancelando(false); setJustificativa("") } }}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Cancelar bonificação</DialogTitle>
                            <DialogDescription>A bonificação é mantida no histórico como cancelada.</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-1.5">
                            <Label htmlFor="rec-justificativa">Justificativa *</Label>
                            <Textarea id="rec-justificativa" rows={3} value={justificativa} onChange={e => setJustificativa(e.target.value)} />
                        </div>
                        <DialogFooter>
                            <Button variant="outline" onClick={() => setCancelando(false)}>Voltar</Button>
                            <Button variant="destructive" disabled={ocupado || justificativa.trim().length < 3} onClick={() => {
                                if (!b) return
                                void executar(async () => {
                                    await api(`/api/reconhecimentos/bonificacoes/${b.id}/cancelar`, "POST", { justificativa })
                                    setCancelando(false); setJustificativa("")
                                }, "Bonificação cancelada.")
                            }}>Cancelar bonificação</Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </SheetContent>
        </Sheet>
    )
}
