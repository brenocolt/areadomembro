"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
    calcularLitros, dataMaisAntigaPermitida, formatarNumero, hojeBrasil, lerNumero,
    type GasolinaCentroCusto, type GasolinaVeiculo, type GasolinaViagem,
} from "@/lib/gasolina"
import { gasolinaApi } from "./api"

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
    const [buscaProjeto, setBuscaProjeto] = useState("")
    const [salvando, setSalvando] = useState(false)

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
        setBuscaProjeto("")
    }, [open, viagem, centros, veiculos, hoje])

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

    const projetosFiltrados = useMemo(() => {
        const termo = buscaProjeto.trim().toLowerCase()
        const lista = termo ? projetos.filter(p => p.toLowerCase().includes(termo)) : projetos
        // Garante que o projeto já escolhido continue aparecendo no Select.
        return projeto && !lista.includes(projeto) && projetos.includes(projeto) ? [projeto, ...lista] : lista
    }, [projetos, buscaProjeto, projeto])

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
                                    {projetos.length > 8 && (
                                        <Input placeholder="Buscar projeto" value={buscaProjeto} onChange={e => setBuscaProjeto(e.target.value)} />
                                    )}
                                    <Select value={projeto} onValueChange={setProjeto}>
                                        <SelectTrigger><SelectValue placeholder="Escolha o projeto" /></SelectTrigger>
                                        <SelectContent className="max-h-72">
                                            {projetosFiltrados.length === 0
                                                ? <div className="px-2 py-1.5 text-sm text-slate-500">Nenhum projeto encontrado.</div>
                                                : projetosFiltrados.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
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
                            <Input id="origem" value={origem} onChange={e => setOrigem(e.target.value)} placeholder="Ex.: UFRN" />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="destino">Local de chegada *</Label>
                            <Input id="destino" value={destino} onChange={e => setDestino(e.target.value)} placeholder="Ex.: Cliente X" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label>Paradas (caronas)</Label>
                        {paradas.map((p, i) => (
                            <div key={i} className="flex gap-2">
                                <Input value={p} onChange={e => setParadas(ps => ps.map((x, j) => j === i ? e.target.value : x))} placeholder={`Parada ${i + 1}`} />
                                <Button variant="ghost" size="icon" className="shrink-0" title="Remover parada"
                                    onClick={() => setParadas(ps => ps.filter((_, j) => j !== i))}>
                                    <Trash2 className="h-4 w-4" />
                                </Button>
                            </div>
                        ))}
                        {paradas.length < 10 && (
                            <Button variant="outline" size="sm" onClick={() => setParadas(ps => [...ps, ""])}>
                                <Plus className="h-4 w-4" /> Adicionar parada
                            </Button>
                        )}
                    </div>

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
                        Some todos os trechos (com as paradas). Viagens podem ser lançadas até 2 meses depois da data.
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
