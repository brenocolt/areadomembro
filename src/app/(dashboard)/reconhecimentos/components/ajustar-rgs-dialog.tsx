"use client"

import { useMemo, useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { api, mensagemDeErro } from "@/lib/reconhecimentos/cliente"
import { OBS_RG_ANTERIOR } from "@/lib/reconhecimentos/constantes"
import { adiantadoReconhecimento, type Reconhecimento } from "@/lib/reconhecimentos/tipos"

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    reconhecimentos: Reconhecimento[]
    onSalvo: () => void
}

/**
 * Ajusta a contagem de RGs adiantadas anteriores ao sistema de um projeto,
 * inserindo ou removendo registros históricos e recalculando as bonificações
 * (a gravação e o motor rodam no servidor).
 */
export function AjustarRgsDialog({ open, onOpenChange, reconhecimentos, onSalvo }: Props) {
    const [projetoId, setProjetoId] = useState("")
    const [quantidade, setQuantidade] = useState("")
    const [saving, setSaving] = useState(false)

    const projetos = useMemo(() => {
        const mapa = new Map<string, string>()
        reconhecimentos.forEach((r) => {
            if (r.projeto_id) mapa.set(r.projeto_id, r.projeto_nome || "Projeto")
        })
        return [...mapa.entries()]
            .map(([id, nome]) => ({ id, nome }))
            .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
    }, [reconhecimentos])

    const recsProjeto = useMemo(() => reconhecimentos.filter((r) => r.projeto_id === projetoId), [reconhecimentos, projetoId])
    const anteriores = useMemo(() => recsProjeto.filter((r) => r.observacao === OBS_RG_ANTERIOR), [recsProjeto])
    const totalAdiantados = recsProjeto.filter(adiantadoReconhecimento).length

    const reset = () => {
        setProjetoId("")
        setQuantidade("")
    }

    const salvar = async () => {
        if (!projetoId) return toast.error("Selecione o projeto")
        const novaQtd = Math.max(0, Math.floor(Number(quantidade) || 0))
        if (novaQtd - anteriores.length === 0) {
            toast.info("A quantidade informada é igual à atual")
            return
        }

        setSaving(true)
        try {
            await api("/api/reconhecimentos/ajustar-rgs", "POST", { projeto_id: projetoId, quantidade: novaQtd })
            toast.success("Contagem de RGs ajustada!")
            reset()
            onOpenChange(false)
            onSalvo()
        } catch (e) {
            toast.error(mensagemDeErro(e, "Erro ao ajustar"))
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle>Ajustar RGs anteriores ao sistema</DialogTitle>
                    <DialogDescription>
                        Corrija quantas RGs adiantadas o projeto já tinha antes do uso do sistema. A contagem e as bonificações são recalculadas automaticamente.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Projeto</Label>
                        <SearchableSelect
                            value={projetoId}
                            onValueChange={(v) => { setProjetoId(v); setQuantidade("") }}
                            options={projetos.map((p) => ({ value: p.id, label: p.nome }))}
                            placeholder="Pesquisar ou selecionar projeto..."
                            searchPlaceholder="Pesquisar pelo nome..."
                            emptyText="Nenhum projeto com reconhecimentos"
                        />
                    </div>

                    {projetoId && (
                        <>
                            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                                <p>Total de reconhecimentos do projeto: <strong>{recsProjeto.length}</strong></p>
                                <p>Reconhecimentos adiantados: <strong>{totalAdiantados}</strong></p>
                                <p>RGs anteriores ao sistema (atual): <strong>{anteriores.length}</strong></p>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Nova quantidade de RGs anteriores ao sistema</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={quantidade}
                                    onChange={(e) => setQuantidade(e.target.value)}
                                    placeholder={String(anteriores.length)}
                                />
                                <p className="text-xs text-muted-foreground">
                                    Bonificações já geradas são mantidas no histórico. Novas bonificações são geradas automaticamente se a contagem atingir alguma regra.
                                </p>
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={salvar} disabled={saving || !projetoId}>{saving ? "Salvando..." : "Salvar ajuste"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
