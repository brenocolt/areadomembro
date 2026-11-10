"use client"

import { useEffect, useState } from "react"
import { Loader2, Map as MapaIcon, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    calcularLitros, dataMaisAntigaPermitida, formatarNumero, hojeBrasil, lerNumero,
    type GasolinaCentroCusto, type GasolinaVeiculo, type GasolinaViagem, type RotaViagem,
} from "@/lib/gasolina"
import { gasolinaApi } from "./api"
import { EnderecoInput } from "./endereco-input"
import { ProjetoBusca } from "./projeto-busca"
import { RotaOpcoes } from "./rota-opcoes"

interface Props {
    open: boolean
    onOpenChange: (open: boolean) => void
    viagem: GasolinaViagem | null          // null = nova viagem
    veiculos: GasolinaVeiculo[]
    centros: GasolinaCentroCusto[]
    onSalva: () => void
}

export function ViagemDialog({ open, onOpenChange, viagem, veiculos, centros, onSalva }: Props) {
    const [centroId, setCentroId] = useState("")
    const [projeto, setProjeto] = useState("")
    const [veiculoId, setVeiculoId] = useState("")
    const [origem, setOrigem] = useState("")
    const [destino, setDestino] = useState("")
    const [paradas, setParadas] = useState<string[]>([])
    const [km, setKm] = useState("")
    const [data, setData] = useState("")
    const [projetos, setProjetos] = useState<string[]>([])
    const [carregandoProjetos, setCarregandoProjetos] = useState(false)
    const [salvando, setSalvando] = useState(false)
    const [idaEVolta, setIdaEVolta] = useState(false)
    const [mapsAtivo, setMapsAtivo] = useState(false)
    const [rota, setRota] = useState<RotaViagem | null>(null)
    const [calculando, setCalculando] = useState(false)

    const centro = centros.find(c => c.id === centroId)
    const hoje = hojeBrasil()

    // Preenche ao abrir (edição) ou limpa (nova viagem).
    useEffect(() => {
        if (!open) return
        setCentroId(viagem?.centro_custo_id ?? (centros.length === 1 ? centros[0].id : ""))
        setProjeto(viagem?.projeto ?? "")
        setVeiculoId(viagem?.veiculo_id ?? (veiculos.length === 1 ? veiculos[0].id : ""))
        setOrigem(viagem?.origem_local ?? "")
        setDestino(viagem?.destino_local ?? "")
        setParadas(viagem?.paradas ?? [])
        setKm(viagem ? String(viagem.distancia_km).replace(".", ",") : "")
        setData(viagem?.data_viagem ?? hoje)
        setIdaEVolta(viagem?.rota?.ida_e_volta ?? false)
        setRota(viagem?.rota ?? null)
    }, [open, viagem, centros, veiculos, hoje])

    // Google Maps ligado no servidor? (sem chave, o formulário fica como antes)
    useEffect(() => {
        if (!open) return
        gasolinaApi<{ ativo: boolean }>("/api/gasolina/mapas").then(r => setMapsAtivo(r.ativo)).catch(() => setMapsAtivo(false))
    }, [open])

    // A rota mostrada só vale para o trajeto exato em que foi calculada.
    const pontosAtuais = [origem, ...paradas, destino, ...(idaEVolta ? [origem] : [])].map(p => p.trim()).filter(Boolean)
    const rotaValida = rota && JSON.stringify(rota.pontos) === JSON.stringify(pontosAtuais) ? rota : null

    // O membro marca qual caminho fez; os km passam a ser os dessa rota.
    function escolherRota(i: number) {
        if (!rota?.opcoes?.[i]) return
        const o = rota.opcoes[i]
        setRota({ ...rota, escolhida: i, distancia_km: o.distancia_km, duracao_min: o.duracao_min })
        setKm(String(o.distancia_km).replace(".", ","))
    }

    async function calcularKm() {
        setCalculando(true)
        try {
            const r = await gasolinaApi<{ rota: RotaViagem }>("/api/gasolina/mapas/rota", {
                method: "POST",
                body: JSON.stringify({ origem, destino, paradas: paradas.filter(p => p.trim()), ida_e_volta: idaEVolta }),
            })
            setRota(r.rota)
            setKm(String(r.rota.distancia_km).replace(".", ","))
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setCalculando(false)
        }
    }

    // Lista de projetos do Monday para o centro escolhido.
    useEffect(() => {
        if (!open || !centro || centro.tipo !== "projeto") { setProjetos([]); return }
        let cancelado = false
        setCarregandoProjetos(true)
        gasolinaApi<{ projetos: string[] }>(`/api/gasolina/projetos?centro=${centro.id}`)
            .then(r => { if (!cancelado) setProjetos(r.projetos) })
            .catch(e => toast.error(e.message))
            .finally(() => { if (!cancelado) setCarregandoProjetos(false) })
        return () => { cancelado = true }
    }, [open, centro])

    const veiculo = veiculos.find(v => v.id === veiculoId)
    const kmNumero = lerNumero(km)
    const litrosPrevia = veiculo && kmNumero && kmNumero > 0 ? calcularLitros(kmNumero, veiculo.autonomia_km_l) : null

    async function salvar() {
        setSalvando(true)
        try {
            await gasolinaApi(viagem ? `/api/gasolina/viagens/${viagem.id}` : "/api/gasolina/viagens", {
                method: viagem ? "PATCH" : "POST",
                body: JSON.stringify({
                    centro_custo_id: centroId,
                    projeto: centro?.tipo === "fixo" ? centro.rotulo_fixo : projeto,
                    veiculo_id: veiculoId,
                    origem_local: origem,
                    destino_local: destino,
                    paradas: paradas.filter(p => p.trim()),
                    distancia_km: km,
                    data_viagem: data,
                    ida_e_volta: idaEVolta,
                    rota_escolhida: rotaValida?.escolhida ?? 0,
                }),
            })
            toast.success(viagem ? "Viagem atualizada." : "Viagem lançada!")
            onSalva()
            onOpenChange(false)
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setSalvando(false)
        }
    }

    const completo = centroId && veiculoId && origem.trim() && destino.trim() && km.trim() && data
        && (centro?.tipo === "fixo" || projeto)

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{viagem ? "Editar viagem" : "Lançar viagem"}</DialogTitle>
                    <DialogDescription>
                        Informe o trajeto feito a serviço da Produtiva. Os litros e o valor são calculados automaticamente.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label>Centro de custo *</Label>
                        <Select value={centroId} onValueChange={v => { setCentroId(v); setProjeto("") }}>
                            <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                            <SelectContent>
                                {centros.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    {centro?.tipo === "projeto" && (
                        <div className="space-y-1.5">
                            <Label>Projeto *</Label>
                            {carregandoProjetos ? (
                                <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Carregando projetos do Monday...</p>
                            ) : (
                                <>
                                    <ProjetoBusca opcoes={projetos} valor={projeto} onChange={setProjeto} />
                                    <p className="text-xs text-slate-500">Lista do Monday. Se o projeto não estiver aqui, peça à VP para cadastrá-lo.</p>
                                </>
                            )}
                        </div>
                    )}
                    {centro?.tipo === "fixo" && (
                        <p className="text-sm text-slate-500">Projeto: <span className="font-semibold">{centro.rotulo_fixo}</span></p>
                    )}

                    <div className="space-y-1.5">
                        <Label>Carro *</Label>
                        <Select value={veiculoId} onValueChange={setVeiculoId}>
                            <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                            <SelectContent>
                                {veiculos.map(v => (
                                    <SelectItem key={v.id} value={v.id}>{v.modelo} · {formatarNumero(v.autonomia_km_l, 1)} km/L</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="grid sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="origem">Local de saída *</Label>
                            <EnderecoInput id="origem" value={origem} onChange={setOrigem} placeholder="Ex.: UFRN" sugerir={mapsAtivo} />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="destino">Local de chegada *</Label>
                            <EnderecoInput id="destino" value={destino} onChange={setDestino} placeholder="Ex.: Cliente X" sugerir={mapsAtivo} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Paradas (caronas)</Label>
                        {paradas.map((p, i) => (
                            <div key={i} className="flex gap-2">
                                <div className="flex-1">
                                    <EnderecoInput value={p} onChange={v => setParadas(ps => ps.map((x, j) => j === i ? v : x))} placeholder={`Parada ${i + 1}`} sugerir={mapsAtivo} />
                                </div>
                                <Button variant="ghost" size="icon" className="shrink-0" title="Remover parada"
                                    onClick={() => setParadas(ps => ps.filter((_, j) => j !== i))}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        {paradas.length < (idaEVolta ? 9 : 10) && (
                            <Button variant="outline" size="sm" onClick={() => setParadas(ps => [...ps, ""])}>
                                <Plus className="h-4 w-4" /> Adicionar parada
                            </Button>
                        )}
                    </div>

                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <Checkbox checked={idaEVolta} onCheckedChange={v => setIdaEVolta(v === true)} />
                        Ida e volta (voltei ao local de saída)
                    </label>

                    {mapsAtivo && (
                        <div className="rounded-md border border-dashed p-3 space-y-1.5">
                            <Button variant="outline" size="sm" onClick={calcularKm} disabled={calculando || !origem.trim() || !destino.trim()}>
                                {calculando ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapaIcon className="h-4 w-4" />}
                                Calcular km pelo Google Maps
                            </Button>
                            {rotaValida ? (
                                <div className="space-y-1.5 pt-1">
                                    <p className="text-xs font-medium text-slate-700 dark:text-slate-200">Qual caminho você fez?</p>
                                    <RotaOpcoes rota={rotaValida} onEscolher={escolherRota} />
                                    {lerNumero(km) !== rotaValida.distancia_km && (
                                        <p className="text-xs text-slate-500">Você informou outro valor de km. Tudo bem se o caminho foi diferente dessas opções.</p>
                                    )}
                                </div>
                            ) : (
                                <p className="text-xs text-slate-500">Preencha saída, paradas e chegada e clique para ver as opções de caminho e preencher os km. Você ainda pode ajustar o valor.</p>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="km">Distância total (km) *</Label>
                            <Input id="km" inputMode="decimal" value={km} onChange={e => setKm(e.target.value)} placeholder="Ex.: 14,2" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="data">Data *</Label>
                            <Input id="data" type="date" value={data} min={dataMaisAntigaPermitida(hoje)} max={hoje} onChange={e => setData(e.target.value)} />
                        </div>
                    </div>
                    <p className="text-xs text-slate-500">
                        {mapsAtivo ? "Confira se os km batem com o trajeto feito." : <>Some todos os trechos (com as paradas{idaEVolta ? " e a volta" : ""}).</>} Viagens podem ser lançadas até 2 meses depois da data.
                        {litrosPrevia !== null && <> Estimativa: <span className="font-semibold">{formatarNumero(litrosPrevia, 2)} L</span>.</>}
                    </p>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={salvar} disabled={salvando || !completo}>
                        {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                        {viagem ? "Salvar" : "Lançar viagem"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
