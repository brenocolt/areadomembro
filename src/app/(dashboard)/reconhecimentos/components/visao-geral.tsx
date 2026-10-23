"use client"

import { Ban, CheckCircle2, Gift, Hourglass } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { dataISODoInstante, formatarData, hojeISO } from "@/lib/reconhecimentos/datas"
import { sujeitoDe, textoPremiacao } from "@/lib/reconhecimentos/apresentacao"
import type { Bonificacao } from "@/lib/reconhecimentos/tipos"
import { StatusBadge } from "./status-badge"

function Indicador({ titulo, valor, detalhe, icone: Icone, cor, testid }: { titulo: string; valor: number; detalhe: string; icone: React.ComponentType<{ className?: string }>; cor: string; testid: string }) {
    return (
        <Card>
            <CardContent className="flex items-center gap-4 p-5">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${cor}`}><Icone className="h-5 w-5" /></span>
                <div className="min-w-0">
                    <p className="text-sm text-muted-foreground">{titulo}</p>
                    <p className="text-2xl font-bold leading-tight" data-testid={testid}>{valor}</p>
                    <p className="truncate text-xs text-muted-foreground">{detalhe}</p>
                </div>
            </CardContent>
        </Card>
    )
}

interface Props { bonificacoes: Bonificacao[]; onAbrir: (id: string) => void }

// Todos os números vêm das bonificações reais (já filtradas); "no mês" usa o mês corrente em São Paulo.
export function VisaoGeral({ bonificacoes, onAbrir }: Props) {
    const mesAtual = hojeISO().slice(0, 7)
    const conta = (...status: string[]) => bonificacoes.filter(b => status.includes(b.status)).length
    const liberadasNoMes = bonificacoes.filter(b => dataISODoInstante(b.liberada_em).slice(0, 7) === mesAtual).length
    const recentes = bonificacoes.slice(0, 10)

    return (
        <div className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Indicador testid="ind-mes" titulo="Liberadas no mês" valor={liberadasNoMes} detalhe={`${bonificacoes.length} no total`} icone={Gift} cor="bg-primary/10 text-primary" />
                <Indicador testid="ind-disponiveis" titulo="Disponíveis" valor={conta("disponivel")} detalhe="Aguardando entrega" icone={Hourglass} cor="bg-amber-500/10 text-amber-600 dark:text-amber-400" />
                <Indicador testid="ind-entregues" titulo="Entregues" valor={conta("entregue")} detalhe="Bonificações concluídas" icone={CheckCircle2} cor="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" />
                <Indicador testid="ind-canceladas" titulo="Canceladas / Expiradas" valor={conta("cancelada", "expirada")} detalhe={`${conta("cancelada")} canceladas · ${conta("expirada")} expiradas`} icone={Ban} cor="bg-destructive/10 text-destructive" />
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="border-b px-5 py-4"><h2 className="font-semibold">Bonificações recentes</h2></div>
                    {recentes.length === 0 ? (
                        <p className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhuma bonificação encontrada. As bonificações são geradas pelas regras cadastradas em Configurações.</p>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow><TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Motivo</TableHead><TableHead>Premiação</TableHead><TableHead>Liberada</TableHead><TableHead>Status</TableHead></TableRow>
                            </TableHeader>
                            <TableBody>
                                {recentes.map(b => (
                                    <TableRow key={b.id} className="cursor-pointer" onClick={() => onAbrir(b.id)}>
                                        <TableCell className="font-medium">{sujeitoDe(b)}</TableCell>
                                        <TableCell>{b.tipo_nome}</TableCell>
                                        <TableCell className="max-w-[260px] truncate text-muted-foreground">{b.motivo}</TableCell>
                                        <TableCell>{textoPremiacao(b)}</TableCell>
                                        <TableCell>{formatarData(b.liberada_em)}</TableCell>
                                        <TableCell><StatusBadge status={b.status} /></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
