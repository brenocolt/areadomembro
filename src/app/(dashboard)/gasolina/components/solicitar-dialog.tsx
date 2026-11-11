"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, CheckCircle2, Clock, KeyRound, Loader2, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatarData, formatarNumero, formatarReais } from "@/lib/gasolina"
import { gasolinaApi } from "./api"

interface ViagemPreview {
    id: string
    data_viagem: string
    origem_local: string
    destino_local: string
    paradas: string[]
    distancia_km: number
    litros: number | null
    valor: number | null
    motivo?: string
}

// Por que nenhuma viagem pode ser solicitada agora (pelo motivo de cada uma que ficou de fora).
function avisoSemViagens(excluidas: ViagemPreview[]): string {
    const motivos = new Set(excluidas.map(v => v.motivo ?? ""))
    if (motivos.size === 1 && motivos.has("Carro invalidado pela VP")) {
        return "As viagens deste projeto foram feitas com um carro invalidado pela VP e não podem ser solicitadas. Dúvidas: fale com a Vice-Presidência."
    }
    if ([...motivos].every(m => m.startsWith("Aguardando o preço"))) {
        return "Ainda não há viagens deste projeto com o preço do mês definido. Assim que a VP lançar o preço, elas poderão ser solicitadas."
    }
    return "Nenhuma viagem deste projeto pode ser solicitada agora. Veja acima o motivo de cada uma."
}

interface Preview {
    incluidas: ViagemPreview[]
    excluidas: ViagemPreview[]
    litros_total: number
    valor_total: number
    chave_pix: string | null
}

interface Props {
    alvo: { centroId: string, centroNome: string, projeto: string } | null
    onOpenChange: (open: boolean) => void
    onSolicitado: () => void
}

function trajeto(v: ViagemPreview) {
    return [v.origem_local, ...(v.paradas ?? []), v.destino_local].join(" → ")
}

// Prévia + confirmação da solicitação de reembolso de um projeto.
export function SolicitarDialog({ alvo, onOpenChange, onSolicitado }: Props) {
    const [preview, setPreview] = useState<Preview | null>(null)
    const [carregando, setCarregando] = useState(false)
    const [enviando, setEnviando] = useState(false)

    useEffect(() => {
        if (!alvo) { setPreview(null); return }
        let cancelado = false
        setCarregando(true)
        const qs = new URLSearchParams({ centro: alvo.centroId, projeto: alvo.projeto })
        gasolinaApi<Preview>(`/api/gasolina/solicitacoes/preview?${qs}`)
            .then(r => { if (!cancelado) setPreview(r) })
            .catch(e => toast.error(e.message))
            .finally(() => { if (!cancelado) setCarregando(false) })
        return () => { cancelado = true }
    }, [alvo])

    async function confirmar() {
        if (!alvo) return
        setEnviando(true)
        try {
            await gasolinaApi("/api/gasolina/solicitacoes", {
                method: "POST",
                body: JSON.stringify({ centro_custo_id: alvo.centroId, projeto: alvo.projeto }),
            })
            toast.success("Reembolso solicitado! Acompanhe o andamento na aba Solicitações.")
            onSolicitado()
            onOpenChange(false)
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setEnviando(false)
        }
    }

    const semPix = preview && !preview.chave_pix
    const podeEnviar = preview && preview.incluidas.length > 0 && !semPix

    return (
        <Dialog open={!!alvo} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Solicitar reembolso — {alvo?.projeto}</DialogTitle>
                    <DialogDescription>{alvo?.centroNome}. Confira o que vai ser pedido antes de confirmar.</DialogDescription>
                </DialogHeader>

                {carregando || !preview ? (
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                ) : (
                    <div className="space-y-5">
                        <div className="rounded-xl bg-amber-50 dark:bg-amber-500/10 p-4">
                            <p className="text-sm text-slate-600 dark:text-slate-300">Valor a receber</p>
                            <p className="text-3xl font-bold text-slate-900 dark:text-white">{formatarReais(preview.valor_total)}</p>
                            <p className="text-sm text-slate-500">{preview.incluidas.length} viagem(ns) · {formatarNumero(preview.litros_total, 2)} L</p>
                        </div>

                        {semPix ? (
                            <p className="flex items-start gap-2 text-sm text-red-600">
                                <KeyRound className="h-4 w-4 mt-0.5 shrink-0" />
                                Cadastre sua chave Pix na aba &quot;Meus carros e Pix&quot; para poder solicitar.
                            </p>
                        ) : (
                            <p className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                                <KeyRound className="h-4 w-4 text-amber-500" /> Pix: <span className="font-mono">{preview.chave_pix}</span>
                            </p>
                        )}

                        {preview.incluidas.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-sm font-semibold flex items-center gap-1"><CheckCircle2 className="h-4 w-4 text-emerald-500" /> Entram nesta solicitação</p>
                                <ul className="divide-y divide-slate-100 dark:divide-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                                    {preview.incluidas.map(v => (
                                        <li key={v.id} className="flex items-start justify-between gap-3 p-3 text-sm">
                                            <span>
                                                <span className="font-medium">{formatarData(v.data_viagem)}</span> · {trajeto(v)}
                                                <span className="block text-xs text-slate-500">{formatarNumero(v.distancia_km, 1)} km · {formatarNumero(v.litros, 2)} L</span>
                                            </span>
                                            <span className="font-semibold whitespace-nowrap">{formatarReais(v.valor)}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {preview.excluidas.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-sm font-semibold flex items-center gap-1"><Clock className="h-4 w-4 text-sky-500" /> Ficam de fora (continuam pendentes)</p>
                                <ul className="divide-y divide-slate-100 dark:divide-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                                    {preview.excluidas.map(v => (
                                        <li key={v.id} className="p-3 text-sm text-slate-500">
                                            <span className="font-medium">{formatarData(v.data_viagem)}</span> · {trajeto(v)}
                                            <span className="block text-xs text-sky-600 dark:text-sky-400">{v.motivo}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {preview.incluidas.length === 0 && (
                            <p className="flex items-start gap-2 text-sm text-slate-500">
                                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-amber-500" />
                                {avisoSemViagens(preview.excluidas)}
                            </p>
                        )}

                        <p className="text-xs text-slate-500">
                            Ao confirmar, o pedido vai para o Processos de Pagamento (Monday) com o extrato das viagens. Se for recusado,
                            você vê o motivo e pode retomar as viagens para corrigir e pedir de novo.
                        </p>
                    </div>
                )}

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={confirmar} disabled={!podeEnviar || enviando} className="bg-amber-500 hover:bg-amber-600 text-white">
                        {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Confirmar solicitação
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
