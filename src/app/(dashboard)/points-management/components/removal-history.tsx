"use client"
import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { History, CheckCircle2, XCircle, Search } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function RemovalHistory() {
    const [history, setHistory] = useState<any[]>([])
    const [searchName, setSearchName] = useState("")
    const [filterNucleo, setFilterNucleo] = useState("all")

    useEffect(() => {
        async function fetchHistory() {
            const { data } = await supabase
                .from('solicitacoes_remocao')
                .select('*, colaboradores!inner(nome, cargo_atual, nucleo_atual)')
                .in('status', ['APROVADA', 'REJEITADA'])
                .order('created_at', { ascending: false })
                .limit(30)

            if (data) setHistory(data.map(h => ({
                id: h.id,
                name: h.colaboradores?.nome || 'Desconhecido',
                role: h.colaboradores?.cargo_atual || '',
                nucleo: h.colaboradores?.nucleo_atual || '',
                reason: h.motivo,
                status: h.status,
                pontos_solicitados: h.pontos_solicitados,
                comprovante_url: h.comprovante_url,
                date: new Date(h.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
                initials: (h.colaboradores?.nome || '??').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase(),
            })))
        }

        fetchHistory()

        window.addEventListener('refreshPointsData', fetchHistory)
        return () => window.removeEventListener('refreshPointsData', fetchHistory)
    }, [])

    const filteredHistory = history.filter(item => {
        const matchName = item.name.toLowerCase().includes(searchName.toLowerCase())
        const matchNucleo = filterNucleo === "all" || item.nucleo === filterNucleo
        return matchName && matchNucleo
    })

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none text-slate-900 dark:text-white rounded-3xl shadow-lg flex flex-col">
            <CardHeader className="pb-4 border-b border-slate-100 dark:border-white/5 space-y-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="bg-slate-100 dark:bg-white/10 p-2 rounded-xl">
                            <History className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                        </div>
                        <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Histórico de Remoções</CardTitle>
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
                {filteredHistory.length === 0 ? (
                    <p className="text-sm text-slate-400 italic text-center py-6 px-6">Nenhum histórico encontrado</p>
                ) : (
                    <div className="space-y-3 overflow-y-auto px-6 pb-6 pt-2 max-h-[480px] custom-scrollbar">
                        {filteredHistory.map((item) => (
                            <div key={item.id} className="flex gap-4 items-start p-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl">
                                <div className="h-10 w-10 shrink-0 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-500 shadow-sm border border-slate-100 dark:border-white/10">
                                    {item.initials}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="flex justify-between items-start mb-1 gap-2">
                                        <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{item.name}</p>
                                        <span className={`shrink-0 text-[10px] uppercase font-bold px-2 py-0.5 rounded flex items-center gap-1 ${item.status === 'APROVADA' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500' : 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-500'}`}>
                                            {item.status === 'APROVADA' ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                                            {item.status}
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider">{item.role}</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-300 dark:bg-slate-600"></span>
                                        <span className="text-[10px] uppercase font-bold text-sky-500 dark:text-sky-400 tracking-wider">{item.nucleo}</span>
                                    </div>
                                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 mt-1">
                                        {item.pontos_solicitados ? `Solicitação de Remoção (${item.pontos_solicitados} pts)` : 'Recurso de Ocorrência'}
                                    </p>
                                    <p className="text-xs text-slate-500 line-clamp-2 mt-0.5">{item.reason}</p>
                                    <div className="flex gap-4 items-center">
                                        <span className="text-[10px] font-mono text-slate-400 mt-2 block">{item.date}</span>
                                        {item.comprovante_url && (
                                            <a href={item.comprovante_url} target="_blank" rel="noreferrer" className="text-[10px] text-blue-500 hover:underline mt-2 inline-block">
                                                Ver Comprovante
                                            </a>
                                        )}
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
