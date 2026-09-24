"use client"
import { useEffect, useMemo, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { CalendarPlus, Loader2, Search } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { CARGO_FANTASMA } from "@/lib/cargos"
import { toast } from "sonner"

interface Membro {
    id: string
    nome: string
    nucleo_atual: string | null
    cargo_atual: string | null
}

function hoje(): string {
    return new Date().toLocaleDateString('en-CA')
}

function somarMinutos(hora: string, minutos: number): string {
    const [h, m] = hora.split(':').map(Number)
    const total = Math.min(h * 60 + m + minutos, 23 * 60 + 59)
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

// data + hora digitadas no fuso do navegador → instante ISO.
function paraIso(data: string, hora: string): string {
    return new Date(`${data}T${hora}`).toISOString()
}

const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

export function CreateReuniaoDialog({ open, onOpenChange, onCreated }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onCreated: () => void
}) {
    const [titulo, setTitulo] = useState("")
    const [local, setLocal] = useState("")
    const [descricao, setDescricao] = useState("")
    const [data, setData] = useState(hoje())
    const [inicio, setInicio] = useState("19:00")
    const [limite, setLimite] = useState("19:10")
    const [encerramento, setEncerramento] = useState("21:00")
    const [membros, setMembros] = useState<Membro[]>([])
    const [selecionados, setSelecionados] = useState<Set<string>>(new Set())
    const [busca, setBusca] = useState("")
    const [salvando, setSalvando] = useState(false)

    useEffect(() => {
        if (!open) return
        setTitulo(""); setLocal(""); setDescricao(""); setBusca("")
        setData(hoje()); setInicio("19:00"); setLimite("19:10"); setEncerramento("21:00")
        supabase
            .from('colaboradores')
            .select('id, nome, nucleo_atual, cargo_atual, users!inner(id)')
            .eq('status', 'Ativo')
            .neq('cargo_atual', CARGO_FANTASMA)
            .order('nome')
            .then(({ data }) => {
                const lista = (data || []) as unknown as Membro[]
                setMembros(lista)
                // Por padrão todo mundo é esperado; o organizador desmarca quem não é.
                setSelecionados(new Set(lista.map(m => m.id)))
            })
    }, [open])

    const porNucleo = useMemo(() => {
        const grupos = new Map<string, Membro[]>()
        for (const m of membros) {
            if (busca && !normalize(m.nome).includes(normalize(busca))) continue
            const nucleo = m.nucleo_atual?.trim() || 'Sem núcleo'
            grupos.set(nucleo, [...(grupos.get(nucleo) || []), m])
        }
        return [...grupos.entries()].sort(([a], [b]) => a.localeCompare(b, 'pt-BR'))
    }, [membros, busca])

    const alternar = (ids: string[], marcar: boolean) => {
        setSelecionados(prev => {
            const novo = new Set(prev)
            for (const id of ids) {
                if (marcar) novo.add(id)
                else novo.delete(id)
            }
            return novo
        })
    }

    const handleInicio = (valor: string) => {
        setInicio(valor)
        if (valor) {
            setLimite(somarMinutos(valor, 10))
            setEncerramento(somarMinutos(valor, 120))
        }
    }

    const salvar = async () => {
        if (!titulo.trim()) return toast.error('Informe o título da reunião.')
        if (!data || !inicio || !limite || !encerramento) return toast.error('Preencha data e horários.')
        if (limite < inicio) return toast.error('O limite de chegada não pode ser antes do início.')
        if (encerramento <= limite) return toast.error('O encerramento precisa ser depois do limite de chegada.')
        if (selecionados.size === 0) return toast.error('Selecione ao menos um participante.')

        setSalvando(true)
        const res = await fetch('/api/reunioes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                titulo, local, descricao,
                inicio: paraIso(data, inicio),
                limite_chegada: paraIso(data, limite),
                encerramento: paraIso(data, encerramento),
                participantes: [...selecionados],
            }),
        })
        const json = await res.json().catch(() => ({}))
        setSalvando(false)
        if (!res.ok) return toast.error(json.error || 'Erro ao criar reunião.')
        toast.success('Reunião agendada.')
        onOpenChange(false)
        onCreated()
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <DialogHeader>
                    <DialogTitle className="text-slate-900 dark:text-white font-display text-xl flex items-center gap-2">
                        <CalendarPlus className="h-5 w-5 text-primary" /> Nova reunião
                    </DialogTitle>
                    <DialogDescription>
                        Até o limite de chegada o membro confirma lendo o QR code. Depois disso, só com o código exibido na tela — e fica pré-pontuado por atraso. Quem não confirmar até o encerramento fica pré-pontuado por falta.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label>Título</Label>
                            <Input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Reunião Geral" maxLength={120} />
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label>Local <span className="text-slate-400 font-normal text-xs">(opcional)</span></Label>
                            <Input value={local} onChange={e => setLocal(e.target.value)} placeholder="Ex.: Sala 3 — Bloco B" />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Data</Label>
                            <Input type="date" value={data} onChange={e => setData(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Início</Label>
                            <Input type="time" value={inicio} onChange={e => handleInicio(e.target.value)} />
                        </div>
                        <div className="space-y-1.5">
                            <Label>Limite de chegada</Label>
                            <Input type="time" value={limite} onChange={e => setLimite(e.target.value)} />
                            <p className="text-[11px] text-slate-500">Até aqui vale o QR code.</p>
                        </div>
                        <div className="space-y-1.5">
                            <Label>Encerramento</Label>
                            <Input type="time" value={encerramento} onChange={e => setEncerramento(e.target.value)} />
                            <p className="text-[11px] text-slate-500">Até aqui dá para confirmar com o código.</p>
                        </div>
                        <div className="space-y-1.5 sm:col-span-2">
                            <Label>Descrição <span className="text-slate-400 font-normal text-xs">(opcional)</span></Label>
                            <Textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={2} />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                            <Label>Participantes ({selecionados.size}/{membros.length})</Label>
                            <div className="flex gap-1">
                                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => alternar(membros.map(m => m.id), true)}>Todos</Button>
                                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setSelecionados(new Set())}>Nenhum</Button>
                            </div>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar membro..." className="pl-8 h-9 text-xs" />
                        </div>
                        <div className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                            {porNucleo.map(([nucleo, lista]) => {
                                const todosMarcados = lista.every(m => selecionados.has(m.id))
                                return (
                                    <div key={nucleo} className="p-3 space-y-2">
                                        <label className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500 cursor-pointer">
                                            <Checkbox checked={todosMarcados} onCheckedChange={v => alternar(lista.map(m => m.id), !!v)} />
                                            {nucleo}
                                        </label>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pl-6">
                                            {lista.map(m => (
                                                <label key={m.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 cursor-pointer">
                                                    <Checkbox checked={selecionados.has(m.id)} onCheckedChange={v => alternar([m.id], !!v)} />
                                                    <span className="truncate">{m.nome}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                )
                            })}
                            {porNucleo.length === 0 && <p className="text-xs text-slate-400 italic text-center py-6">Nenhum membro encontrado.</p>}
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
                    <Button onClick={salvar} disabled={salvando}>
                        {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Agendar reunião
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
