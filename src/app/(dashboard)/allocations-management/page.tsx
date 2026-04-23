"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { supabase } from "@/lib/supabase"
import { Briefcase, Search, Save, Minus, Plus, Users, FolderKanban, TrendingUp, Loader2 } from "lucide-react"
import { useSession } from "next-auth/react"

interface Colaborador {
    id: string
    nome: string
    cargo_atual: string
    nucleo_atual: string
    projetos: number
    email_corporativo: string
}

export default function AllocationsManagementPage() {
    const { data: session } = useSession()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)
    const [colaboradores, setColaboradores] = useState<Colaborador[]>([])
    const [search, setSearch] = useState("")
    const [filterNucleo, setFilterNucleo] = useState("all")
    const [editValues, setEditValues] = useState<Record<string, number>>({})

    const fetchColaboradores = useCallback(async () => {
        setLoading(true)
        const { data } = await supabase
            .from('colaboradores')
            .select('id, nome, cargo_atual, nucleo_atual, projetos, email_corporativo')
            .order('nome', { ascending: true })

        if (data) {
            setColaboradores(data as Colaborador[])
            const values: Record<string, number> = {}
            data.forEach(c => { values[c.id] = c.projetos || 0 })
            setEditValues(values)
        }
        setLoading(false)
    }, [])

    useEffect(() => { fetchColaboradores() }, [fetchColaboradores])

    const nucleos = Array.from(new Set(colaboradores.map(c => c.nucleo_atual).filter(Boolean)))

    const filtered = colaboradores.filter(c => {
        const matchSearch = c.nome.toLowerCase().includes(search.toLowerCase()) ||
            c.cargo_atual?.toLowerCase().includes(search.toLowerCase())
        const matchNucleo = filterNucleo === 'all' || c.nucleo_atual === filterNucleo
        return matchSearch && matchNucleo
    })

    const totalProjetos = colaboradores.reduce((sum, c) => sum + (c.projetos || 0), 0)
    const colabsComProjetos = colaboradores.filter(c => (c.projetos || 0) > 0).length
    const mediaProjetos = colaboradores.length > 0 ? (totalProjetos / colaboradores.length).toFixed(1) : '0'

    function increment(id: string) {
        setEditValues(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }))
    }

    function decrement(id: string) {
        setEditValues(prev => ({ ...prev, [id]: Math.max(0, (prev[id] || 0) - 1) }))
    }

    async function saveAllocation(id: string) {
        setSaving(id)
        const newValue = editValues[id] || 0
        const colab = colaboradores.find(c => c.id === id)
        const oldValue = colab?.projetos || 0

        const { error } = await supabase
            .from('colaboradores')
            .update({ projetos: newValue })
            .eq('id', id)

        if (!error) {
            // Log the change
            const editorName = (session?.user as any)?.name || (session?.user as any)?.email || 'Sistema'
            if (oldValue !== newValue) {
                await supabase.from('audit_logs').insert({
                    colaborador_id: id,
                    campo: 'projetos',
                    valor_antigo: String(oldValue),
                    valor_novo: String(newValue),
                    editado_por: editorName,
                })
            }

            // Update local state
            setColaboradores(prev => prev.map(c =>
                c.id === id ? { ...c, projetos: newValue } : c
            ))
        }
        setSaving(null)
    }

    const hasChanged = (id: string) => {
        const colab = colaboradores.find(c => c.id === id)
        return (colab?.projetos || 0) !== (editValues[id] || 0)
    }

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="h-10 bg-slate-100 dark:bg-white/5 rounded-2xl animate-pulse w-1/3" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-100 dark:bg-white/5 rounded-2xl animate-pulse" />)}
                </div>
                <div className="h-96 bg-slate-100 dark:bg-white/5 rounded-3xl animate-pulse" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="bg-indigo-50 dark:bg-indigo-500/10 p-2.5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20">
                    <Briefcase className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        Gestão de <span className="text-primary">Alocações</span>
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Gerencie a quantidade de projetos alocados para cada consultor.
                    </p>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="bg-violet-50 dark:bg-violet-500/10 p-2 rounded-xl">
                            <FolderKanban className="h-4 w-4 text-violet-600 dark:text-violet-400" />
                        </div>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Total de Projetos</p>
                    </div>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">{totalProjetos}</p>
                    <p className="text-xs text-slate-500 mt-1">Alocados na equipe</p>
                </div>
                <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="bg-emerald-50 dark:bg-emerald-500/10 p-2 rounded-xl">
                            <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Com Projetos</p>
                    </div>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">{colabsComProjetos}</p>
                    <p className="text-xs text-slate-500 mt-1">Colaboradores alocados</p>
                </div>
                <div className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-slate-800/50 rounded-2xl p-5 shadow-sm">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="bg-amber-50 dark:bg-amber-500/10 p-2 rounded-xl">
                            <TrendingUp className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                        </div>
                        <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">Média por Pessoa</p>
                    </div>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">{mediaProjetos}</p>
                    <p className="text-xs text-slate-500 mt-1">Projetos por colaborador</p>
                </div>
            </div>

            {/* Allocations Table */}
            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="border-b border-slate-100 dark:border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Alocações por Colaborador</CardTitle>
                    <div className="flex items-center gap-3">
                        {nucleos.length > 0 && (
                            <select
                                value={filterNucleo}
                                onChange={e => setFilterNucleo(e.target.value)}
                                className="text-xs font-bold bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-3 py-2 text-slate-700 dark:text-slate-300 focus:ring-1 focus:ring-primary outline-none"
                            >
                                <option value="all">Todos os Núcleos</option>
                                {nucleos.map(n => <option key={n} value={n}>{n}</option>)}
                            </select>
                        )}
                        <div className="relative w-full sm:w-56">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                            <Input
                                placeholder="Buscar colaborador..."
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="pl-9 bg-slate-50 dark:bg-slate-900 border-none h-9 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-primary"
                            />
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {/* Table Header */}
                    <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-50 dark:bg-white/[0.02] border-b border-slate-100 dark:border-slate-800/50 text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        <div className="col-span-4">Colaborador</div>
                        <div className="col-span-2">Cargo</div>
                        <div className="col-span-2">Núcleo</div>
                        <div className="col-span-2 text-center">Projetos Alocados</div>
                        <div className="col-span-2 text-center">Ação</div>
                    </div>

                    {filtered.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                            <Briefcase className="h-10 w-10 opacity-20 mb-3" />
                            <p className="text-sm font-medium">Nenhum colaborador encontrado</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                            {filtered.map(colab => {
                                const val = editValues[colab.id] || 0
                                const changed = hasChanged(colab.id)
                                const isSaving = saving === colab.id

                                return (
                                    <div key={colab.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                                        {/* Name */}
                                        <div className="md:col-span-4 flex items-center gap-3">
                                            <div className="h-9 w-9 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center font-bold text-xs text-indigo-600 dark:text-indigo-400 shrink-0">
                                                {colab.nome.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{colab.nome}</p>
                                                <p className="text-[10px] text-slate-400 truncate">{colab.email_corporativo}</p>
                                            </div>
                                        </div>

                                        {/* Cargo */}
                                        <div className="md:col-span-2">
                                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{colab.cargo_atual || '—'}</span>
                                        </div>

                                        {/* Núcleo */}
                                        <div className="md:col-span-2">
                                            <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{colab.nucleo_atual || '—'}</span>
                                        </div>

                                        {/* Stepper */}
                                        <div className="md:col-span-2 flex items-center justify-center gap-1">
                                            <button
                                                onClick={() => decrement(colab.id)}
                                                className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                            >
                                                <Minus className="h-3.5 w-3.5" />
                                            </button>
                                            <div className={`h-8 w-14 rounded-lg flex items-center justify-center text-sm font-black transition-colors ${
                                                changed
                                                    ? 'bg-primary/10 text-primary border-2 border-primary/30'
                                                    : 'bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-700'
                                            }`}>
                                                {val}
                                            </div>
                                            <button
                                                onClick={() => increment(colab.id)}
                                                className="h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                            >
                                                <Plus className="h-3.5 w-3.5" />
                                            </button>
                                        </div>

                                        {/* Save */}
                                        <div className="md:col-span-2 flex justify-center">
                                            <Button
                                                size="sm"
                                                onClick={() => saveAllocation(colab.id)}
                                                disabled={!changed || isSaving}
                                                className={`h-8 px-4 rounded-xl text-xs font-bold transition-all ${
                                                    changed
                                                        ? 'bg-primary hover:bg-primary/90 text-white shadow-sm'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                                                }`}
                                            >
                                                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Save className="h-3.5 w-3.5 mr-1" /> Salvar</>}
                                            </Button>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
