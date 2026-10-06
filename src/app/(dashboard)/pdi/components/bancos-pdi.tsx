"use client"

import { useState, useEffect, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ExternalLink, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { PDI_BANCOS, PDI_BANCO_TIPOS, type PdiBancoItem, type PdiBancoTipo, type PdiTipoMomento } from "@/lib/pdi"

const SEM_CATEGORIA = '__nenhuma__'

interface BancosPdiProps {
    tipos: PdiTipoMomento[]
    colaboradorId: string
    isAdmin: boolean
}

function DialogItem({ tipo, categorias, item, onClose, onSalvo }: {
    tipo: PdiBancoTipo, categorias: string[], item: PdiBancoItem | null, onClose: () => void, onSalvo: () => void,
}) {
    const cfg = PDI_BANCOS[tipo]
    const [titulo, setTitulo] = useState(item?.titulo ?? '')
    const [conteudo, setConteudo] = useState(item?.conteudo ?? '')
    const [resposta, setResposta] = useState(item?.resposta ?? '')
    const [categoria, setCategoria] = useState(item?.categoria ?? SEM_CATEGORIA)
    const [link, setLink] = useState(item?.link ?? '')
    const [salvando, setSalvando] = useState(false)
    const [erro, setErro] = useState<string | null>(null)

    async function salvar() {
        if (!titulo.trim()) { setErro('Informe um título.'); return }
        setSalvando(true)
        setErro(null)
        try {
            const res = await fetch(item ? `/api/pdi/banco/${item.id}` : '/api/pdi/banco', {
                method: item ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    tipo, titulo, conteudo, link,
                    resposta: cfg.labelResposta ? resposta : null,
                    categoria: categoria === SEM_CATEGORIA ? null : categoria,
                }),
            })
            const json = await res.json()
            if (!res.ok) { setErro(json.error || 'Erro ao salvar.'); return }
            toast.success(item ? 'Atualizado.' : 'Adicionado ao banco.')
            onSalvo()
        } finally {
            setSalvando(false)
        }
    }

    return (
        <Dialog open onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>{item ? `Editar ${cfg.singular}` : `Novo ${cfg.singular}`}</DialogTitle>
                </DialogHeader>
                <div className="space-y-3 pt-2">
                    <div className="space-y-1.5">
                        <Label>Título</Label>
                        <Input value={titulo} maxLength={150} onChange={(e) => setTitulo(e.target.value)} />
                    </div>
                    {categorias.length > 0 && (
                        <div className="space-y-1.5">
                            <Label>{cfg.labelCategoria} (opcional)</Label>
                            <Select value={categoria} onValueChange={setCategoria}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={SEM_CATEGORIA}>Sem categoria</SelectItem>
                                    {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <Label>{cfg.labelConteudo}</Label>
                        <Textarea value={conteudo} onChange={(e) => setConteudo(e.target.value)} rows={5} maxLength={5000} />
                    </div>
                    {cfg.labelResposta && (
                        <div className="space-y-1.5">
                            <Label>{cfg.labelResposta} (opcional)</Label>
                            <Textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={4} maxLength={5000} />
                        </div>
                    )}
                    <div className="space-y-1.5">
                        <Label>Link de apoio (opcional)</Label>
                        <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://" />
                    </div>
                    {erro && <p className="text-sm text-rose-500">{erro}</p>}
                    <div className="flex justify-end gap-2 pt-2">
                        <Button variant="ghost" onClick={onClose} className="rounded-xl font-bold">Cancelar</Button>
                        <Button onClick={salvar} disabled={salvando} className="rounded-xl font-bold">
                            {salvando && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}

function ListaBanco({ tipo, tipos, colaboradorId, isAdmin }: { tipo: PdiBancoTipo } & BancosPdiProps) {
    const cfg = PDI_BANCOS[tipo]
    const categorias = useMemo(() => tipos.find(t => t.id === cfg.tipoMomentoId)?.sub_opcoes ?? [], [tipos, cfg.tipoMomentoId])
    const [itens, setItens] = useState<PdiBancoItem[]>([])
    const [loading, setLoading] = useState(true)
    const [busca, setBusca] = useState('')
    const [filtro, setFiltro] = useState('todas')
    const [editando, setEditando] = useState<PdiBancoItem | null>(null)
    const [criando, setCriando] = useState(false)
    const [abertos, setAbertos] = useState<Set<string>>(new Set())

    // `recarregar` só incrementa um contador: o efeito abaixo refaz a busca.
    const [versao, setVersao] = useState(0)
    const recarregar = () => setVersao(v => v + 1)

    useEffect(() => {
        let ativo = true
        fetch(`/api/pdi/banco?tipo=${tipo}`)
            .then(async res => {
                if (!ativo) return
                if (res.ok) setItens((await res.json()).itens || [])
                else toast.error('Erro ao carregar o banco.')
                setLoading(false)
            })
            .catch(() => { if (ativo) { toast.error('Erro ao carregar o banco.'); setLoading(false) } })
        return () => { ativo = false }
    }, [tipo, versao])

    async function excluir(item: PdiBancoItem) {
        if (!window.confirm(`Excluir "${item.titulo}" do banco?`)) return
        const res = await fetch(`/api/pdi/banco/${item.id}`, { method: 'DELETE' })
        if (!res.ok) { toast.error((await res.json()).error || 'Erro ao excluir.'); return }
        toast.success('Excluído.')
        recarregar()
    }

    function alternar(id: string) {
        setAbertos(prev => {
            const novo = new Set(prev)
            if (novo.has(id)) novo.delete(id); else novo.add(id)
            return novo
        })
    }

    const termo = busca.trim().toLowerCase()
    const visiveis = itens.filter(i =>
        (filtro === 'todas' || i.categoria === filtro) &&
        (!termo || [i.titulo, i.conteudo, i.resposta].some(t => t?.toLowerCase().includes(termo)))
    )

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <Input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={`Buscar em ${cfg.plural.toLowerCase()}`} className="pl-9" />
                </div>
                {categorias.length > 0 && (
                    <Select value={filtro} onValueChange={setFiltro}>
                        <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="todas">Todas as categorias</SelectItem>
                            {categorias.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                    </Select>
                )}
                <Button onClick={() => setCriando(true)} className="rounded-xl font-bold">
                    <Plus className="h-4 w-4 mr-2" /> Adicionar {cfg.singular}
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
            ) : visiveis.length === 0 ? (
                <p className="text-sm text-slate-400 italic py-4">
                    {itens.length === 0 ? `Nenhum ${cfg.singular} no banco ainda.` : 'Nada encontrado com esses filtros.'}
                </p>
            ) : (
                <div className="grid gap-3">
                    {visiveis.map(item => {
                        const aberto = abertos.has(item.id)
                        const podeEditar = item.autor_id === colaboradorId || isAdmin
                        return (
                            <div key={item.id} className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 shadow-sm">
                                <div className="flex items-start justify-between gap-3">
                                    <button type="button" onClick={() => alternar(item.id)} className="text-left min-w-0 flex-1">
                                        <p className="font-bold text-slate-900 dark:text-white">{item.titulo}</p>
                                        <p className="text-xs text-slate-400 mt-0.5">
                                            {item.autor?.nome ? `por ${item.autor.nome} · ` : ''}{new Date(item.criado_em).toLocaleDateString('pt-BR')}
                                        </p>
                                    </button>
                                    <div className="flex items-center gap-1 shrink-0">
                                        {item.categoria && <Badge variant="outline">{item.categoria}</Badge>}
                                        {podeEditar && (
                                            <>
                                                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditando(item)} aria-label="Editar"><Pencil className="h-4 w-4" /></Button>
                                                <Button size="icon" variant="ghost" className="h-8 w-8 text-rose-500 hover:text-rose-600" onClick={() => excluir(item)} aria-label="Excluir"><Trash2 className="h-4 w-4" /></Button>
                                            </>
                                        )}
                                    </div>
                                </div>
                                {aberto ? (
                                    <div className="mt-3 space-y-3 text-sm">
                                        {item.conteudo && (
                                            <div>
                                                <span className="text-slate-400">{cfg.labelConteudo}</span>
                                                <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 mt-1">{item.conteudo}</p>
                                            </div>
                                        )}
                                        {item.resposta && cfg.labelResposta && (
                                            <div>
                                                <span className="text-slate-400">{cfg.labelResposta}</span>
                                                <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300 mt-1">{item.resposta}</p>
                                            </div>
                                        )}
                                        {item.link && (
                                            <a href={item.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-primary font-semibold hover:underline">
                                                <ExternalLink className="h-4 w-4" /> Abrir material de apoio
                                            </a>
                                        )}
                                    </div>
                                ) : item.conteudo ? (
                                    <p className="mt-2 text-sm text-slate-500 line-clamp-2 cursor-pointer" onClick={() => alternar(item.id)}>{item.conteudo}</p>
                                ) : null}
                            </div>
                        )
                    })}
                </div>
            )}

            {(criando || editando) && (
                <DialogItem
                    tipo={tipo}
                    categorias={categorias}
                    item={editando}
                    onClose={() => { setCriando(false); setEditando(null) }}
                    onSalvo={() => { setCriando(false); setEditando(null); recarregar() }}
                />
            )}
        </div>
    )
}

export function BancosPdi(props: BancosPdiProps) {
    return (
        <Tabs defaultValue="case">
            <TabsList>
                {PDI_BANCO_TIPOS.map(t => <TabsTrigger key={t} value={t}>Banco de {PDI_BANCOS[t].plural.toLowerCase()}</TabsTrigger>)}
            </TabsList>
            {PDI_BANCO_TIPOS.map(t => (
                <TabsContent key={t} value={t} className="mt-4">
                    <ListaBanco tipo={t} {...props} />
                </TabsContent>
            ))}
        </Tabs>
    )
}
