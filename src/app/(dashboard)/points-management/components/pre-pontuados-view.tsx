"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { AlertOctagon, Check, X, Search, RefreshCw, Trash2, FileQuestion } from "lucide-react"
import { toast } from "sonner"

interface PrePontuado {
    id: string
    colaborador_id: string
    formulario_id: string | null
    descricao: string
    origem: string
    status: string
    created_at: string
    colaboradores?: { nome: string, cargo_atual?: string | null }
    formularios?: { titulo: string, tipo_formulario?: string | null } | null
}

export function PrePontuadosView() {
    const [items, setItems] = useState<PrePontuado[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [statusFilter, setStatusFilter] = useState<'PENDENTE' | 'CONFIRMADO' | 'REVOGADO' | 'TODOS'>('PENDENTE')

    const fetch = async () => {
        setLoading(true)
        const { data, error } = await supabase
            .from('pontos_pre_pontuacao')
            .select('*, colaboradores(nome, cargo_atual), formularios(titulo, tipo_formulario)')
            .order('created_at', { ascending: false })
        if (!error && data) setItems(data as any)
        setLoading(false)
    }

    useEffect(() => { fetch() }, [])

    const handleConfirm = async (item: PrePontuado) => {
        if (!confirm(`Confirmar pontuação de ${item.colaboradores?.nome}? Isso registrará uma ocorrência (1 ponto negativo).`)) return

        const { error: ocErr } = await supabase.from('ocorrencias').insert({
            colaborador_id: item.colaborador_id,
            data: new Date().toISOString(),
            cargo_na_epoca: item.colaboradores?.cargo_atual || '—',
            motivo: item.descricao,
            descricao: `Confirmação de pré-pontuação${item.formularios?.titulo ? ` (formulário: ${item.formularios.titulo})` : ''}.`,
            pontuacao: 1,
        })
        if (ocErr) {
            toast.error('Erro ao registrar ocorrência: ' + ocErr.message)
            return
        }
        await supabase.from('pontos_pre_pontuacao').update({ status: 'CONFIRMADO' }).eq('id', item.id)
        toast.success('Pontuação confirmada e ocorrência criada.')
        fetch()
    }

    const handleRevoke = async (item: PrePontuado) => {
        if (!confirm('Revogar esta pré-pontuação?')) return
        await supabase.from('pontos_pre_pontuacao').update({ status: 'REVOGADO' }).eq('id', item.id)
        toast.success('Pré-pontuação revogada.')
        fetch()
    }

    const handleDelete = async (item: PrePontuado) => {
        if (!confirm('Remover este registro de pré-pontuação?')) return
        await supabase.from('pontos_pre_pontuacao').delete().eq('id', item.id)
        toast.success('Registro removido.')
        fetch()
    }

    const normalize = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()

    const filtered = items.filter(it => {
        if (statusFilter !== 'TODOS' && it.status !== statusFilter) return false
        if (search.trim() !== '') {
            const nome = it.colaboradores?.nome || ''
            if (!normalize(nome).includes(normalize(search))) return false
        }
        return true
    })

    const statusBadge = (status: string) => {
        if (status === 'PENDENTE') return <Badge className="bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 font-bold text-[10px] uppercase tracking-wider border-none">Pendente</Badge>
        if (status === 'CONFIRMADO') return <Badge className="bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400 font-bold text-[10px] uppercase tracking-wider border-none">Confirmado</Badge>
        return <Badge className="bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider border-none">Revogado</Badge>
    }

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none rounded-3xl shadow-sm">
            <CardHeader className="border-b border-slate-100 dark:border-white/5 pb-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="bg-amber-50 dark:bg-amber-500/10 p-2 rounded-xl border border-amber-100 dark:border-amber-500/20">
                            <AlertOctagon className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                        </div>
                        <div>
                            <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Usuários Pré Pontuados</CardTitle>
                            <p className="text-xs text-slate-500">Sinalizados automaticamente (ex: não envio de formulário) ou manualmente. Confirmar gera uma ocorrência.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="relative w-56">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
                            <Input
                                placeholder="Buscar colaborador..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="pl-8 h-9 text-xs rounded-xl bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700"
                            />
                        </div>
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-0.5">
                            {(['PENDENTE', 'CONFIRMADO', 'REVOGADO', 'TODOS'] as const).map(s => (
                                <button key={s} onClick={() => setStatusFilter(s)}
                                    className={`px-3 py-1.5 text-[10px] font-bold rounded-lg transition-all uppercase tracking-wider ${statusFilter === s ? 'bg-white dark:bg-slate-700 text-violet-700 dark:text-violet-300 shadow-sm' : 'text-slate-500'}`}
                                >{s}</button>
                            ))}
                        </div>
                        <Button onClick={fetch} variant="ghost" size="icon" className="h-9 w-9 rounded-xl">
                            <RefreshCw className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-4">
                {loading ? (
                    <p className="text-sm text-slate-400 italic text-center py-8">Carregando...</p>
                ) : filtered.length === 0 ? (
                    <div className="text-center py-12 text-slate-400">
                        <AlertOctagon className="h-12 w-12 mx-auto mb-3 opacity-30" />
                        <p className="font-medium text-sm">Nenhum usuário pré pontuado {statusFilter !== 'TODOS' ? `com status ${statusFilter.toLowerCase()}` : ''}.</p>
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filtered.map(item => {
                            const initials = (item.colaboradores?.nome || '??').split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
                            const dateStr = new Date(item.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
                            return (
                                <div key={item.id} className="flex items-center gap-4 p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-slate-100 dark:hover:border-white/5">
                                    <div className="h-10 w-10 rounded-full bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-amber-400 border border-amber-100 dark:border-amber-500/20 shrink-0">
                                        {initials}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.colaboradores?.nome || 'Desconhecido'}</span>
                                            {statusBadge(item.status)}
                                            {item.origem === 'auto' && (
                                                <Badge className="bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 font-bold text-[10px] uppercase tracking-wider border-none">Auto</Badge>
                                            )}
                                            {item.formularios?.titulo && (
                                                <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 dark:text-slate-400">
                                                    <FileQuestion className="h-3 w-3" /> {item.formularios.titulo}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{item.descricao}</p>
                                        <p className="text-[10px] text-slate-400 mt-0.5">{item.colaboradores?.cargo_atual} · {dateStr}</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        {item.status === 'PENDENTE' && (
                                            <>
                                                <Button onClick={() => handleConfirm(item)} size="sm" className="h-8 px-3 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-500 dark:hover:text-white border border-rose-100 dark:border-rose-500/20 rounded-lg text-xs font-bold">
                                                    <Check className="h-3.5 w-3.5 mr-1" /> Confirmar
                                                </Button>
                                                <Button onClick={() => handleRevoke(item)} size="sm" variant="ghost" className="h-8 px-3 text-slate-500 hover:text-slate-700 dark:hover:text-white rounded-lg text-xs font-bold">
                                                    <X className="h-3.5 w-3.5 mr-1" /> Revogar
                                                </Button>
                                            </>
                                        )}
                                        <Button onClick={() => handleDelete(item)} size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-rose-600 rounded-lg" title="Remover registro">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
