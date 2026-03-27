"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, X, ShieldAlert, LayoutGrid, List } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { approveAccountRequest } from "@/lib/admin-actions"

export function AccountRequests() {
    const [viewMode, setViewMode] = useState<"list" | "kanban">("list")
    const [requests, setRequests] = useState<any[]>([])
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        async function fetch() {
            const { data } = await supabase
                .from('solicitacoes_conta')
                .select('*')
                .eq('status', 'PENDENTE')
                .order('created_at', { ascending: false })

            if (data) {
                setRequests(data.map(r => ({
                    ...r,
                    date: new Date(r.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
                    initials: (r.nome || '??').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase(),
                })))
            }
        }
        fetch()

        const sub = supabase.channel('account_requests_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'solicitacoes_conta' }, fetch)
            .subscribe()

        return () => {
            supabase.removeChannel(sub)
        }
    }, [])

    const handleAccept = async (req: any) => {
        setLoading(true)
        try {
            const { success, error } = await approveAccountRequest(req.id)
            if (success) {
                setRequests(prev => prev.filter(r => r.id !== req.id))
            } else {
                alert('Erro ao aprovar: ' + error)
            }
        } catch (e: any) {
            alert('Erro inesperado: ' + e.message)
        }
        setLoading(false)
    }

    const handleReject = async (req: any) => {
        setLoading(true)
        const { error } = await supabase.from('solicitacoes_conta').update({ status: 'REJEITADA' }).eq('id', req.id);
        if (!error) {
            setRequests(prev => prev.filter(r => r.id !== req.id));
        } else {
            alert('Erro ao reprovar');
        }
        setLoading(false)
    }

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none text-slate-900 dark:text-white rounded-3xl h-full shadow-lg">
            <CardHeader className="flex flex-row items-center justify-between pb-4 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-50 dark:bg-blue-500/10 p-2 rounded-xl border border-blue-100 dark:border-blue-500/20">
                        <ShieldAlert className="h-5 w-5 text-blue-600 dark:text-blue-500" />
                    </div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Solicitações de Criação de Conta</CardTitle>
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
                    <p className="text-sm text-slate-400 italic text-center py-8">Nenhuma solicitação pendente</p>
                ) : viewMode === "list" ? (
                    <>
                        <div className="grid grid-cols-[1.5fr_3fr_1fr_0.5fr] gap-4 text-[10px] uppercase font-bold text-slate-500 border-b border-slate-100 dark:border-white/10 pb-2 mb-4 px-2 tracking-wider">
                            <span>Colaborador</span>
                            <span>Detalhes</span>
                            <span>Data Solic.</span>
                            <span className="text-right">Ações</span>
                        </div>

                        <div className="space-y-1">
                            {requests.map((req) => (
                                <div key={req.id} className="grid grid-cols-[1.5fr_3fr_1fr_0.5fr] gap-4 items-center p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-all group border border-transparent hover:border-slate-100 dark:hover:border-white/5">
                                    <div className="flex items-center gap-3">
                                        <div className="h-9 w-9 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center text-xs font-bold text-slate-700 dark:text-white border border-slate-200 dark:border-white/10 shrink-0">
                                            {req.initials}
                                        </div>
                                        <div className="min-w-0">
                                            <span className="block text-sm font-bold text-slate-900 dark:text-white truncate">{req.nome}</span>
                                            <span className="block text-[10px] text-slate-500 dark:text-slate-400 truncate tracking-wide">{req.cargo} - {req.nucleo}</span>
                                        </div>
                                    </div>

                                    <div className="text-xs text-slate-600 dark:text-slate-400/70 truncate flex flex-col gap-1">
                                        <span>Email: {req.email_corporativo}</span>
                                        <span>CPF: {req.cpf} / Matrícula: {req.matricula}</span>
                                    </div>

                                    <span className="text-xs font-mono text-slate-500">{req.date}</span>

                                    <div className="flex justify-end gap-2 opacity-60 group-hover:opacity-100 transition-opacity">
                                        <Button disabled={loading} onClick={() => handleAccept(req)} size="icon" className="h-8 w-8 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-500 dark:hover:text-white border border-emerald-100 dark:border-emerald-500/20 rounded-lg backdrop-blur-sm">
                                            <Check className="h-4 w-4" />
                                        </Button>
                                        <Button disabled={loading} onClick={() => handleReject(req)} size="icon" className="h-8 w-8 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500 dark:hover:text-white border border-rose-100 dark:border-rose-500/20 rounded-lg backdrop-blur-sm">
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
                                            <span className="block text-sm font-bold text-slate-900 dark:text-white">{req.nome}</span>
                                            <span className="block text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">{req.cargo}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-white/50 dark:bg-black/20 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                                    <p className="text-xs text-slate-600 dark:text-slate-400">Email: {req.email_corporativo}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">Núcleo: {req.nucleo}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-400">Safra: {req.safra}</p>
                                </div>

                                <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100 dark:border-white/5">
                                    <span className="text-[10px] font-mono text-slate-500">{req.date}</span>
                                    <div className="flex gap-2">
                                        <Button disabled={loading} onClick={() => handleReject(req)} size="sm" variant="ghost" className="h-8 px-3 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-white hover:bg-rose-50 dark:hover:bg-rose-500/20 rounded-lg">
                                            Recusar
                                        </Button>
                                        <Button disabled={loading} onClick={() => handleAccept(req)} size="sm" className="h-8 px-4 bg-emerald-600 dark:bg-emerald-500 text-white hover:bg-emerald-700 dark:hover:bg-emerald-600 rounded-lg shadow-lg shadow-emerald-500/20">
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
