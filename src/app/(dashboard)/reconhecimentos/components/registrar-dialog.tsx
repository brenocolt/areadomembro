"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { api, mensagemDeErro } from "@/lib/reconhecimentos/cliente"
import { NUCLEOS_IMPACTO } from "@/lib/reconhecimentos/constantes"
import { hojeISO, normalizar } from "@/lib/reconhecimentos/datas"
import type { Reconhecimento, TipoReconhecimento } from "@/lib/reconhecimentos/tipos"

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    tipos: TipoReconhecimento[]
    reconhecimentos: Reconhecimento[]
    onSalvo: () => void
}

export function RegistrarDialog({ open, onOpenChange, tipos, reconhecimentos, onSalvo }: Props) {
    const [projetos, setProjetos] = useState<Array<{ id: string; nome: string }>>([])
    const [tipoId, setTipoId] = useState("")
    const [data, setData] = useState(hojeISO())
    const [projetoId, setProjetoId] = useState("")
    const [pessoa, setPessoa] = useState("")
    const [adiantado, setAdiantado] = useState(false)
    const [nucleo, setNucleo] = useState("")
    const [rgsAnteriores, setRgsAnteriores] = useState("")
    const [observacao, setObservacao] = useState("")
    const [saving, setSaving] = useState(false)

    const tipo = tipos.find((t) => t.id === tipoId)
    const isProjeto = tipo?.escopo === "projeto"
    // O tipo "Núcleo de Impacto" é detectado pelo nome (comportamento do original).
    const isNucleoImpacto = !!tipo && normalizar(tipo.nome).includes("nucleo")

    // Projetos vêm do servidor (tabela `projetos`, ativos).
    useEffect(() => {
        if (!open) return
        api<{ projetos: Array<{ id: string; nome: string }> }>("/api/reconhecimentos/projetos")
            .then((r) => setProjetos(r.projetos))
            .catch((e) => toast.error(mensagemDeErro(e, "Erro ao carregar projetos")))
    }, [open])

    const pessoasConhecidas = useMemo(() => {
        const set = new Set<string>()
        reconhecimentos.forEach((r) => r.pessoa_nome && set.add(r.pessoa_nome))
        return Array.from(set).sort((a, b) => a.localeCompare(b, "pt-BR"))
    }, [reconhecimentos])

    const reset = () => {
        setTipoId("")
        setData(hojeISO())
        setProjetoId("")
        setPessoa("")
        setAdiantado(false)
        setNucleo("")
        setRgsAnteriores("")
        setObservacao("")
    }

    const salvar = async () => {
        if (!tipoId) return toast.error("Selecione o tipo de reconhecimento")
        if (isProjeto && !projetoId) return toast.error("Selecione o projeto")
        if (isNucleoImpacto && !nucleo) return toast.error("Selecione o núcleo")
        if (!isProjeto && !isNucleoImpacto && !pessoa.trim()) return toast.error("Informe o nome da pessoa reconhecida")

        setSaving(true)
        try {
            await api("/api/reconhecimentos", "POST", {
                tipo_id: tipoId,
                data,
                projeto_id: isProjeto ? projetoId : null,
                pessoa_nome: !isProjeto && !isNucleoImpacto ? pessoa.trim() : "",
                nucleo: !isProjeto && isNucleoImpacto ? nucleo : "",
                adiantado: isProjeto ? adiantado : false,
                rgs_anteriores: isProjeto ? Number(rgsAnteriores) || 0 : 0,
                observacao,
            })
            toast.success("Reconhecimento registrado!")
            reset()
            onOpenChange(false)
            onSalvo()
        } catch (e) {
            toast.error(mensagemDeErro(e, "Erro ao registrar"))
        } finally {
            setSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={(o) => { onOpenChange(o); if (!o) reset() }}>
            <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Registrar reconhecimento</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Tipo de reconhecimento</Label>
                        <Select value={tipoId} onValueChange={setTipoId}>
                            <SelectTrigger><SelectValue placeholder="Selecionar tipo" /></SelectTrigger>
                            <SelectContent>
                                {tipos.filter((t) => t.ativo).map((t) => (
                                    <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    {tipoId && isProjeto && (
                        <>
                            <div className="space-y-1.5">
                                <Label>Data</Label>
                                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                            </div>

                            <div className="space-y-1.5">
                                <Label>Projeto</Label>
                                <SearchableSelect
                                    value={projetoId}
                                    onValueChange={setProjetoId}
                                    options={projetos.map((p) => ({ value: p.id, label: p.nome }))}
                                    placeholder="Pesquisar ou selecionar projeto..."
                                    searchPlaceholder="Pesquisar pelo nome..."
                                    emptyText="Nenhum projeto encontrado"
                                />
                            </div>

                            <div className="flex items-center justify-between rounded-md border border-border p-3">
                                <Label className="font-normal">Adiantado?</Label>
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>{adiantado ? "Sim" : "Não"}</span>
                                    <Switch checked={adiantado} onCheckedChange={setAdiantado} />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label>RGs adiantadas antes deste registro (opcional)</Label>
                                <Input
                                    type="number"
                                    min={0}
                                    value={rgsAnteriores}
                                    onChange={(e) => setRgsAnteriores(e.target.value)}
                                    placeholder="0"
                                />
                                <p className="text-xs text-muted-foreground">
                                    Informe quantas RGs adiantadas o projeto já tinha ANTES deste registro, sem contar a que você está registrando agora. Elas entram na contagem automática.
                                </p>
                            </div>

                            <div className="space-y-1.5">
                                <Label>Observação (opcional)</Label>
                                <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} />
                            </div>

                            <p className="text-xs text-muted-foreground">
                                As contagens total e de reconhecimentos adiantados são calculadas automaticamente pelo histórico do projeto.
                            </p>
                        </>
                    )}

                    {tipoId && !isProjeto && !isNucleoImpacto && (
                        <div className="space-y-1.5">
                            <Label>Pessoa reconhecida</Label>
                            <Input
                                list="pessoas-reconhecidas"
                                value={pessoa}
                                onChange={(e) => setPessoa(e.target.value)}
                                placeholder="Pesquisar ou digitar o nome..."
                            />
                            <datalist id="pessoas-reconhecidas">
                                {pessoasConhecidas.map((n) => <option key={n} value={n} />)}
                            </datalist>
                        </div>
                    )}

                    {tipoId && !isProjeto && isNucleoImpacto && (
                        <div className="space-y-1.5">
                            <Label>Núcleos</Label>
                            <Select value={nucleo} onValueChange={setNucleo}>
                                <SelectTrigger><SelectValue placeholder="Selecionar núcleo" /></SelectTrigger>
                                <SelectContent>
                                    {NUCLEOS_IMPACTO.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {tipoId && !isProjeto && (
                        <>
                            <div className="space-y-1.5">
                                <Label>Data do reconhecimento</Label>
                                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
                            </div>

                            <div className="space-y-1.5">
                                <Label>Observação (opcional)</Label>
                                <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} />
                            </div>
                        </>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Registrar"}</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
