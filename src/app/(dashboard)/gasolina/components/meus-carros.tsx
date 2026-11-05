"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Car, Camera, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { useColaborador } from "@/hooks/use-supabase"
import { COMBUSTIVEIS, formatarNumero, type GasolinaVeiculo } from "@/lib/gasolina"
import { gasolinaApi } from "./api"

export function MeusCarros() {
    const [veiculos, setVeiculos] = useState<GasolinaVeiculo[]>([])
    const [carregando, setCarregando] = useState(true)
    const [excluindo, setExcluindo] = useState<string | null>(null)

    const carregar = useCallback(async () => {
        try {
            const r = await gasolinaApi<{ veiculos: GasolinaVeiculo[] }>("/api/gasolina/veiculos")
            setVeiculos(r.veiculos)
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setCarregando(false)
        }
    }, [])

    useEffect(() => { carregar() }, [carregar])

    async function excluir(v: GasolinaVeiculo) {
        if (!confirm(`Excluir o carro "${v.modelo}"? As viagens já lançadas com ele continuam no histórico.`)) return
        setExcluindo(v.id)
        try {
            await gasolinaApi(`/api/gasolina/veiculos/${v.id}`, { method: "DELETE" })
            toast.success("Carro excluído.")
            setVeiculos(lista => lista.filter(x => x.id !== v.id))
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setExcluindo(null)
        }
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-4">
                <div>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Car className="h-5 w-5 text-amber-500" />
                        Meus carros
                    </CardTitle>
                    <CardDescription className="mt-1">
                        A autonomia (quantos km o carro faz com 1 litro) é usada para calcular os litros de cada viagem.
                        Para mudar a autonomia, exclua o carro e cadastre de novo com uma nova foto — ou peça à VP.
                    </CardDescription>
                </div>
                <NovoCarroDialog onCriado={v => setVeiculos(lista => [...lista, v])} />
            </CardHeader>
            <CardContent>
                {carregando ? (
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                ) : veiculos.length === 0 ? (
                    <p className="text-sm text-slate-500">Nenhum carro cadastrado ainda. Cadastre o seu para poder lançar viagens.</p>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {veiculos.map(v => (
                            <div key={v.id} className="rounded-xl border border-slate-200 dark:border-white/10 overflow-hidden">
                                {v.foto_painel_url ? (
                                    <a href={v.foto_painel_url} target="_blank" rel="noreferrer" title="Ver foto do painel">
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={v.foto_painel_url} alt={`Painel do ${v.modelo}`} className="h-36 w-full object-cover bg-slate-100" />
                                    </a>
                                ) : (
                                    <div className="flex h-36 w-full items-center justify-center bg-slate-100 dark:bg-white/5 px-4 text-center text-xs text-slate-500">
                                        Sem foto do painel — carro importado da planilha
                                    </div>
                                )}
                                <div className="p-4 space-y-1">
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="font-semibold text-slate-900 dark:text-white">{v.modelo}</p>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-8 w-8 text-red-500 hover:text-red-600"
                                            onClick={() => excluir(v)}
                                            disabled={excluindo === v.id}
                                            title="Excluir carro"
                                        >
                                            {excluindo === v.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                                        </Button>
                                    </div>
                                    <p className="text-sm text-slate-500">{[v.ano, v.combustivel].filter(Boolean).join(" · ")}</p>
                                    <p className="text-sm">
                                        <span className="font-semibold">{formatarNumero(v.autonomia_km_l, 1)} km/L</span>
                                        {v.autonomia_alterada_em && (
                                            <span className="text-xs text-amber-600 ml-2">
                                                (ajustada pela VP — você informou {formatarNumero(v.autonomia_informada, 1)})
                                            </span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

function NovoCarroDialog({ onCriado }: { onCriado: (v: GasolinaVeiculo) => void }) {
    const { colaboradorId } = useColaborador()
    const [open, setOpen] = useState(false)
    const [modelo, setModelo] = useState("")
    const [ano, setAno] = useState("")
    const [combustivel, setCombustivel] = useState("")
    const [autonomia, setAutonomia] = useState("")
    const [foto, setFoto] = useState<File | null>(null)
    const [salvando, setSalvando] = useState(false)
    const fotoRef = useRef<HTMLInputElement>(null)

    function limpar() {
        setModelo(""); setAno(""); setCombustivel(""); setAutonomia(""); setFoto(null)
        if (fotoRef.current) fotoRef.current.value = ""
    }

    async function salvar() {
        if (!foto) { toast.error("Anexe a foto do painel mostrando a autonomia."); return }
        if (!foto.type.startsWith("image/")) { toast.error("A foto precisa ser uma imagem."); return }
        if (foto.size > 10 * 1024 * 1024) { toast.error("A foto pode ter no máximo 10 MB."); return }

        setSalvando(true)
        try {
            // Upload direto ao bucket público, mesmo padrão do comprovante de milhas.
            const ext = foto.name.split(".").pop() || "jpg"
            const caminho = `${colaboradorId}/${Date.now()}.${ext}`
            const { error: uploadError } = await supabase.storage.from("gasolina-paineis").upload(caminho, foto)
            if (uploadError) throw new Error("Erro ao enviar a foto: " + uploadError.message)
            const { data: url } = supabase.storage.from("gasolina-paineis").getPublicUrl(caminho)

            const r = await gasolinaApi<{ veiculo: GasolinaVeiculo }>("/api/gasolina/veiculos", {
                method: "POST",
                body: JSON.stringify({ modelo, ano, combustivel, autonomia_km_l: autonomia, foto_painel_url: url.publicUrl }),
            })
            onCriado(r.veiculo)
            toast.success("Carro cadastrado!")
            limpar()
            setOpen(false)
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setSalvando(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={o => { setOpen(o); if (!o) limpar() }}>
            <DialogTrigger asChild>
                <Button className="bg-amber-500 hover:bg-amber-600 text-white font-semibold shrink-0">
                    <Plus className="h-4 w-4" /> Adicionar carro
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px]">
                <DialogHeader>
                    <DialogTitle>Adicionar carro</DialogTitle>
                    <DialogDescription>Os dados ficam visíveis para a Vice Presidência conferir.</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="modelo">Modelo *</Label>
                        <Input id="modelo" value={modelo} onChange={e => setModelo(e.target.value)} placeholder="Ex.: Fiat Mobi" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                            <Label htmlFor="ano">Ano</Label>
                            <Input id="ano" inputMode="numeric" value={ano} onChange={e => setAno(e.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="Ex.: 2020" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Combustível *</Label>
                            <Select value={combustivel} onValueChange={setCombustivel}>
                                <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                                <SelectContent>
                                    {COMBUSTIVEIS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="autonomia">Autonomia (km por litro) *</Label>
                        <Input id="autonomia" inputMode="decimal" value={autonomia} onChange={e => setAutonomia(e.target.value)} placeholder="Ex.: 10,5" />
                        <p className="text-xs text-slate-500">Quantos km o carro faz com 1 litro, como mostra o painel.</p>
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="foto">Foto do painel mostrando a autonomia *</Label>
                        <Input id="foto" ref={fotoRef} type="file" accept="image/*" onChange={e => setFoto(e.target.files?.[0] ?? null)} />
                        <p className="text-xs text-slate-500 flex items-center gap-1"><Camera className="h-3 w-3" /> Imagem de até 10 MB.</p>
                    </div>
                </div>
                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button onClick={salvar} disabled={salvando || !modelo.trim() || !combustivel || !autonomia.trim() || !foto}>
                        {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
                        Cadastrar
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
