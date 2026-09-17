"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Plus, Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { PdiTipoMomento } from "@/lib/pdi"

function slugify(texto: string): string {
    return texto
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
}

interface TipoMomentoDialogProps {
    tipo: PdiTipoMomento | null // null = criar novo
    open: boolean
    onOpenChange: (open: boolean) => void
    onSalvo: () => void
    ordemSeguinte: number
}

export function TipoMomentoDialog({ tipo, open, onOpenChange, onSalvo, ordemSeguinte }: TipoMomentoDialogProps) {
    const [nome, setNome] = useState('')
    const [descricao, setDescricao] = useState('')
    const [subLabel, setSubLabel] = useState('Áreas')
    const [subOpcoes, setSubOpcoes] = useState<string[]>([])
    const [salvando, setSalvando] = useState(false)

    useEffect(() => {
        if (open) {
            setNome(tipo?.nome || '')
            setDescricao(tipo?.descricao || '')
            setSubLabel(tipo?.sub_label || 'Áreas')
            setSubOpcoes(tipo?.sub_opcoes && tipo.sub_opcoes.length > 0 ? tipo.sub_opcoes : ['Opção 1'])
        }
    }, [open, tipo])

    async function handleSalvar() {
        if (!nome.trim()) {
            toast.error('Informe o nome do tipo de momento.')
            return
        }
        const opcoesValidas = subOpcoes.map(o => o.trim()).filter(Boolean)
        if (opcoesValidas.length === 0) {
            toast.error('Adicione ao menos uma opção.')
            return
        }
        setSalvando(true)
        try {
            const payload = {
                nome: nome.trim(),
                descricao: descricao.trim() || null,
                sub_label: subLabel.trim() || 'Áreas',
                sub_opcoes: opcoesValidas,
            }
            if (tipo) {
                const { error } = await supabase.from('pdi_tipos_momento').update(payload).eq('id', tipo.id)
                if (error) throw error
                toast.success('Tipo atualizado!')
            } else {
                const id = slugify(nome) || `tipo_${Date.now()}`
                const { error } = await supabase.from('pdi_tipos_momento').insert({
                    id, ...payload, ativo: true, ordem: ordemSeguinte,
                })
                if (error) throw error
                toast.success('Tipo criado!')
            }
            onSalvo()
        } catch (err: any) {
            toast.error('Erro ao salvar: ' + (err.message || 'erro desconhecido'))
        } finally {
            setSalvando(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[460px]">
                <DialogHeader>
                    <DialogTitle>{tipo ? 'Editar tipo de momento' : 'Novo tipo de momento'}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                        <Label>Nome</Label>
                        <Input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex: Cronograma" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Descrição curta (opcional)</Label>
                        <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Ex: Planejamento do PDI" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Rótulo das opções</Label>
                        <Input value={subLabel} onChange={(e) => setSubLabel(e.target.value)} placeholder="Ex: Áreas" />
                    </div>
                    <div className="space-y-1.5">
                        <Label>Opções</Label>
                        {subOpcoes.map((op, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <Input
                                    value={op}
                                    onChange={(e) => setSubOpcoes(opts => opts.map((o, idx) => idx === i ? e.target.value : o))}
                                    className="h-8 text-sm"
                                />
                                <button type="button" onClick={() => setSubOpcoes(opts => opts.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-rose-500">
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                        <button
                            type="button"
                            onClick={() => setSubOpcoes(opts => [...opts, `Opção ${opts.length + 1}`])}
                            className="text-xs text-primary font-bold hover:underline flex items-center gap-1"
                        >
                            <Plus className="w-3 h-3" /> Adicionar opção
                        </button>
                    </div>
                    <Button onClick={handleSalvar} disabled={salvando} className="w-full rounded-xl font-bold">
                        {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Salvar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
