"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
    PdiPapel, PdiTipoMomento,
    formatarDataBr, formatarTiposComOpcoes, formatarLista, nomesDosPapeis,
    PDI_STATUS_LABEL, PDI_STATUS_BADGE_CLASS,
} from "@/lib/pdi"

interface DetalheSolicitacaoDialogProps {
    solicitacao: any
    papeis: PdiPapel[]
    tipos: PdiTipoMomento[]
    onClose: () => void
    onAlterado: () => void
}

export function DetalheSolicitacaoDialog({ solicitacao, papeis, tipos, onClose, onAlterado }: DetalheSolicitacaoDialogProps) {
    const [cancelando, setCancelando] = useState(false)

    const papeisNomes = nomesDosPapeis(papeis, solicitacao.cargos || [])
    const tiposTexto = formatarTiposComOpcoes(tipos, solicitacao.tipos || [], solicitacao.detalhes || {}, solicitacao.outro_texto)
    const podeCancelar = !['concluido', 'cancelado'].includes(solicitacao.status)
    const eventos = (solicitacao.pdi_eventos || []).slice().sort((a: any, b: any) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime())
    const aceites = (solicitacao.pdi_solicitacao_lideres || []).filter((l: any) => l.lider_id)

    async function cancelar() {
        setCancelando(true)
        try {
            const res = await fetch(`/api/pdi/solicitacoes/${solicitacao.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'cancelar' }),
            })
            const json = await res.json()
            if (!res.ok) {
                toast.error(json.error || 'Erro ao cancelar solicitação.')
                return
            }
            toast.success('Solicitação cancelada.')
            onAlterado()
        } finally {
            setCancelando(false)
        }
    }

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <div className="flex items-center justify-between gap-3 pr-6">
                        <DialogTitle>{tiposTexto}</DialogTitle>
                        <Badge variant="outline" className={PDI_STATUS_BADGE_CLASS[solicitacao.status]}>{PDI_STATUS_LABEL[solicitacao.status]}</Badge>
                    </div>
                </DialogHeader>
                <div className="space-y-4 pt-2 text-sm">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <span className="text-slate-400">Colaborador</span>
                            <p className="font-semibold">{solicitacao.colaborador?.nome}{solicitacao.colaborador?.nucleo_atual ? ` (${solicitacao.colaborador.nucleo_atual})` : ''}</p>
                        </div>
                        <div>
                            <span className="text-slate-400">Com quem</span>
                            <p className="font-semibold">{formatarLista(papeisNomes)}</p>
                        </div>
                        <div>
                            <span className="text-slate-400">Quando</span>
                            <p className="font-semibold">{formatarDataBr(solicitacao.data)} às {solicitacao.hora}</p>
                        </div>
                        <div>
                            <span className="text-slate-400">Quem aceitou</span>
                            <p className="font-semibold">{aceites.length > 0 ? aceites.map((a: any) => a.lider?.nome).filter(Boolean).join(', ') : '—'}</p>
                        </div>
                    </div>

                    {solicitacao.descricao && (
                        <div>
                            <span className="text-slate-400">Descrição</span>
                            <p className="mt-1">{solicitacao.descricao}</p>
                        </div>
                    )}

                    {eventos.length > 0 && (
                        <div>
                            <span className="text-slate-400">Histórico</span>
                            <div className="mt-2 space-y-1.5">
                                {eventos.map((e: any) => (
                                    <div key={e.id} className="text-xs text-slate-500 flex gap-2">
                                        <span className="text-slate-400 shrink-0">{new Date(e.criado_em).toLocaleDateString('pt-BR')}</span>
                                        <span>{e.texto}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {podeCancelar && (
                        <Button
                            variant="ghost"
                            disabled={cancelando}
                            onClick={cancelar}
                            className="w-full rounded-xl font-bold text-rose-500 hover:bg-rose-500/10 hover:text-rose-600"
                        >
                            {cancelando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Cancelar solicitação
                        </Button>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    )
}
