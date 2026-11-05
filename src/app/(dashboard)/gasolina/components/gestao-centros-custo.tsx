"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import type { GasolinaCentroCusto, MondayColunaValor } from "@/lib/gasolina"
import { gasolinaApi } from "./api"

type Formulario = Omit<GasolinaCentroCusto, "id">

const VAZIO: Formulario = {
    nome: "", tipo: "projeto", rotulo_fixo: "", monday_centro_custo: "",
    monday_coluna_projeto: "", monday_colunas: [], ativo: true, ordem: 0,
}

// Centros de custo que o membro escolhe ao lançar a viagem — a VP muda quando
// quiser, como as opções do formulário do Monday. Os campos "Monday" dizem
// como o card é preenchido quando o reembolso é solicitado.
export function GestaoCentrosCusto() {
    const [centros, setCentros] = useState<GasolinaCentroCusto[]>([])
    const [carregando, setCarregando] = useState(true)
    const [editandoId, setEditandoId] = useState<string | null>(null)
    const [form, setForm] = useState<Formulario | null>(null)
    const [salvando, setSalvando] = useState(false)

    const carregar = useCallback(async () => {
        try {
            const r = await gasolinaApi<{ centros: GasolinaCentroCusto[] }>("/api/gasolina/centros-custo")
            setCentros(r.centros)
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setCarregando(false)
        }
    }, [])

    useEffect(() => { carregar() }, [carregar])

    function abrir(centro?: GasolinaCentroCusto) {
        setEditandoId(centro?.id ?? null)
        setForm(centro ? { ...centro, rotulo_fixo: centro.rotulo_fixo ?? "", monday_coluna_projeto: centro.monday_coluna_projeto ?? "" }
            : { ...VAZIO, ordem: centros.length + 1 })
    }

    function alterarColuna(i: number, campo: keyof MondayColunaValor, valor: string) {
        setForm(f => f && { ...f, monday_colunas: f.monday_colunas.map((c, j) => j === i ? { ...c, [campo]: valor } : c) })
    }

    async function salvar() {
        if (!form) return
        setSalvando(true)
        try {
            await gasolinaApi(editandoId ? `/api/gasolina/centros-custo/${editandoId}` : "/api/gasolina/centros-custo", {
                method: editandoId ? "PATCH" : "POST",
                body: JSON.stringify(form),
            })
            toast.success("Centro de custo salvo.")
            setForm(null)
            carregar()
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setSalvando(false)
        }
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                    <CardTitle className="text-lg">Centros de custo</CardTitle>
                    <CardDescription className="mt-1">
                        Opções que o membro escolhe ao lançar uma viagem. Desative em vez de apagar, para não perder o histórico.
                    </CardDescription>
                </div>
                <Button onClick={() => abrir()} className="shrink-0"><Plus className="h-4 w-4" /> Novo</Button>
            </CardHeader>
            <CardContent>
                {carregando ? (
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                ) : (
                    <div className="space-y-3">
                        {centros.map(c => (
                            <div key={c.id} className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 dark:border-white/10 p-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold">{c.nome}</span>
                                        {!c.ativo && <Badge variant="secondary">Desativado</Badge>}
                                    </div>
                                    <p className="text-sm text-slate-500">
                                        {c.tipo === "projeto" ? "Membro escolhe o projeto da lista do Monday" : `Projeto fixo: ${c.rotulo_fixo}`}
                                        {" · "}Monday: {c.monday_centro_custo}
                                        {c.monday_colunas.length > 0 && ` · ${c.monday_colunas.map(x => x.valor).join(", ")}`}
                                    </p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => abrir(c)} title="Editar">
                                    <Pencil className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>

            <Dialog open={!!form} onOpenChange={o => { if (!o) setForm(null) }}>
                <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>{editandoId ? "Editar centro de custo" : "Novo centro de custo"}</DialogTitle>
                        <DialogDescription>Os campos do Monday precisam ser iguais aos do board Processos de Pagamento.</DialogDescription>
                    </DialogHeader>
                    {form && (
                        <div className="space-y-4">
                            <div className="space-y-1.5">
                                <Label>Nome que o membro vê *</Label>
                                <Input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} placeholder="Ex.: Prospecção (Marketing)" />
                            </div>
                            <div className="space-y-1.5">
                                <Label>Como o projeto é escolhido *</Label>
                                <Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v as Formulario["tipo"] })}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="projeto">Membro escolhe da lista de projetos do Monday</SelectItem>
                                        <SelectItem value="fixo">Projeto fixo (sem escolha)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {form.tipo === "fixo" && (
                                <div className="space-y-1.5">
                                    <Label>Nome do projeto fixo *</Label>
                                    <Input value={form.rotulo_fixo ?? ""} onChange={e => setForm({ ...form, rotulo_fixo: e.target.value })} placeholder="Ex.: PROSPECÇÃO" />
                                </div>
                            )}
                            <div className="flex items-center gap-6">
                                <div className="space-y-1.5">
                                    <Label>Ordem na lista</Label>
                                    <Input type="number" value={form.ordem} onChange={e => setForm({ ...form, ordem: Number(e.target.value) || 0 })} className="w-24" />
                                </div>
                                <label className="flex items-center gap-2 text-sm pt-5">
                                    <Switch checked={form.ativo} onCheckedChange={v => setForm({ ...form, ativo: v })} />
                                    Ativo
                                </label>
                            </div>

                            <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-4 space-y-4">
                                <p className="text-sm font-semibold">Integração com o Monday</p>
                                <div className="space-y-1.5">
                                    <Label>Opção da coluna &quot;Centro de Custo&quot; *</Label>
                                    <Input value={form.monday_centro_custo} onChange={e => setForm({ ...form, monday_centro_custo: e.target.value })} placeholder="Ex.: Marketing" />
                                </div>
                                {form.tipo === "projeto" && (
                                    <div className="space-y-1.5">
                                        <Label>ID da coluna com a lista de projetos *</Label>
                                        <Input value={form.monday_coluna_projeto ?? ""} onChange={e => setForm({ ...form, monday_coluna_projeto: e.target.value })} placeholder="Ex.: dropdown_mkxcfwdz" className="font-mono" />
                                    </div>
                                )}
                                <div className="space-y-2">
                                    <Label>Outras colunas preenchidas no card</Label>
                                    {form.monday_colunas.map((c, i) => (
                                        <div key={i} className="flex gap-2">
                                            <Input value={c.coluna} onChange={e => alterarColuna(i, "coluna", e.target.value)} placeholder="ID da coluna" className="font-mono" />
                                            <Input value={c.valor} onChange={e => alterarColuna(i, "valor", e.target.value)} placeholder="Opção (ex.: Gasolina)" />
                                            <Button variant="ghost" size="icon" className="shrink-0" title="Remover"
                                                onClick={() => setForm({ ...form, monday_colunas: form.monday_colunas.filter((_, j) => j !== i) })}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    ))}
                                    <Button variant="outline" size="sm" onClick={() => setForm({ ...form, monday_colunas: [...form.monday_colunas, { coluna: "", valor: "" }] })}>
                                        <Plus className="h-4 w-4" /> Adicionar coluna
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setForm(null)}>Cancelar</Button>
                        <Button onClick={salvar} disabled={salvando}>
                            {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                            Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </Card>
    )
}
