"use client"

import { useCallback, useEffect, useState } from "react"
import { Loader2, Pencil, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatarMes, formatarNumero, type GasolinaPreco } from "@/lib/gasolina"
import { gasolinaApi } from "./api"

type PrecoComAutor = GasolinaPreco & { atualizado_por_colab?: { nome: string } | null }

function mesAtual(): string {
    const hoje = new Date()
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, "0")}`
}

// Antiga aba "Histórico de preços": a VP lança o preço médio do litro de cada
// mês. Viagens de um mês sem preço ficam fora das solicitações até ele entrar.
export function GestaoPrecos() {
    const [precos, setPrecos] = useState<PrecoComAutor[]>([])
    const [carregando, setCarregando] = useState(true)
    const [mes, setMes] = useState(mesAtual())
    const [valor, setValor] = useState("")
    const [salvando, setSalvando] = useState(false)

    const carregar = useCallback(async () => {
        try {
            const r = await gasolinaApi<{ precos: PrecoComAutor[] }>("/api/gasolina/precos")
            setPrecos(r.precos)
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setCarregando(false)
        }
    }, [])

    useEffect(() => { carregar() }, [carregar])

    async function salvar() {
        setSalvando(true)
        try {
            await gasolinaApi("/api/gasolina/precos", { method: "PUT", body: JSON.stringify({ mes, preco_litro: valor }) })
            toast.success(`Preço de ${formatarMes(`${mes}-01`)} salvo.`)
            setValor("")
            carregar()
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setSalvando(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg">Preço médio do litro por mês</CardTitle>
                <CardDescription>
                    O valor de cada viagem usa o preço do mês em que ela aconteceu. Enquanto o mês não tiver preço,
                    as viagens dele não entram nas solicitações de reembolso.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="space-y-1.5">
                        <Label htmlFor="mes">Mês</Label>
                        <Input id="mes" type="month" value={mes} onChange={e => setMes(e.target.value)} className="sm:w-44" />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="preco">Preço do litro (R$)</Label>
                        <Input id="preco" inputMode="decimal" value={valor} onChange={e => setValor(e.target.value)} placeholder="Ex.: 6,49" className="sm:w-36"
                            onKeyDown={e => { if (e.key === "Enter") salvar() }} />
                    </div>
                    <Button onClick={salvar} disabled={salvando || !mes || !valor.trim()}>
                        {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Salvar preço
                    </Button>
                </div>

                {carregando ? (
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                ) : precos.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum preço lançado ainda.</p>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Mês</TableHead>
                                <TableHead>Preço do litro</TableHead>
                                <TableHead className="hidden sm:table-cell">Lançado por</TableHead>
                                <TableHead className="w-10" />
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {precos.map(p => (
                                <TableRow key={p.mes}>
                                    <TableCell className="capitalize">{formatarMes(p.mes)}</TableCell>
                                    <TableCell className="font-semibold">R$ {formatarNumero(p.preco_litro, 2)}</TableCell>
                                    <TableCell className="hidden sm:table-cell text-slate-500 text-sm">
                                        {p.atualizado_por_colab?.nome ?? "—"} · {new Date(p.atualizado_em).toLocaleDateString("pt-BR")}
                                    </TableCell>
                                    <TableCell>
                                        <Button variant="ghost" size="icon" className="h-8 w-8" title="Corrigir"
                                            onClick={() => { setMes(p.mes.slice(0, 7)); setValor(String(p.preco_litro).replace(".", ",")) }}>
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                )}
            </CardContent>
        </Card>
    )
}
