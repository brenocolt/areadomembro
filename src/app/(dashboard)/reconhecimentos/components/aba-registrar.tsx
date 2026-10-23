"use client"

import { useState } from "react"
import { History, Pencil, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { api, mensagemDeErro } from "@/lib/reconhecimentos/cliente"
import { formatarData } from "@/lib/reconhecimentos/datas"
import { sujeitoDe } from "@/lib/reconhecimentos/apresentacao"
import type { DadosReconhecimentos, Reconhecimento } from "@/lib/reconhecimentos/tipos"
import { HistoricoDoReconhecimento } from "./historico-do-reconhecimento"

interface Props {
    dados: DadosReconhecimentos
    reconhecimentos: Reconhecimento[]
    onNovo: () => void
    onEditar: (r: Reconhecimento) => void
    onAlterado: () => void
}

export function AbaRegistrar({ dados, reconhecimentos, onNovo, onEditar, onAlterado }: Props) {
    const [excluindo, setExcluindo] = useState<Reconhecimento | null>(null)
    const [motivo, setMotivo] = useState("")
    const [enviando, setEnviando] = useState(false)
    const [verHistorico, setVerHistorico] = useState<Reconhecimento | null>(null)

    async function excluir() {
        if (!excluindo) return
        setEnviando(true)
        try {
            await api(`/api/reconhecimentos/${excluindo.id}/excluir`, "POST", { motivo })
            toast.success("Reconhecimento excluído. O registro permanece no histórico.")
            setExcluindo(null); setMotivo("")
            onAlterado()
        } catch (e) {
            toast.error(mensagemDeErro(e, "Não foi possível excluir."))
        } finally {
            setEnviando(false)
        }
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-muted-foreground">{reconhecimentos.length} reconhecimento(s) registrado(s)</p>
                <Button onClick={onNovo}><Plus className="mr-2 h-4 w-4" />Registrar reconhecimento</Button>
            </div>

            <Card>
                <CardContent className="p-0">
                    {reconhecimentos.length === 0 ? (
                        <p className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhum reconhecimento encontrado.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Data</TableHead><TableHead>Tipo</TableHead><TableHead>Projeto / Pessoa / Núcleo</TableHead><TableHead>Nº RG</TableHead>
                                    <TableHead>Período</TableHead><TableHead>Registrado por</TableHead><TableHead className="text-right">Ações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {reconhecimentos.map(r => (
                                    <TableRow key={r.id} data-testid="linha-reconhecimento">
                                        <TableCell>{formatarData(r.data_reconhecimento)}</TableCell>
                                        <TableCell>{dados.tipos.find(t => t.id === r.tipo_id)?.nome ?? "—"}</TableCell>
                                        <TableCell className="font-medium">{sujeitoDe(r)}</TableCell>
                                        <TableCell>{r.numero_rg ? `${r.numero_rg}ª` : "—"}</TableCell>
                                        <TableCell>{r.periodo_referencia ? `${r.periodo_referencia.slice(5, 7)}/${r.periodo_referencia.slice(0, 4)}` : "—"}</TableCell>
                                        <TableCell className="max-w-[180px] truncate text-muted-foreground">{r.criado_por_email}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-1">
                                                <Button variant="ghost" size="icon" aria-label="Editar reconhecimento" onClick={() => onEditar(r)}><Pencil className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" aria-label="Ver histórico do reconhecimento" onClick={() => setVerHistorico(r)}><History className="h-4 w-4" /></Button>
                                                <Button variant="ghost" size="icon" aria-label="Excluir reconhecimento" onClick={() => setExcluindo(r)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <Dialog open={!!excluindo} onOpenChange={o => { if (!o) { setExcluindo(null); setMotivo("") } }}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Excluir reconhecimento</DialogTitle>
                        <DialogDescription>
                            O reconhecimento deixa de aparecer nas listas, mas o registro e o histórico são preservados. Bonificações já geradas não são apagadas.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-1.5">
                        <Label htmlFor="rec-motivo-exclusao">Motivo da exclusão *</Label>
                        <Textarea id="rec-motivo-exclusao" rows={3} value={motivo} onChange={e => setMotivo(e.target.value)} />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => { setExcluindo(null); setMotivo("") }} disabled={enviando}>Cancelar</Button>
                        <Button variant="destructive" onClick={excluir} disabled={enviando || motivo.trim().length < 3}>{enviando ? "Excluindo..." : "Excluir"}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <HistoricoDoReconhecimento reconhecimento={verHistorico} onFechar={() => setVerHistorico(null)} dados={dados} />
        </div>
    )
}
