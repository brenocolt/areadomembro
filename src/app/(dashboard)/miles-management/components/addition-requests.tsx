"use client"
import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, X, PlusCircle, LayoutGrid, List } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function AdditionRequests() {
    const [viewMode, setViewMode] = useState<"list" | "kanban">("list")
    const [requests, setRequests] = useState<any[]>([])

    useEffect(() => {
        async function fetch() {
            const { data } = await supabase
                .from('solicitacoes_saque')
                .select('*, colaboradores!inner(nome, cargo_atual, users!inner(id), milhas_saldo(saldo_disponivel))')
                .eq('tipo', 'adicao_milhas')
                .eq('status', 'PENDENTE')
                .order('created_at', { ascending: false })
                .limit(10)
            if (data) setRequests(data.map(r => {
                const milhasSaldo = r.colaboradores?.milhas_saldo
                const saldo = Array.isArray(milhasSaldo) ? milhasSaldo[0]?.saldo_disponivel : milhasSaldo?.saldo_disponivel
                return {
                    id: r.id,
                    colaborador_id: r.colaborador_id,
                    name: r.colaboradores?.nome || 'Desconhecido',
                    role: r.colaboradores?.cargo_atual || '',
                    reason: r.descricao,
                    atividade: r.atividade,
                    miles: r.quantidade,
                    comprovanteUrl: r.comprovante_url,
                    currentBalance: saldo || 0,
                    date: new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
                    initials: (r.colaboradores?.nome || '??').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase(),
                }
            }))
        }
        fetch()
    }, [])

    const handleAccept = async (req: any) => {
        const { error } = await supabase.from('solicitacoes_saque').update({ status: 'APROVADO' }).eq('id', req.id);
        if (!error) {
            const { data: saldoData } = await supabase.from('milhas_saldo').select('*').eq('colaborador_id', req.colaborador_id).single();
            if (saldoData) {
                await supabase.from('milhas_saldo').update({
                    saldo_disponivel: req.currentBalance + req.miles,
                    saldo_total: (saldoData.saldo_total || 0) + req.miles
                }).eq('colaborador_id', req.colaborador_id);
            } else {
                await supabase.from('milhas_saldo').insert({
                    colaborador_id: req.colaborador_id,
                    saldo_disponivel: req.miles,
                    saldo_total: req.miles
                });
            }
            setRequests(prev => prev.filter(r => r.id !== req.id));
            window.dispatchEvent(new Event('refreshMilesData'))
        } else {
            alert('Erro ao aprovar solicitação');
        }
    }

    const handleReject = async (req: any) => {
        const { error } = await supabase.from('solicitacoes_saque').update({ status: 'REJEITADO' }).eq('id', req.id);
        if (!error) {
            setRequests(prev => prev.filter(r => r.id !== req.id));
            window.dispatchEvent(new Event('refreshMilesData'))
        } else {
            alert('Erro ao reprovar solicitação');
        }
    }

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none text-slate-900 dark:text-white rounded-3xl h-full shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-3">
                    <div className="bg-emerald-50 dark:bg-emerald-500/10 p-2 rounded-xl border border-emerald-100 dark:border-emerald-500/20">
                        <PlusCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-500" />
                    </div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Pedidos de Adição Pendentes</CardTitle>
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
            </CardHeader>
            <CardContent className="pt-4">
                {requests.length === 0 ? (
                    <p className="text-sm text-slate-400 italic text-center py-8">Nenhuma solicitação de adição pendente</p>
                ) : viewMode === "list" ? (
                    <>
                        <div className="grid grid-cols-[1.5fr_2fr_1fr_1fr_0.5fr] gap-4 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100 dark:border-white/10 pb-2 mb-4 px-2 tracking-wider">
                            <span>Colaborador</span>
                            <span>Motivo</span>
                            <span>Milhas (+ )</span>
                            <span>Data Solic.</span>
                            <span className="text-right">Ações</span>
                        </div>

                        <div className="space-y-1">
                            {requests.map((req) => (
                                <div key={req.id} className="grid grid-cols-[1.5fr_2fr_1fr_1fr_0.5fr] gap-4 items-center p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-all group border border-transparent hover:border-slate-100 dark:hover:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-white border border-slate-200 dark:border-white/10">
                                            {req.initials}
                                        </div>
                                        <div className="min-w-0">
                                            <TooltipProvider delayDuration={0}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="block text-sm font-bold text-slate-900 dark:text-white truncate cursor-help border-b border-dashed border-slate-300 dark:border-slate-600 w-fit">{req.name}</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="bg-slate-900 dark:bg-slate-800 text-white border-none shadow-xl">
                                                        <p className="text-xs font-semibold">
                                                            Saldo Atual: <span className="text-cyan-400 font-bold">{req.currentBalance.toLocaleString('pt-BR')} milhas</span>
                                                        </p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate tracking-wide">{req.role}</span>
                                        </div>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2">
                                            {req.atividade}
                                        </p>
                                        {req.reason && req.reason !== req.atividade && (
                                            <p className="text-[10px] text-slate-500 line-clamp-1">{req.reason}</p>
                                        )}
                                        {req.comprovanteUrl && (
                                            <a href={req.comprovanteUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 w-fit flex items-center gap-1">
                                                Visualizar Comprovante
                                            </a>
                                        )}
                                    </div>

                                    <div className="text-xs font-bold text-slate-900 dark:text-white">
                                        <span className="text-emerald-600 dark:text-emerald-400">+{req.miles.toLocaleString('pt-BR')}</span> <span className="text-emerald-600/50 dark:text-emerald-400/50">milhas</span>
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
                    </>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {requests.map((req) => (
                            <div key={req.id} className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/10 p-4 rounded-3xl flex flex-col gap-3 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors group">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-white dark:bg-white/10 flex items-center justify-center text-sm font-bold text-slate-700 dark:text-white border border-slate-200 dark:border-white/10">
                                            {req.initials}
                                        </div>
                                        <div>
                                            <TooltipProvider delayDuration={0}>
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <span className="block text-sm font-bold text-slate-900 dark:text-white cursor-help border-b border-dashed border-slate-300 dark:border-slate-600 w-fit">{req.name}</span>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="bg-slate-900 dark:bg-slate-800 text-white border-none shadow-xl">
                                                        <p className="text-xs font-semibold">
                                                            Saldo Atual: <span className="text-cyan-400 font-bold">{req.currentBalance.toLocaleString('pt-BR')} milhas</span>
                                                        </p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            </TooltipProvider>
                                            <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">{req.role}</span>
                                        </div>
                                    </div>
                                    <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 px-2 py-1 rounded-lg text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                        +{req.miles.toLocaleString('pt-BR')} milhas
                                    </div>
                                </div>

                                <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-slate-100 dark:border-white/5 mt-2 flex flex-col gap-1">
                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{req.atividade}</p>
                                    {req.reason && req.reason !== req.atividade && (
                                        <p className="text-[10px] text-slate-500 line-clamp-2">{req.reason}</p>
                                    )}
                                    {req.comprovanteUrl && (
                                        <a href={req.comprovanteUrl} target="_blank" rel="noreferrer" className="text-[10px] font-bold text-cyan-600 hover:text-cyan-700 dark:text-cyan-400 dark:hover:text-cyan-300 w-fit mt-1 flex items-center gap-1">
                                            Visualizar Comprovante
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
