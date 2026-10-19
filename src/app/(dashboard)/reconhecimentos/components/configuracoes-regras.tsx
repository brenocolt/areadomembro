"use client"

import { useState } from "react"
import { Pencil, Plus } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { api, mensagemDeErro } from "@/lib/reconhecimentos/cliente"
import { CRITERIOS, PREMIACOES } from "@/lib/reconhecimentos/constantes"
import { formatarMoeda } from "@/lib/reconhecimentos/datas"
import type { ConfigBonificacoes, RegraBonificacao, TipoReconhecimento } from "@/lib/reconhecimentos/tipos"

interface FormRegra {
    nome: string
    tipo_id: string
    criterio: string
    quantidade_necessaria: number | string
    ciclo: number | string
    requer_rg_adiantada: boolean
    requer_projeto_adiantado: boolean
    tipo_premiacao: string
    valor: number | string
    descricao_premiacao: string
    prazo_dias: number | string
    ativo: boolean
}

const vazia: FormRegra = {
    nome: "",
    tipo_id: "",
    criterio: "acumulado",
    quantidade_necessaria: 1,
    ciclo: 0,
    requer_rg_adiantada: false,
    requer_projeto_adiantado: false,
    tipo_premiacao: "financeira",
    valor: 0,
    descricao_premiacao: "",
    prazo_dias: "",
    ativo: true,
}

interface Props {
    tipos: TipoReconhecimento[]
    regras: RegraBonificacao[]
    config: ConfigBonificacoes | null
    onAtualizado: () => void
}

export function ConfiguracoesRegras({ tipos, regras, config, onAtualizado }: Props) {
    // null = campo ainda não editado: mostra o valor salvo (sem sincronizar estado em effect).
    const [prazoEditado, setPrazoEditado] = useState<string | null>(null)
    const prazoPadrao = prazoEditado ?? (config?.prazo_padrao_dias != null ? String(config.prazo_padrao_dias) : "")
    const [open, setOpen] = useState(false)
    const [editId, setEditId] = useState<string | null>(null)
    const [form, setForm] = useState<FormRegra>(vazia)
    const [novoTipo, setNovoTipo] = useState("")

    const salvarPrazoPadrao = async () => {
        try {
            await api("/api/reconhecimentos/config", "PUT", { prazo_padrao_dias: prazoPadrao === "" ? null : Number(prazoPadrao) })
            toast.success("Prazo padrão salvo")
            setPrazoEditado(null)
            onAtualizado()
        } catch (e) {
            toast.error(mensagemDeErro(e, "Erro ao salvar o prazo"))
        }
    }

    const abrirNova = () => { setEditId(null); setForm(vazia); setOpen(true) }
    const abrirEdicao = (r: RegraBonificacao) => {
        setEditId(r.id)
        setForm({
            nome: r.nome,
            tipo_id: r.tipo_id || "",
            criterio: r.criterio,
            quantidade_necessaria: r.quantidade_necessaria,
            ciclo: r.ciclo,
            requer_rg_adiantada: r.requer_rg_adiantada,
            requer_projeto_adiantado: r.requer_projeto_adiantado,
            tipo_premiacao: r.tipo_premiacao,
            valor: r.valor,
            descricao_premiacao: r.descricao_premiacao || "",
            prazo_dias: r.prazo_dias ?? "",
            ativo: r.ativo,
        })
        setOpen(true)
    }

    const salvarRegra = async () => {
        if (!form.nome.trim()) return toast.error("Informe o nome da regra")
        if (!form.tipo_id) return toast.error("Selecione o tipo de reconhecimento")
        try {
            // Gatilho 4 do motor: salvar a regra recalcula as bonificações (no servidor).
            await api(editId ? `/api/reconhecimentos/regras/${editId}` : "/api/reconhecimentos/regras", editId ? "PUT" : "POST", form)
            toast.success("Regra salva. Bonificações já geradas mantêm o valor original.")
            setOpen(false)
            onAtualizado()
        } catch (e) {
            toast.error(mensagemDeErro(e, "Erro ao salvar a regra"))
        }
    }

    const criarTipo = async () => {
        if (!novoTipo.trim()) return
        try {
            await api("/api/reconhecimentos/tipos", "POST", { nome: novoTipo.trim() })
            setNovoTipo("")
            toast.success("Tipo de reconhecimento criado")
            onAtualizado()
        } catch (e) {
            toast.error(mensagemDeErro(e, "Erro ao criar o tipo"))
        }
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader><CardTitle className="text-base">Prazo padrão das bonificações</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap items-end gap-3">
                    <div className="space-y-1.5">
                        <Label>Prazo: ___ dias após liberação</Label>
                        <Input
                            type="number"
                            className="w-40"
                            placeholder="Sem prazo"
                            value={prazoPadrao}
                            onChange={(e) => setPrazoEditado(e.target.value)}
                        />
                    </div>
                    <Button onClick={salvarPrazoPadrao}>Salvar</Button>
                    <p className="text-xs text-muted-foreground">Deixe vazio para não aplicar prazo. Cada regra pode ter o seu próprio prazo.</p>
                </CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle className="text-base">Tipos de reconhecimento</CardTitle></CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex flex-wrap gap-2">
                        {tipos.map((t) => <Badge key={t.id} variant="secondary">{t.nome}</Badge>)}
                    </div>
                    <div className="flex gap-2">
                        <Input value={novoTipo} onChange={(e) => setNovoTipo(e.target.value)} placeholder="Novo tipo de reconhecimento" className="max-w-xs" />
                        <Button variant="outline" onClick={criarTipo}><Plus className="mr-1 h-4 w-4" />Criar tipo</Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Regras de bonificação</CardTitle>
                    <Button onClick={abrirNova}><Plus className="mr-1 h-4 w-4" />Criar nova regra</Button>
                </CardHeader>
                <CardContent className="space-y-3">
                    {regras.map((r) => (
                        <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/60 p-3">
                            <div className="min-w-0">
                                <p className="font-medium">{r.nome}</p>
                                <p className="text-xs text-muted-foreground">
                                    {r.reconhecimento_tipos?.nome} · {CRITERIOS.find((c) => c.value === r.criterio)?.label}
                                    {r.criterio === "acumulado" && ` · a partir de ${r.quantidade_necessaria}${r.ciclo > 0 ? `, repetindo a cada ${r.ciclo}` : ""}`}
                                    {(r.requer_rg_adiantada || r.requer_projeto_adiantado) && " · exige reconhecimento adiantado"}
                                    {r.prazo_dias ? ` · prazo ${r.prazo_dias} dias` : ""}
                                </p>
                            </div>
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-medium">{r.descricao_premiacao || formatarMoeda(Number(r.valor))}</span>
                                <Badge variant="secondary" className={r.ativo ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : ""}>
                                    {r.ativo ? "Ativa" : "Inativa"}
                                </Badge>
                                <Button size="icon" variant="ghost" onClick={() => abrirEdicao(r)} aria-label="Editar regra"><Pencil className="h-4 w-4" /></Button>
                            </div>
                        </div>
                    ))}
                    {regras.length === 0 && <p className="py-4 text-center text-sm text-muted-foreground">Nenhuma regra cadastrada</p>}
                </CardContent>
            </Card>

            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
                    <DialogHeader><DialogTitle>{editId ? "Editar regra" : "Nova regra"}</DialogTitle></DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-1.5">
                            <Label>Nome da regra</Label>
                            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
                        </div>
                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label>Tipo de reconhecimento</Label>
                                <Select value={form.tipo_id} onValueChange={(v) => setForm({ ...form, tipo_id: v })}>
                                    <SelectTrigger><SelectValue placeholder="Selecionar" /></SelectTrigger>
                                    <SelectContent>
                                        {tipos.map((t) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Critério</Label>
                                <Select value={form.criterio} onValueChange={(v) => setForm({ ...form, criterio: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {CRITERIOS.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Quantidade necessária</Label>
                                <Input type="number" value={form.quantidade_necessaria} onChange={(e) => setForm({ ...form, quantidade_necessaria: e.target.value })} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Repetir a cada (0 = não repete)</Label>
                                <Input type="number" value={form.ciclo} onChange={(e) => setForm({ ...form, ciclo: e.target.value })} />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Tipo de premiação</Label>
                                <Select value={form.tipo_premiacao} onValueChange={(v) => setForm({ ...form, tipo_premiacao: v })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {PREMIACOES.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label>Valor (R$)</Label>
                                <Input type="number" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} />
                            </div>
                            <div className="space-y-1.5 sm:col-span-2">
                                <Label>Descrição da premiação</Label>
                                <Input value={form.descricao_premiacao} onChange={(e) => setForm({ ...form, descricao_premiacao: e.target.value })} placeholder="Ex.: R$ 30 / McDonald's" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Prazo para utilização (dias)</Label>
                                <Input type="number" value={form.prazo_dias} onChange={(e) => setForm({ ...form, prazo_dias: e.target.value })} placeholder="Usa o prazo padrão" />
                            </div>
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-border p-3">
                            <Label className="font-normal">Depende de reconhecimento adiantado</Label>
                            <Switch
                                checked={form.requer_rg_adiantada || form.requer_projeto_adiantado}
                                onCheckedChange={(v) => setForm({ ...form, requer_rg_adiantada: v, requer_projeto_adiantado: false })}
                            />
                        </div>
                        <div className="flex items-center justify-between rounded-md border border-border p-3">
                            <Label className="font-normal">Regra ativa</Label>
                            <Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                        <Button onClick={salvarRegra}>Salvar regra</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
