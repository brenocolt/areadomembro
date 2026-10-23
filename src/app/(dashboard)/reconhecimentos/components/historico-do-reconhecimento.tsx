"use client"

import { useEffect, useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { api, mensagemDeErro } from "@/lib/reconhecimentos/cliente"
import { sujeitoDe } from "@/lib/reconhecimentos/apresentacao"
import type { DadosReconhecimentos, EventoHistorico, Reconhecimento } from "@/lib/reconhecimentos/tipos"
import { LinhaDoTempo } from "./linha-do-tempo"

interface Props { reconhecimento: Reconhecimento | null; onFechar: () => void; dados: DadosReconhecimentos }

export function HistoricoDoReconhecimento({ reconhecimento, onFechar, dados }: Props) {
    const [eventos, setEventos] = useState<EventoHistorico[] | null>(null)
    const [erro, setErro] = useState("")
    const id = reconhecimento?.id

    useEffect(() => {
        if (!id) return
        let cancelado = false
        api<{ eventos: EventoHistorico[] }>(`/api/reconhecimentos/historico?reconhecimento_id=${id}`)
            .then(r => { if (!cancelado) { setEventos(r.eventos); setErro("") } })
            .catch(e => { if (!cancelado) setErro(mensagemDeErro(e, "Não foi possível carregar o histórico.")) })
        return () => { cancelado = true; setEventos(null) }
    }, [id])

    return (
        <Dialog open={!!reconhecimento} onOpenChange={o => { if (!o) onFechar() }}>
            <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Histórico do reconhecimento</DialogTitle>
                    <DialogDescription>{reconhecimento ? sujeitoDe(reconhecimento) : ""}</DialogDescription>
                </DialogHeader>
                {erro ? <p className="text-sm text-destructive">{erro}</p>
                    : eventos === null ? <p className="py-6 text-center text-sm text-muted-foreground">Carregando...</p>
                        : <LinhaDoTempo eventos={eventos} contexto={{ tipos: dados.tipos, bonificacoes: dados.bonificacoes }} />}
            </DialogContent>
        </Dialog>
    )
}
