"use client"

import { useEffect, useMemo, useState } from "react"
import { Plus, X } from "lucide-react"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, mensagemDeErro } from "@/lib/reconhecimentos/cliente"
import { JUSTIFICATIVAS_CANCELAMENTO, STATUS_CLASS, STATUS_LABEL } from "@/lib/reconhecimentos/constantes"
import { formatarData, formatarMoeda } from "@/lib/reconhecimentos/datas"
import { adiantadoReconhecimento, type Bonificacao, type EventoBonificacao, type Reconhecimento } from "@/lib/reconhecimentos/tipos"

interface Props {
    bonificacao: Bonificacao | null
    reconhecimentos: Reconhecimento[]
    onOpenChange: (open: boolean) => void
    onAtualizado: () => void
}

export function BonificacaoDetalhe({ bonificacao, reconhecimentos, onOpenChange, onAtualizado }: Props) {
    const [eventos, setEventos] = useState<EventoBonificacao[]>([])
    const [entregarOpen, setEntregarOpen] = useState(false)
    const [obsEntrega, setObsEntrega] = useState("")
    const [cancelarOpen, setCancelarOpen] = useState(false)
    const [motivo, setMotivo] = useState("")
    const [detalheMotivo, setDetalheMotivo] = useState("")
    const [nomesEntrega, setNomesEntrega] = useState<string[]>([])
    const [nomeEntregaAtual, setNomeEntregaAtual] = useState("")
    const [enviando, setEnviando] = useState(false)

    const bonificacaoId = bonificacao?.id
    useEffect(() => {
        if (!bonificacaoId) { setEventos([]); return }
        let cancelado = false
        api<{ eventos: EventoBonificacao[] }>(`/api/reconhecimentos/bonificacoes/${bonificacaoId}/eventos`)
            .then((r) => { if (!cancelado) setEventos(r.eventos) })
            .catch(() => { if (!cancelado) setEventos([]) })
        return () => { cancelado = true }
    }, [bonificacaoId])

    // Projeto: reconhecimentos do mesmo projeto até a liberação; pessoa: todos da pessoa (como no original).
    const historico = useMemo(() => {
        if (!bonificacao) return []
        return reconhecimentos
            .filter((r) =>
                bonificacao.projeto_id
                    ? r.projeto_id === bonificacao.projeto_id && r.data <= bonificacao.liberada_em
                    : bonificacao.pessoa_nome && r.pessoa_nome === bonificacao.pessoa_nome,
            )
            .sort((a, b) => a.data.localeCompare(b.data))
    }, [reconhecimentos, bonificacao])

    const historicoProjeto = bonificacao?.projeto_id
        ? historico.filter((r) => r.reconhecimento_tipos?.escopo === "projeto")
        : historico
    const totalAdiantados = historicoProjeto.filter(adiantadoReconhecimento).length

    const pessoasConhecidas = useMemo(() => {
        const set = new Set<string>()
        reconhecimentos.forEach((r) => r.pessoa_nome && set.add(r.pessoa_nome))
        return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))
    }, [reconhecimentos])

    const adicionarNomeEntrega = () => {
        const n = nomeEntregaAtual.trim()
        if (!n) return
        if (!nomesEntrega.some((x) => x.toLowerCase() === n.toLowerCase())) {
            setNomesEntrega([...nomesEntrega, n])
        }
        setNomeEntregaAtual("")
    }

    const entregar = async () => {
        if (!bonificacao) return
        const nomes = [...nomesEntrega]
        const pendente = nomeEntregaAtual.trim()
        if (pendente && !nomes.some((x) => x.toLowerCase() === pendente.toLowerCase())) nomes.push(pendente)
        setEnviando(true)
        try {
            await api(`/api/reconhecimentos/bonificacoes/${bonificacao.id}/entregar`, "POST", { nomes, observacao: obsEntrega })
            toast.success("Bonificação marcada como entregue")
            setEntregarOpen(false)
            setObsEntrega("")
            setNomesEntrega([])
            setNomeEntregaAtual("")
            onAtualizado()
            onOpenChange(false)
        } catch (e) {
            toast.error(mensagemDeErro(e, "Erro ao entregar"))
        } finally {
            setEnviando(false)
        }
    }

    const cancelar = async () => {
        if (!bonificacao) return
        if (!motivo) return toast.error("Selecione a justificativa")
        if (motivo === "Outro" && !detalheMotivo.trim()) return toast.error("Descreva a justificativa")
        setEnviando(true)
        try {
            await api(`/api/reconhecimentos/bonificacoes/${bonificacao.id}/cancelar`, "POST", { motivo, detalhe: detalheMotivo })
            toast.success("Bonificação cancelada")
            setCancelarOpen(false)
            setMotivo("")
            setDetalheMotivo("")
            onAtualizado()
            onOpenChange(false)
        } catch (e) {
            toast.error(mensagemDeErro(e, "Erro ao cancelar"))
        } finally {
            setEnviando(false)
        }
    }

    return (
        <>
            <Sheet open={!!bonificacao} onOpenChange={onOpenChange}>
                <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
                    {bonificacao && (
                        <>
                            <SheetHeader>
                                <SheetTitle>{bonificacao.projeto_nome || bonificacao.pessoa_nome || "Bonificação"}</SheetTitle>
                            </SheetHeader>

                            <div className="mt-6 space-y-6 px-4 pb-6">
                                <div className="space-y-2 rounded-lg border border-border p-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Status</span>
                                        <Badge className={STATUS_CLASS[bonificacao.status]} variant="secondary">
                                            {STATUS_LABEL[bonificacao.status]}
                                        </Badge>
                                    </div>
                                    {bonificacao.projeto_nome && <Linha rotulo="Projeto" valor={bonificacao.projeto_nome} />}
                                    {bonificacao.nucleo_impacto && <Linha rotulo="Núcleo" valor={bonificacao.nucleo_impacto} />}
                                    <Linha rotulo="Tipo de reconhecimento" valor={bonificacao.tipo_nome} />
                                    <Linha rotulo="Regra atingida" valor={bonificacao.motivo || bonificacao.regra_nome} />
                                    <Linha rotulo="Bonificação" valor={bonificacao.descricao_premiacao || formatarMoeda(Number(bonificacao.valor))} />
                                    <Linha rotulo="Liberada em" valor={formatarData(bonificacao.liberada_em)} />
                                    {bonificacao.entregue_para && <Linha rotulo="Entregue para" valor={bonificacao.entregue_para} />}
                                    {bonificacao.prazo_limite && <Linha rotulo="Prazo" valor={formatarData(bonificacao.prazo_limite)} />}
                                    {bonificacao.justificativa_cancelamento && (
                                        <Linha rotulo="Justificativa" valor={bonificacao.justificativa_cancelamento} />
                                    )}
                                </div>

                                <div>
                                    <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                        <h4 className="text-sm font-semibold">Histórico que originou a bonificação</h4>
                                        {bonificacao.projeto_id && (
                                            <span className="text-xs text-muted-foreground">
                                                {historicoProjeto.length} no total · {totalAdiantados} adiantado(s)
                                            </span>
                                        )}
                                    </div>
                                    <ul className="space-y-1.5 text-sm">
                                        {historicoProjeto.map((r) => (
                                            <li key={r.id} className="flex gap-2 text-muted-foreground">
                                                <span className="tabular-nums">{formatarData(r.data)}</span>
                                                <span>—</span>
                                                <span className="text-foreground">Reconhecido</span>
                                                <Badge variant="secondary" className="h-5">
                                                    {adiantadoReconhecimento(r) ? "Adiantado" : "Normal"}
                                                </Badge>
                                                {r.nucleo_impacto && <span>· {r.nucleo_impacto}</span>}
                                            </li>
                                        ))}
                                        {historicoProjeto.length === 0 && <li className="text-muted-foreground">Sem registros.</li>}
                                    </ul>
                                </div>

                                <div>
                                    <h4 className="mb-2 text-sm font-semibold">Mudanças de status</h4>
                                    <ul className="space-y-1.5 border-l border-border pl-4 text-sm">
                                        <li className="text-muted-foreground"><span className="tabular-nums">{formatarData(bonificacao.created_at)}</span> — <span className="text-foreground">Criada</span></li>
                                        <li className="text-muted-foreground"><span className="tabular-nums">{formatarData(bonificacao.liberada_em)}</span> — <span className="text-foreground">Disponível</span></li>
                                        {eventos.filter((e) => e.evento !== "criada").map((e) => (
                                            <li key={e.id} className="text-muted-foreground">
                                                <span className="tabular-nums">{formatarData(e.created_at)}</span> —{" "}
                                                <span className="text-foreground">{STATUS_LABEL[e.evento] || e.evento}</span>
                                                {e.detalhe ? ` — ${e.detalhe}` : ""}
                                                {e.usuario ? ` (${e.usuario})` : ""}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                {(bonificacao.status === "disponivel" || bonificacao.status === "expirada") && (
                                    <div className="flex flex-wrap gap-2">
                                        <Button onClick={() => setEntregarOpen(true)}>Marcar como entregue</Button>
                                        <Button variant="outline" onClick={() => setCancelarOpen(true)}>Cancelar bonificação</Button>
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </SheetContent>
            </Sheet>

            <Dialog open={entregarOpen} onOpenChange={setEntregarOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Marcar como entregue</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label>Quem recebeu? (opcional — um ou mais nomes)</Label>
                            <div className="flex gap-2">
                                <Input
                                    list="pessoas-entrega"
                                    value={nomeEntregaAtual}
                                    onChange={(e) => setNomeEntregaAtual(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                            e.preventDefault()
                                            adicionarNomeEntrega()
                                        }
                                    }}
                                    placeholder="Pesquisar ou digitar o nome..."
                                />
                                <Button type="button" variant="outline" size="icon" onClick={adicionarNomeEntrega} aria-label="Adicionar nome">
                                    <Plus className="h-4 w-4" />
                                </Button>
                            </div>
                            <datalist id="pessoas-entrega">
                                {pessoasConhecidas.map((n) => <option key={n} value={n} />)}
                            </datalist>
                            {nomesEntrega.length > 0 && (
                                <div className="flex flex-wrap gap-1.5 pt-1">
                                    {nomesEntrega.map((n) => (
                                        <Badge key={n} variant="secondary" className="gap-1 pr-1">
                                            {n}
                                            <button
                                                type="button"
                                                onClick={() => setNomesEntrega(nomesEntrega.filter((x) => x !== n))}
                                                aria-label={`Remover ${n}`}
                                                className="rounded-full p-0.5 hover:bg-muted"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                                Ex.: se 3 consultores pediram, adicione os 3 nomes. Esse controle fica salvo no histórico da bonificação.
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Observação (opcional)</Label>
                            <Textarea value={obsEntrega} onChange={(e) => setObsEntrega(e.target.value)} rows={3} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEntregarOpen(false)}>Voltar</Button>
                        <Button onClick={entregar} disabled={enviando}>Confirmar entrega</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={cancelarOpen} onOpenChange={setCancelarOpen}>
                <DialogContent>
                    <DialogHeader><DialogTitle>Cancelar bonificação</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label>Justificativa do cancelamento</Label>
                            <Select value={motivo} onValueChange={setMotivo}>
                                <SelectTrigger><SelectValue placeholder="Selecionar justificativa" /></SelectTrigger>
                                <SelectContent>
                                    {JUSTIFICATIVAS_CANCELAMENTO.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Detalhes {motivo === "Outro" ? "(obrigatório)" : "(opcional)"}</Label>
                            <Textarea value={detalheMotivo} onChange={(e) => setDetalheMotivo(e.target.value)} rows={3} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setCancelarOpen(false)}>Voltar</Button>
                        <Button variant="destructive" onClick={cancelar} disabled={enviando}>Confirmar cancelamento</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}

function Linha({ rotulo, valor }: { rotulo: string; valor?: string | null }) {
    if (!valor) return null
    return (
        <div className="flex items-start justify-between gap-4 text-sm">
            <span className="text-muted-foreground">{rotulo}</span>
            <span className="text-right font-medium">{valor}</span>
        </div>
    )
}
