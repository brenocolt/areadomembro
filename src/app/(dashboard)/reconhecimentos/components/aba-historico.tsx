"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { api, mensagemDeErro } from "@/lib/reconhecimentos/cliente"
import { descreverEvento } from "@/lib/reconhecimentos/apresentacao"
import { normalizar } from "@/lib/reconhecimentos/datas"
import type { DadosReconhecimentos, EventoHistorico } from "@/lib/reconhecimentos/tipos"
import { LinhaDoTempo } from "./linha-do-tempo"

const LOTE = 100
const CATEGORIAS = [
    { value: "todas", label: "Todos os eventos" },
    { value: "reconhecimento", label: "Reconhecimentos" },
    { value: "bonificacao", label: "Bonificações" },
    { value: "entrega", label: "Solicitações e entregas" },
    { value: "configuracao", label: "Configurações" },
]

export function AbaHistorico({ dados, versao }: { dados: DadosReconhecimentos; versao: number }) {
    const [eventos, setEventos] = useState<EventoHistorico[]>([])
    const [carregando, setCarregando] = useState(true)
    const [temMais, setTemMais] = useState(false)
    const [erro, setErro] = useState("")
    const [busca, setBusca] = useState("")
    const [categoria, setCategoria] = useState("todas")

    const buscar = useCallback(async (antes?: string) => {
        try {
            const qs = new URLSearchParams({ limite: String(LOTE) })
            if (antes) qs.set("antes", antes)
            const r = await api<{ eventos: EventoHistorico[] }>(`/api/reconhecimentos/historico?${qs}`)
            setEventos(atual => (antes ? [...atual, ...r.eventos] : r.eventos))
            setTemMais(r.eventos.length === LOTE)
            setErro("")
        } catch (e) {
            setErro(mensagemDeErro(e, "Não foi possível carregar o histórico."))
        } finally {
            setCarregando(false)
        }
    }, [])

    useEffect(() => { void buscar() }, [buscar, versao])

    const contexto = useMemo(() => ({ tipos: dados.tipos, bonificacoes: dados.bonificacoes }), [dados.tipos, dados.bonificacoes])
    const visiveis = useMemo(() => {
        const q = normalizar(busca.trim())
        return eventos.filter(e => {
            const d = descreverEvento(e, contexto)
            if (categoria !== "todas" && d.categoria !== categoria) return false
            return !q || normalizar(`${d.titulo} ${d.detalhes.join(" ")} ${e.usuario_email}`).includes(q)
        })
    }, [eventos, busca, categoria, contexto])

    return (
        <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-[1fr_240px]">
                <Input placeholder="Pesquisar no histórico (nome, ação, usuário)..." value={busca} onChange={e => setBusca(e.target.value)} aria-label="Pesquisar no histórico" />
                <SearchableSelect value={categoria} onValueChange={setCategoria} options={CATEGORIAS} />
            </div>
            <Card>
                <CardContent className="p-5">
                    {erro ? <p className="text-sm text-destructive">{erro}</p>
                        : carregando ? <p className="py-6 text-center text-sm text-muted-foreground">Carregando histórico...</p>
                            : <LinhaDoTempo eventos={visiveis} contexto={contexto} vazio="Nenhum evento encontrado." />}
                    {temMais && !carregando && (
                        <div className="mt-4 flex justify-center">
                            <Button variant="outline" size="sm" onClick={() => void buscar(eventos[eventos.length - 1]?.created_at)}>Carregar eventos mais antigos</Button>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
