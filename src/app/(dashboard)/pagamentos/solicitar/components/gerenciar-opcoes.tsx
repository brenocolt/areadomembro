"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { Check, ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Pencil, Plus, X } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Edição das listas do formulário (só VP e administradores — a API confere).
// Ocultar em vez de apagar: a opção some do formulário, mas as solicitações
// antigas continuam com o texto que foi escolhido na época.

interface Linha { id: string, lista: string, valor: string, ordem: number, ativo: boolean }

export function GerenciarOpcoes({ aberto, onFechar }: { aberto: boolean, onFechar: () => void }) {
    const [listas, setListas] = useState<{ chave: string, rotulo: string }[]>([])
    const [linhas, setLinhas] = useState<Linha[]>([])
    const [lista, setLista] = useState("projeto")
    const [novo, setNovo] = useState("")
    const [editando, setEditando] = useState<{ id: string, valor: string } | null>(null)
    const [carregando, setCarregando] = useState(false)
    const [salvando, setSalvando] = useState<string | null>(null)
    const [erro, setErro] = useState<string | null>(null)

    const carregar = useCallback(async () => {
        setCarregando(true)
        try {
            const res = await fetch("/api/pagamentos/opcoes?gerenciar=1", { cache: "no-store" })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) { setErro(json.error || "Não foi possível carregar as listas."); return }
            setListas(json.listas ?? [])
            setLinhas(json.linhas ?? [])
            setErro(null)
        } catch {
            setErro("Sem conexão com o portal.")
        } finally {
            setCarregando(false)
        }
    }, [])
    useEffect(() => { if (aberto) carregar() }, [aberto, carregar])

    const daLista = useMemo(() => linhas.filter(l => l.lista === lista), [linhas, lista])
    const ativas = daLista.filter(l => l.ativo).length

    // Executa uma alteração e recarrega a lista.
    const agir = async (chave: string, url: string, init: RequestInit) => {
        setSalvando(chave); setErro(null)
        try {
            const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) { setErro(json.error || "Não foi possível salvar."); return false }
            await carregar()
            return true
        } catch {
            setErro("Sem conexão com o portal."); return false
        } finally {
            setSalvando(null)
        }
    }

    const adicionar = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!novo.trim()) return
        if (await agir("novo", "/api/pagamentos/opcoes", { method: "POST", body: JSON.stringify({ lista, valor: novo }) })) setNovo("")
    }
    const salvarEdicao = async () => {
        if (!editando) return
        if (await agir(editando.id, `/api/pagamentos/opcoes/${editando.id}`, { method: "PATCH", body: JSON.stringify({ valor: editando.valor }) })) setEditando(null)
    }
    const patch = (l: Linha, corpo: object) => agir(l.id, `/api/pagamentos/opcoes/${l.id}`, { method: "PATCH", body: JSON.stringify(corpo) })

    return (
        <Dialog open={aberto} onOpenChange={v => { if (!v) onFechar() }}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="font-display">Opções do formulário</DialogTitle>
                    <DialogDescription>
                        As mudanças valem na hora para quem abrir o formulário. Opções ocultas somem do formulário,
                        mas as solicitações já enviadas não mudam.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-1.5">
                    <Label htmlFor="lista-opcoes">Lista</Label>
                    <Select value={lista} onValueChange={v => { setLista(v); setEditando(null); setErro(null) }}>
                        <SelectTrigger id="lista-opcoes" className="w-full"><SelectValue placeholder="Escolha a lista" /></SelectTrigger>
                        <SelectContent>
                            {listas.map(l => <SelectItem key={l.chave} value={l.chave}>{l.rotulo}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>

                <form onSubmit={adicionar} className="flex gap-2">
                    <Input aria-label="Nova opção" placeholder="Nova opção" value={novo} maxLength={120} onChange={e => setNovo(e.target.value)} />
                    <Button type="submit" disabled={!novo.trim() || salvando === "novo"} className="bg-amber-500 hover:bg-amber-600 text-white font-semibold shrink-0">
                        {salvando === "novo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Adicionar
                    </Button>
                </form>

                {erro && <p role="alert" className="rounded-lg bg-red-50 dark:bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-300">{erro}</p>}

                <div className="flex items-center justify-between text-xs text-slate-500">
                    <span>{ativas} opção(ões) no formulário{daLista.length > ativas ? ` · ${daLista.length - ativas} oculta(s)` : ""}</span>
                    {carregando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                </div>

                <ul className="divide-y divide-slate-100 dark:divide-white/5 rounded-xl border border-slate-200 dark:border-white/10" data-testid="lista-opcoes">
                    {daLista.length === 0 && !carregando && (
                        <li className="px-3 py-6 text-center text-sm text-slate-400">
                            Lista vazia: no formulário, esta pergunta vira um campo de texto livre.
                        </li>
                    )}
                    {daLista.map((l, i) => (
                        <li key={l.id} className={`flex items-center gap-2 px-3 py-2 text-sm ${l.ativo ? "" : "opacity-50"}`}>
                            {editando?.id === l.id ? (
                                <>
                                    <Input aria-label="Editar opção" autoFocus value={editando.valor} maxLength={120} className="h-8"
                                        onChange={e => setEditando({ id: l.id, valor: e.target.value })}
                                        onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); salvarEdicao() } if (e.key === "Escape") setEditando(null) }} />
                                    <Button type="button" size="icon" variant="ghost" aria-label="Salvar" onClick={salvarEdicao} disabled={salvando === l.id}>
                                        {salvando === l.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-emerald-600" />}
                                    </Button>
                                    <Button type="button" size="icon" variant="ghost" aria-label="Cancelar" onClick={() => setEditando(null)}><X className="h-4 w-4" /></Button>
                                </>
                            ) : (
                                <>
                                    <span className="flex-1 min-w-0 truncate text-slate-800 dark:text-slate-100">
                                        {l.valor}{!l.ativo && <span className="ml-2 text-xs text-slate-400">(oculta)</span>}
                                    </span>
                                    <div className="flex shrink-0 items-center">
                                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={`Subir ${l.valor}`} disabled={i === 0 || !!salvando} onClick={() => patch(l, { mover: "cima" })}><ChevronUp className="h-4 w-4" /></Button>
                                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={`Descer ${l.valor}`} disabled={i === daLista.length - 1 || !!salvando} onClick={() => patch(l, { mover: "baixo" })}><ChevronDown className="h-4 w-4" /></Button>
                                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={`Editar ${l.valor}`} disabled={!!salvando} onClick={() => setEditando({ id: l.id, valor: l.valor })}><Pencil className="h-4 w-4" /></Button>
                                        <Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={l.ativo ? `Ocultar ${l.valor}` : `Mostrar ${l.valor}`} disabled={!!salvando}
                                            onClick={() => patch(l, { ativo: !l.ativo })}>
                                            {l.ativo ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4 text-amber-600" />}
                                        </Button>
                                    </div>
                                </>
                            )}
                        </li>
                    ))}
                </ul>
            </DialogContent>
        </Dialog>
    )
}
