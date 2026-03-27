"use client"
import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, X, ShieldAlert, LayoutGrid, List, Search } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function RemovalRequests() {
    const [viewMode, setViewMode] = useState<"list" | "kanban">("list")
    const [requests, setRequests] = useState<any[]>([])
    const [searchName, setSearchName] = useState("")
    const [filterNucleo, setFilterNucleo] = useState("all")

    useEffect(() => {
        async function fetch() {
            const { data } = await supabase
                .from('solicitacoes_remocao')
                .select('*, colaboradores!inner(nome, cargo_atual, nucleo_atual, users!inner(id))')
                .eq('status', 'PENDENTE')
                .order('created_at', { ascending: false })
                .limit(30)
            if (data) setRequests(data.map(r => ({
                id: r.id,
                colaborador_id: r.colaborador_id,
                ocorrencia_id: r.ocorrencia_id,
                pontos_solicitados: r.pontos_solicitados,
                comprovante_url: r.comprovante_url,
                name: r.colaboradores?.nome || 'Desconhecido',
                role: r.colaboradores?.cargo_atual || '',
                nucleo: r.colaboradores?.nucleo_atual || '',
                reason: r.motivo,
                date: new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
                initials: (r.colaboradores?.nome || '??').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase(),
            })))
        }
        fetch()
    }, [])

    const handleAccept = async (req: any) => {
        const { error } = await supabase.from('solicitacoes_remocao').update({ status: 'APROVADA' }).eq('id', req.id);
        if (!error) {
            if (req.ocorrencia_id) {
                const { data: occ } = await supabase.from('ocorrencias').select('pontuacao').eq('id', req.ocorrencia_id).single();
                if (occ && occ.pontuacao) {
                    const { data: colab } = await supabase.from('colaboradores').select('pontos_negativos').eq('id', req.colaborador_id).single();
                    if (colab) {
                        const newPoints = Math.max(0, (colab.pontos_negativos || 0) - occ.pontuacao);
                        await supabase.from('colaboradores').update({ pontos_negativos: newPoints }).eq('id', req.colaborador_id);
                    }
                }
            } else if (req.pontos_solicitados) {
                const { data: colab } = await supabase.from('colaboradores').select('pontos_negativos').eq('id', req.colaborador_id).single();
                if (colab) {
                    const newPoints = Math.max(0, (colab.pontos_negativos || 0) - req.pontos_solicitados);
                    await supabase.from('colaboradores').update({ pontos_negativos: newPoints }).eq('id', req.colaborador_id);
                }
            }
            setRequests(prev => prev.filter(r => r.id !== req.id));
            window.dispatchEvent(new Event('refreshPointsData'));
        } else {
            alert('Erro ao aprovar a solicitação');
        }
    }

    const handleReject = async (req: any) => {
        const { error } = await supabase.from('solicitacoes_remocao').update({ status: 'REJEITADA' }).eq('id', req.id);
        if (!error) {
            setRequests(prev => prev.filter(r => r.id !== req.id));
            window.dispatchEvent(new Event('refreshPointsData'));
        } else {
            alert('Erro ao rejeitar a solicitação');
        }
    }

    const filteredRequests = requests.filter(item => {
        const matchName = item.name.toLowerCase().includes(searchName.toLowerCase())
        const matchNucleo = filterNucleo === "all" || item.nucleo === filterNucleo
        return matchName && matchNucleo
    })

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none text-slate-900 dark:text-white rounded-3xl h-full shadow-lg flex flex-col">
            <CardHeader className="pb-4 border-b border-slate-100 dark:border-white/5 space-y-4">
                <div className="flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-rose-50 dark:bg-rose-500/10 p-2 rounded-xl border border-rose-100 dark:border-rose-500/20">
                            <ShieldAlert className="h-5 w-5 text-rose-600 dark:text-rose-500" />
                        </div>
                        <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Pedidos de Remoção de Pontos</CardTitle>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex bg-slate-50 dark:bg-white/5 p-1 rounded-lg border border-slate-100 dark:border-white/10">
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 w-7 p-0 hover:bg-slate-200 dark:hover:bg-white/10 ${viewMode === 'list' ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                onClick={() => setViewMode("list")}
                            >
                                <List className="h-4 w-4" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className={`h-7 w-7 p-0 hover:bg-slate-200 dark:hover:bg-white/10 ${viewMode === 'kanban' ? 'bg-white dark:bg-white/10 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'}`}
                                onClick={() => setViewMode("kanban")}
                            >
                                <LayoutGrid className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Search className="h-4 w-4 text-slate-400" />
                        </div>
                        <Input
                            placeholder="Buscar por nome..."
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            className="pl-9 bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/10 h-10 rounded-xl"
                        />
                    </div>
                    <Select value={filterNucleo} onValueChange={setFilterNucleo}>
                        <SelectTrigger className="w-full sm:w-[160px] h-10 bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-white/10 rounded-xl">
                            <SelectValue placeholder="Núcleo" />
                        </SelectTrigger>
                        <SelectContent className="bg-white dark:bg-[#0f172a] border-slate-200 dark:border-white/10 rounded-xl">
                            <SelectItem value="all">Todos os Núcleos</SelectItem>
                            <SelectItem value="Presidência">Presidência</SelectItem>
                            <SelectItem value="Vice-Presidência">Vice-Presidência</SelectItem>
                            <SelectItem value="Projetos">Projetos</SelectItem>
                            <SelectItem value="Marketing">Marketing</SelectItem>
                            <SelectItem value="Gestão de Pessoas">Gestão de Pessoas</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="pt-4 flex-1 overflow-hidden flex flex-col p-0">
                {filteredRequests.length === 0 ? (
                    <p className="text-sm text-slate-400 italic text-center py-8 px-6">Nenhuma solicitação encontrada</p>
                ) : viewMode === "list" ? (
                    <div className="flex flex-col h-full">
                        <div className="grid grid-cols-[1.5fr_3fr_1fr_0.5fr] gap-4 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100 dark:border-white/10 pb-2 mb-2 px-6 tracking-wider shrink-0">
                            <span>Colaborador</span>
                            <span>Motivo</span>
                            <span>Data Solic.</span>
                            <span className="text-right">Ações</span>
                        </div>

                        <div className="space-y-1 overflow-y-auto px-6 pb-6 custom-scrollbar max-h-[440px]">
                            {filteredRequests.map((req) => (
                                <div key={req.id} className="grid grid-cols-[1.5fr_3fr_1fr_0.5fr] gap-4 items-center p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-all group border border-transparent hover:border-slate-100 dark:hover:border-white/5">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="h-9 w-9 shrink-0 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-white border border-slate-200 dark:border-white/10">
                                            {req.initials}
                                        </div>
                                        <div className="min-w-0">
                                            <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">{req.name}</span>
                                            <div className="flex items-center gap-1 truncate">
                                                <span className="text-[10px] text-slate-500 dark:text-slate-400 truncate tracking-wide">{req.role}</span>
                                                <span className="shrink-0 w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                                <span className="text-[10px] text-sky-500 dark:text-sky-400 truncate tracking-wide">{req.nucleo}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="min-w-0 pr-2">
                                        <p className="text-xs font-bold text-slate-900 dark:text-white mb-1">
                                            {req.pontos_solicitados ? `Solicitação: -${req.pontos_solicitados} pts` : `Recurso de Ocorrência`}
                                        </p>
                                        <p className="text-xs text-slate-600 dark:text-slate-400/70 line-clamp-2 leading-relaxed">
                                            {req.reason}
                                        </p>
                                        {req.comprovante_url && (
                                            <a href={req.comprovante_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline mt-1 inline-block">
                                                Ver Comprovante
                                            </a>
                                        )}
                                    </div>

                                    <span className="text-xs font-mono text-slate-500">{req.date}</span>

                                    <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <Button onClick={() => handleAccept(req)} size="icon" className="h-8 w-8 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-500 dark:hover:text-white border border-emerald-100 dark:border-emerald-500/20 rounded-lg backdrop-blur-sm">
                                            <Check className="h-4 w-4" />
                                        </Button>
                                        <Button onClick={() => handleReject(req)} size="icon" className="h-8 w-8 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500 dark:hover:text-white border border-rose-100 dark:border-rose-500/20 rounded-lg backdrop-blur-sm">
                                            <X className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 overflow-y-auto px-6 pb-6 pt-2 custom-scrollbar max-h-[440px]">
                        {filteredRequests.map((req) => (
                            <div key={req.id} className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-4 rounded-3xl flex flex-col gap-3 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors group">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-white border border-slate-200 dark:border-white/10">
                                            {req.initials}
                                        </div>
                                        <div>
                                            <span className="block text-sm font-bold text-slate-900 dark:text-white">{req.name}</span>
                                            <div className="flex items-center gap-1">
                                                <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">{req.role}</span>
                                                <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                                <span className="block text-[10px] text-sky-500 dark:text-sky-400 uppercase font-bold tracking-wider">{req.nucleo}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-slate-100 dark:border-white/5 mt-2">
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mb-1">
                                        {req.pontos_solicitados ? `Solicitação: -${req.pontos_solicitados} pts` : `Recurso de Ocorrência`}
                                    </p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 italic">&quot;{req.reason}&quot;</p>
                                    {req.comprovante_url && (
                                        <a href={req.comprovante_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline mt-2 inline-block">
                                            Ver Comprovante
                                        </a>
                                    )}
                                </div>

                                <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100 dark:border-white/5">
                                    <span className="text-[10px] font-mono text-slate-500">{req.date}</span>
                                    <div className="flex gap-2">
                                        <Button onClick={() => handleReject(req)} size="sm" variant="ghost" className="h-8 px-3 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-white hover:bg-rose-50 dark:hover:bg-rose-500/20 rounded-lg">
                                            Recusar
                                        </Button>
                                        <Button onClick={() => handleAccept(req)} size="sm" className="h-8 px-4 bg-emerald-600 dark:bg-emerald-500 text-white hover:bg-emerald-700 dark:hover:bg-emerald-600 rounded-lg shadow-lg shadow-emerald-500/20">
                                            Aprovar
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
