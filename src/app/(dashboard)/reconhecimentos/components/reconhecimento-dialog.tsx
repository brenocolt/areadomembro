"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { api, mensagemDeErro } from "@/lib/reconhecimentos/cliente"
import { NUCLEOS } from "@/lib/reconhecimentos/constantes"
import { hojeISO } from "@/lib/reconhecimentos/datas"
import type { Reconhecimento, TipoReconhecimento } from "@/lib/reconhecimentos/tipos"
import type { ColaboradorOpcao, ProjetoOpcao } from "../use-reconhecimentos"

interface Props {
    open: boolean
    onOpenChange: (aberto: boolean) => void
    tipos: TipoReconhecimento[]
    projetos: ProjetoOpcao[]
    colaboradores: ColaboradorOpcao[]
    nucleosElegiveis: string[]
    /** Quando informado, o diálogo edita este reconhecimento (o tipo não muda). */
    editando?: Reconhecimento | null
    onSalvo: () => void
}

interface Formulario {
    tipoId: string
    data: string
    projetoId: string
    numeroRg: string
    colaboradorId: string
    nucleo: string
    periodo: string
    observacoes: string
}

const vazio = (tipoId = ""): Formulario => ({ tipoId, data: hojeISO(), projetoId: "", numeroRg: "", colaboradorId: "", nucleo: "", periodo: "", observacoes: "" })

const doReconhecimento = (r: Reconhecimento): Formulario => ({
    tipoId: r.tipo_id, data: r.data_reconhecimento, projetoId: r.projeto_id ?? "", numeroRg: r.numero_rg ? String(r.numero_rg) : "",
    colaboradorId: r.colaborador_id ?? "", nucleo: r.nucleo ?? "", periodo: r.periodo_referencia?.slice(0, 7) ?? "", observacoes: r.observacoes ?? "",
})

export function ReconhecimentoDialog({ open, onOpenChange, tipos, projetos, colaboradores, nucleosElegiveis, editando, onSalvo }: Props) {
    const [f, setF] = useState<Formulario>(vazio())
    const [salvando, setSalvando] = useState(false)
    const [sugestao, setSugestao] = useState<number | null>(null)
    const rgEditadoPeloUsuario = useRef(false)
    const edicao = !!editando

    // Reinicia o formulário sempre que o diálogo abre.
    useEffect(() => {
        if (!open) return
        rgEditadoPeloUsuario.current = false
         
        setF(editando ? doReconhecimento(editando) : vazio())
        setSugestao(null)
    }, [open, editando])

    const tipo = tipos.find(t => t.id === f.tipoId)

    // Sugestão do próximo número da RG do projeto escolhido (a pessoa pode corrigir).
    useEffect(() => {
        if (!open || tipo?.escopo !== "projeto" || !f.projetoId) return
        let cancelado = false
        api<{ proximo: number }>(`/api/reconhecimentos/proximo-rg?projeto_id=${encodeURIComponent(f.projetoId)}`)
            .then(r => {
                if (cancelado) return
                setSugestao(r.proximo)
                if (!edicao && !rgEditadoPeloUsuario.current) setF(atual => ({ ...atual, numeroRg: String(r.proximo) }))
            })
            .catch(() => { if (!cancelado) setSugestao(null) })
        return () => { cancelado = true }
    }, [open, tipo?.escopo, f.projetoId, edicao])

    const set = (parcial: Partial<Formulario>) => setF(atual => ({ ...atual, ...parcial }))

    async function salvar() {
        if (!tipo) { toast.error("Selecione o tipo de reconhecimento."); return }
        const corpo = {
            tipo_id: tipo.id, data_reconhecimento: f.data,
            projeto_id: tipo.escopo === "projeto" ? f.projetoId : undefined,
            numero_rg: tipo.escopo === "projeto" ? f.numeroRg : undefined,
            colaborador_id: tipo.escopo === "colaborador" ? f.colaboradorId : undefined,
            nucleo: tipo.escopo === "nucleo" ? f.nucleo : undefined,
            periodo_referencia: tipo.usa_periodo ? f.periodo || undefined : undefined,
            observacoes: f.observacoes,
        }
        setSalvando(true)
        try {
            if (editando) {
                const r = await api<{ alterado: boolean; geradas: number }>(`/api/reconhecimentos/${editando.id}`, "PUT", corpo)
                toast.success(r.alterado ? "Reconhecimento atualizado." : "Nenhuma alteração para salvar.")
            } else {
                const r = await api<{ geradas: number }>("/api/reconhecimentos", "POST", corpo)
                toast.success(r.geradas > 0 ? `Reconhecimento registrado. ${r.geradas} bonificação(ões) gerada(s).` : "Reconhecimento registrado.")
            }
            onOpenChange(false)
            onSalvo()
        } catch (e) {
            toast.error(mensagemDeErro(e, "Não foi possível salvar o reconhecimento."))
        } finally {
            setSalvando(false)
        }
    }

    const tiposAtivos = tipos.filter(t => t.ativo || t.id === editando?.tipo_id)
    const nucleos = NUCLEOS.filter(n => nucleosElegiveis.includes(n) || n === editando?.nucleo)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>{edicao ? "Editar reconhecimento" : "Registrar reconhecimento"}</DialogTitle>
                    <DialogDescription>
                        {edicao ? "Toda alteração fica registrada no histórico (quem alterou, quando e o que mudou)." : "Os campos mudam conforme o tipo escolhido."}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Tipo de reconhecimento *</Label>
                        {edicao ? (
                            <Input value={tipo?.nome ?? ""} disabled />
                        ) : (
                            <SearchableSelect value={f.tipoId} onValueChange={v => { rgEditadoPeloUsuario.current = false; setF({ ...vazio(v), data: f.data, observacoes: f.observacoes }) }}
                                options={tiposAtivos.map(t => ({ value: t.id, label: t.nome }))} placeholder="Selecione o tipo" />
                        )}
                    </div>

                    {tipo && (
                        <>
                            {tipo.escopo === "projeto" && (
                                <>
                                    <div className="space-y-1.5">
                                        <Label>Projeto *</Label>
                                        <SearchableSelect value={f.projetoId} onValueChange={v => { rgEditadoPeloUsuario.current = false; set({ projetoId: v }) }}
                                            options={projetos.map(p => ({ value: p.id, label: p.nome }))} placeholder="Selecione o projeto" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="rec-numero-rg">Número da RG *</Label>
                                        <Input id="rec-numero-rg" type="number" min={1} step={1} value={f.numeroRg}
                                            onChange={e => { rgEditadoPeloUsuario.current = true; set({ numeroRg: e.target.value }) }} placeholder="Ex.: 5" />
                                        {sugestao !== null && (
                                            <p className="text-xs text-muted-foreground" data-testid="sugestao-rg">
                                                Sugestão: <strong>{sugestao}ª RG</strong> deste projeto. O número não pode se repetir no mesmo projeto.
                                            </p>
                                        )}
                                        {sugestao !== null && Number(f.numeroRg) > sugestao && (
                                            <p className="text-xs text-amber-600 dark:text-amber-400" data-testid="aviso-salto-rg">
                                                Atenção: o número informado pula a sequência (o próximo seria {sugestao}). Isso é permitido, mas confira.
                                            </p>
                                        )}
                                    </div>
                                </>
                            )}

                            {tipo.escopo === "colaborador" && (
                                <div className="space-y-1.5">
                                    <Label>Colaborador *</Label>
                                    <SearchableSelect value={f.colaboradorId} onValueChange={v => set({ colaboradorId: v })}
                                        options={colaboradores.map(c => ({ value: c.id, label: c.nome }))} placeholder="Selecione o colaborador" />
                                </div>
                            )}

                            {tipo.escopo === "nucleo" && (
                                <div className="space-y-1.5">
                                    <Label>Núcleo *</Label>
                                    <SearchableSelect value={f.nucleo} onValueChange={v => set({ nucleo: v })}
                                        options={nucleos.map(n => ({ value: n, label: n }))} placeholder="Selecione o núcleo" />
                                </div>
                            )}

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                    <Label htmlFor="rec-data">Data do reconhecimento *</Label>
                                    <Input id="rec-data" type="date" max={hojeISO()} value={f.data} onChange={e => set({ data: e.target.value })} />
                                </div>
                                {tipo.usa_periodo && (
                                    <div className="space-y-1.5">
                                        <Label htmlFor="rec-periodo">Período de referência</Label>
                                        <Input id="rec-periodo" type="month" value={f.periodo} onChange={e => set({ periodo: e.target.value })} />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="rec-obs">Observações</Label>
                                <Textarea id="rec-obs" rows={3} maxLength={2000} value={f.observacoes} onChange={e => set({ observacoes: e.target.value })} />
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
                    <Button onClick={salvar} disabled={salvando || !tipo}>{salvando ? "Salvando..." : edicao ? "Salvar alterações" : "Registrar"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
