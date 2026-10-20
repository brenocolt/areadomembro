"use client"

import { useState } from "react"
import { Pencil, Plus, RotateCcw } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { Switch } from "@/components/ui/switch"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, mensagemDeErro } from "@/lib/reconhecimentos/cliente"
import { GATILHOS, PREMIACOES } from "@/lib/reconhecimentos/constantes"
import { formatarData } from "@/lib/reconhecimentos/datas"
import { textoPremiacao } from "@/lib/reconhecimentos/apresentacao"
import type { DadosReconhecimentos, RegraBonificacao } from "@/lib/reconhecimentos/tipos"

interface FormRegra {
    nome: string; tipo_id: string; gatilho: string; a_partir_de: string; repetir_a_cada: string
    tipo_premiacao: string; valor: string; descricao_premiacao: string; prazo_dias: string; ativo: boolean
}
const regraVazia = (): FormRegra => ({ nome: "", tipo_id: "", gatilho: "cada_reconhecimento", a_partir_de: "", repetir_a_cada: "", tipo_premiacao: "financeira", valor: "", descricao_premiacao: "", prazo_dias: "", ativo: true })
const doRegra = (r: RegraBonificacao): FormRegra => ({
    nome: r.nome, tipo_id: r.tipo_id, gatilho: r.gatilho, a_partir_de: r.a_partir_de?.toString() ?? "", repetir_a_cada: r.repetir_a_cada?.toString() ?? "",
    tipo_premiacao: r.tipo_premiacao, valor: r.valor === null || r.valor === undefined ? "" : String(r.valor), descricao_premiacao: r.descricao_premiacao, prazo_dias: r.prazo_dias?.toString() ?? "", ativo: r.ativo,
})

const descricaoDoGatilho = (r: RegraBonificacao) => {
    if (r.gatilho === "cada_reconhecimento") return "A cada reconhecimento"
    return `A partir da ${r.a_partir_de}ª RG${r.repetir_a_cada ? `, repetindo a cada ${r.repetir_a_cada}` : ""}`
}

interface Props { dados: DadosReconhecimentos; onAlterado: () => void }

export function AbaConfiguracoes({ dados, onAlterado }: Props) {
    const [ocupado, setOcupado] = useState(false)
    const [novoTipo, setNovoTipo] = useState("")
    const [novoTipoPeriodo, setNovoTipoPeriodo] = useState(false)
    const [regra, setRegra] = useState<{ id: string | null; form: FormRegra } | null>(null)
    const [retro, setRetro] = useState<{ regra: RegraBonificacao; total: number; amostra: Array<{ sujeito: string; motivo: string }> } | null>(null)

    async function acao(fn: () => Promise<unknown>, sucesso: string) {
        setOcupado(true)
        try { await fn(); toast.success(sucesso); onAlterado() } catch (e) { toast.error(mensagemDeErro(e, "Não foi possível salvar.")) } finally { setOcupado(false) }
    }

    const salvarRegra = async () => {
        if (!regra) return
        const f = regra.form
        const corpo = {
            nome: f.nome, tipo_id: f.tipo_id, gatilho: f.gatilho, a_partir_de: f.a_partir_de, repetir_a_cada: f.repetir_a_cada,
            tipo_premiacao: f.tipo_premiacao, valor: f.valor, descricao_premiacao: f.descricao_premiacao, prazo_dias: f.prazo_dias, ativo: f.ativo,
        }
        setOcupado(true)
        try {
            const r = regra.id
                ? await api<{ geradas: number }>(`/api/reconhecimentos/regras/${regra.id}`, "PUT", corpo)
                : await api<{ geradas: number }>("/api/reconhecimentos/regras", "POST", corpo)
            toast.success(regra.id ? "Regra atualizada." : "Regra criada.")
            if (r.geradas > 0) toast.info(`${r.geradas} bonificação(ões) gerada(s).`)
            setRegra(null); onAlterado()
        } catch (e) {
            toast.error(mensagemDeErro(e, "Não foi possível salvar a regra."))
        } finally { setOcupado(false) }
    }

    async function abrirRetroativo(r: RegraBonificacao) {
        try {
            const p = await api<{ total: number; amostra: Array<{ sujeito: string; motivo: string }> }>(`/api/reconhecimentos/regras/${r.id}/retroativo`)
            setRetro({ regra: r, ...p })
        } catch (e) { toast.error(mensagemDeErro(e, "Não foi possível calcular a prévia.")) }
    }

    const nomeTipo = (id: string) => dados.tipos.find(t => t.id === id)?.nome ?? "—"
    const f = regra?.form
    const setF = (p: Partial<FormRegra>) => regra && setRegra({ ...regra, form: { ...regra.form, ...p } })

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex-row items-start justify-between space-y-0">
                    <div>
                        <CardTitle>Regras de bonificação</CardTitle>
                        <CardDescription>
                            Definem quando uma bonificação é gerada e qual é a premiação. Uma regra vale para os reconhecimentos registrados depois da sua criação; para os anteriores, use &quot;Aplicar a registros anteriores&quot;.
                        </CardDescription>
                    </div>
                    <Button onClick={() => setRegra({ id: null, form: regraVazia() })}><Plus className="mr-2 h-4 w-4" />Nova regra</Button>
                </CardHeader>
                <CardContent className="p-0">
                    {dados.regras.length === 0 ? (
                        <p className="px-6 pb-6 text-sm text-muted-foreground" data-testid="sem-regras">
                            Nenhuma regra cadastrada. Nenhuma bonificação será gerada até que as regras e os valores sejam cadastrados aqui.
                        </p>
                    ) : (
                        <Table>
                            <TableHeader><TableRow><TableHead>Regra</TableHead><TableHead>Tipo</TableHead><TableHead>Gatilho</TableHead><TableHead>Premiação</TableHead><TableHead>Prazo</TableHead><TableHead>Vigente desde</TableHead><TableHead>Ativa</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {dados.regras.map(r => (
                                    <TableRow key={r.id} data-testid="linha-regra">
                                        <TableCell className="font-medium">{r.nome}</TableCell>
                                        <TableCell>{nomeTipo(r.tipo_id)}</TableCell>
                                        <TableCell>{descricaoDoGatilho(r)}</TableCell>
                                        <TableCell>{textoPremiacao({ descricao_premiacao: r.descricao_premiacao, valor: r.valor, tipo_premiacao: r.tipo_premiacao })}</TableCell>
                                        <TableCell>{r.prazo_dias ? `${r.prazo_dias} dias` : "Sem prazo"}</TableCell>
                                        <TableCell>{formatarData(r.vigente_desde)}</TableCell>
                                        <TableCell><Badge variant={r.ativo ? "default" : "secondary"}>{r.ativo ? "Ativa" : "Inativa"}</Badge></TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" aria-label={`Editar regra ${r.nome}`} onClick={() => setRegra({ id: r.id, form: doRegra(r) })}><Pencil className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" aria-label={`Aplicar ${r.nome} a registros anteriores`} disabled={!r.ativo} onClick={() => abrirRetroativo(r)}><RotateCcw className="h-4 w-4" /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Tipos de reconhecimento</CardTitle>
                    <CardDescription>Desative um tipo para tirá-lo do formulário sem apagar os registros existentes.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    <ul className="divide-y rounded-md border">
                        {dados.tipos.map(t => (
                            <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-2.5" data-testid="linha-tipo">
                                <div><p className="text-sm font-medium">{t.nome}</p><p className="text-xs text-muted-foreground">{t.escopo === "projeto" ? "Por projeto" : t.escopo === "nucleo" ? "Por núcleo" : "Por colaborador"}{t.usa_periodo ? " · com período de referência" : ""}</p></div>
                                <Switch checked={t.ativo} disabled={ocupado} aria-label={`Tipo ${t.nome} ativo`} onCheckedChange={v => acao(() => api(`/api/reconhecimentos/tipos/${t.id}`, "PUT", { ativo: v }), v ? "Tipo ativado." : "Tipo desativado.")} />
                            </li>
                        ))}
                    </ul>
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="min-w-[220px] flex-1 space-y-1.5"><Label htmlFor="rec-novo-tipo">Novo tipo (por colaborador)</Label><Input id="rec-novo-tipo" value={novoTipo} onChange={e => setNovoTipo(e.target.value)} placeholder="Ex.: Destaque do mês" /></div>
                        <div className="flex items-center gap-2 pb-2"><Switch checked={novoTipoPeriodo} onCheckedChange={setNovoTipoPeriodo} aria-label="Usa período de referência" /><span className="text-sm">Usa período</span></div>
                        <Button disabled={ocupado || !novoTipo.trim()} onClick={() => acao(async () => { await api("/api/reconhecimentos/tipos", "POST", { nome: novoTipo, usa_periodo: novoTipoPeriodo }); setNovoTipo(""); setNovoTipoPeriodo(false) }, "Tipo criado.")}>Adicionar tipo</Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Núcleos elegíveis</CardTitle>
                    <CardDescription>Define quais núcleos podem receber o reconhecimento de Núcleo de Impacto.</CardDescription>
                </CardHeader>
                <CardContent>
                    <ul className="grid gap-2 sm:grid-cols-2">
                        {dados.nucleos.map(n => (
                            <li key={n.nucleo} className="flex items-center justify-between rounded-md border px-4 py-2.5" data-testid="linha-nucleo">
                                <span className="text-sm">{n.nucleo}</span>
                                <Switch checked={n.elegivel} disabled={ocupado} aria-label={`Núcleo ${n.nucleo} elegível`} onCheckedChange={v => acao(() => api("/api/reconhecimentos/nucleos", "PUT", { nucleo: n.nucleo, elegivel: v }), "Núcleo atualizado.")} />
                            </li>
                        ))}
                    </ul>
                </CardContent>
            </Card>

            <Dialog open={!!regra} onOpenChange={o => { if (!o) setRegra(null) }}>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>{regra?.id ? "Editar regra" : "Nova regra de bonificação"}</DialogTitle>
                        <DialogDescription>Nenhum valor é sugerido: informe a premiação que a diretoria definiu.</DialogDescription>
                    </DialogHeader>
                    {f && (
                        <div className="space-y-4">
                            <div className="space-y-1.5"><Label htmlFor="regra-nome">Nome da regra *</Label><Input id="regra-nome" value={f.nome} maxLength={200} onChange={e => setF({ nome: e.target.value })} /></div>
                            <div className="space-y-1.5">
                                <Label>Tipo de reconhecimento *</Label>
                                {regra?.id ? <Input value={nomeTipo(f.tipo_id)} disabled /> : <SearchableSelect value={f.tipo_id} onValueChange={v => setF({ tipo_id: v })} options={dados.tipos.map(t => ({ value: t.id, label: t.nome }))} placeholder="Selecione o tipo" />}
                            </div>
                            <div className="space-y-1.5">
                                <Label>Quando gerar *</Label>
                                <SearchableSelect value={f.gatilho} onValueChange={v => setF({ gatilho: v })} options={GATILHOS.map(g => ({ value: g.value, label: g.label }))} />
                            </div>
                            {f.gatilho === "marcos_de_rg" && (
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="space-y-1.5"><Label htmlFor="regra-a-partir">A partir da RG nº *</Label><Input id="regra-a-partir" type="number" min={1} value={f.a_partir_de} onChange={e => setF({ a_partir_de: e.target.value })} /></div>
                                    <div className="space-y-1.5"><Label htmlFor="regra-repetir">Repetir a cada (RGs)</Label><Input id="regra-repetir" type="number" min={1} value={f.repetir_a_cada} onChange={e => setF({ repetir_a_cada: e.target.value })} placeholder="Opcional" /></div>
                                </div>
                            )}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5"><Label>Tipo de premiação *</Label><SearchableSelect value={f.tipo_premiacao} onValueChange={v => setF({ tipo_premiacao: v })} options={PREMIACOES.map(p => ({ value: p.value, label: p.label }))} /></div>
                                <div className="space-y-1.5"><Label htmlFor="regra-valor">Valor (R$)</Label><Input id="regra-valor" type="number" min={0} step="0.01" value={f.valor} onChange={e => setF({ valor: e.target.value })} placeholder="Opcional" /></div>
                            </div>
                            <div className="space-y-1.5"><Label htmlFor="regra-descricao">Descrição da premiação</Label><Input id="regra-descricao" value={f.descricao_premiacao} maxLength={200} onChange={e => setF({ descricao_premiacao: e.target.value })} placeholder="Ex.: Vale-presente" /></div>
                            <div className="space-y-1.5"><Label htmlFor="regra-prazo">Prazo para entrega (dias)</Label><Input id="regra-prazo" type="number" min={1} value={f.prazo_dias} onChange={e => setF({ prazo_dias: e.target.value })} placeholder="Sem prazo" /></div>
                            <div className="flex items-center gap-2"><Switch checked={f.ativo} onCheckedChange={v => setF({ ativo: v })} aria-label="Regra ativa" /><span className="text-sm">Regra ativa</span></div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRegra(null)} disabled={ocupado}>Cancelar</Button>
                        <Button onClick={salvarRegra} disabled={ocupado || !f?.nome.trim() || !f?.tipo_id}>{ocupado ? "Salvando..." : "Salvar regra"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!retro} onOpenChange={o => { if (!o) setRetro(null) }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Aplicar a registros anteriores</DialogTitle>
                        <DialogDescription>{retro?.regra.nome}</DialogDescription>
                    </DialogHeader>
                    {retro && (retro.total === 0 ? <p className="text-sm">Nenhuma bonificação nova seria gerada.</p> : (
                        <div className="space-y-2 text-sm">
                            <p><strong>{retro.total}</strong> bonificação(ões) seriam geradas. Registros que já têm bonificação desta regra não são duplicados.</p>
                            <ul className="list-disc pl-5 text-muted-foreground">{retro.amostra.slice(0, 5).map((a, i) => <li key={i}>{a.sujeito} — {a.motivo}</li>)}</ul>
                        </div>
                    ))}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setRetro(null)}>Fechar</Button>
                        {retro && retro.total > 0 && (
                            <Button disabled={ocupado} onClick={() => acao(async () => { const r = retro; await api(`/api/reconhecimentos/regras/${r.regra.id}/retroativo`, "POST"); setRetro(null) }, "Bonificações geradas.")}>Gerar bonificações</Button>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
