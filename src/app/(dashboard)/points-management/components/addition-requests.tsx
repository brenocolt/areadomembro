"use client"
import { useEffect, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, X, ShieldAlert } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { CARGO_FANTASMA } from "@/lib/cargos"

export function AdditionRequests() {
    const [requests, setRequests] = useState<any[]>([])
    const [busyId, setBusyId] = useState<string | null>(null)

    const fetchRequests = async () => {
        const { data } = await supabase
            .from('solicitacoes_pontuacao')
            .select('*, colaboradores!solicitacoes_pontuacao_colaborador_id_fkey(nome, cargo_atual, nucleo_atual, status), solicitante:colaboradores!solicitacoes_pontuacao_solicitado_por_id_fkey(nome)')
            .eq('status', 'PENDENTE')
            .order('created_at', { ascending: false })
            .limit(30)

        const ativos = (data || []).filter((r: any) => r.colaboradores?.status !== 'Desligado' && r.colaboradores?.cargo_atual !== CARGO_FANTASMA)
        setRequests(ativos)
    }

    useEffect(() => {
        fetchRequests()
        window.addEventListener('refreshPointsData', fetchRequests)
        return () => window.removeEventListener('refreshPointsData', fetchRequests)
    }, [])

    const handleAccept = async (req: any) => {
        setBusyId(req.id)
        try {
            const { data: ocorrencia, error: insertError } = await supabase
                .from('ocorrencias')
                .insert({
                    colaborador_id: req.colaborador_id,
                    data: new Date().toISOString(),
                    cargo_na_epoca: req.colaboradores?.cargo_atual || 'Colaborador',
                    motivo: req.motivo,
                    descricao: req.descricao,
                    pontuacao: req.pontuacao,
                })
                .select('id')
                .single()

            if (insertError) throw insertError

            const { data: colab } = await supabase
                .from('colaboradores')
                .select('pontos_negativos')
                .eq('id', req.colaborador_id)
                .single()

            await supabase
                .from('colaboradores')
                .update({ pontos_negativos: (colab?.pontos_negativos || 0) + req.pontuacao })
                .eq('id', req.colaborador_id)

            await supabase
                .from('solicitacoes_pontuacao')
                .update({ status: 'APROVADA', data_analise: new Date().toISOString(), ocorrencia_id: ocorrencia?.id })
                .eq('id', req.id)

            setRequests(prev => prev.filter(r => r.id !== req.id))
            window.dispatchEvent(new Event('refreshPointsData'))
        } catch (err) {
            console.error(err)
            alert('Erro ao aprovar a solicitação')
        } finally {
            setBusyId(null)
        }
    }

    const handleReject = async (req: any) => {
        setBusyId(req.id)
        try {
            const { error } = await supabase
                .from('solicitacoes_pontuacao')
                .update({ status: 'REJEITADA', data_analise: new Date().toISOString() })
                .eq('id', req.id)

            if (error) throw error

            await supabase.from('pontuacao_notificacoes').insert({
                colaborador_id: req.solicitado_por_id,
                solicitacao_id: req.id,
                texto: `Sua pontuação de ${req.pontuacao} pt${req.pontuacao > 1 ? 's' : ''} pra ${req.colaboradores?.nome || 'colaborador'} foi recusada.`,
            })

            setRequests(prev => prev.filter(r => r.id !== req.id))
        } catch (err) {
            console.error(err)
            alert('Erro ao recusar a solicitação')
        } finally {
            setBusyId(null)
        }
    }

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none text-slate-900 dark:text-white rounded-3xl h-full shadow-lg flex flex-col">
            <CardHeader className="pb-4 border-b border-slate-100 dark:border-white/5">
                <div className="flex items-center gap-3">
                    <div className="bg-amber-50 dark:bg-amber-500/10 p-2 rounded-xl border border-amber-100 dark:border-amber-500/20">
                        <ShieldAlert className="h-5 w-5 text-amber-600 dark:text-amber-500" />
                    </div>
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Pontuações Pendentes de Aprovação</CardTitle>
                </div>
            </CardHeader>
            <CardContent className="pt-4 flex-1 overflow-hidden flex flex-col p-0">
                {requests.length === 0 ? (
                    <p className="text-sm text-slate-400 italic text-center py-8 px-6">Nenhuma solicitação pendente</p>
                ) : (
                    <div className="space-y-1 overflow-y-auto px-6 pb-6 custom-scrollbar max-h-[440px]">
                        {requests.map(req => (
                            <div key={req.id} className="flex items-start justify-between gap-4 p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-all border border-transparent hover:border-slate-100 dark:hover:border-white/5">
                                <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-bold text-slate-900 dark:text-white">{req.colaboradores?.nome || 'Desconhecido'}</span>
                                        <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-white/10 px-1.5 py-0.5 rounded-md">+{req.pontuacao} pts</span>
                                    </div>
                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">{req.motivo}</p>
                                    <p className="text-xs text-slate-500 dark:text-slate-500 italic mt-1 line-clamp-2">&quot;{req.descricao}&quot;</p>
                                    <p className="text-[10px] text-slate-400 mt-1">Solicitado por {req.solicitante?.nome || 'desconhecido'}</p>
                                </div>
                                <div className="flex gap-2 shrink-0">
                                    <Button onClick={() => handleAccept(req)} disabled={busyId === req.id} size="icon" className="h-8 w-8 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 hover:bg-emerald-100 dark:hover:bg-emerald-500 dark:hover:text-white border border-emerald-100 dark:border-emerald-500/20 rounded-lg">
                                        <Check className="h-4 w-4" />
                                    </Button>
                                    <Button onClick={() => handleReject(req)} disabled={busyId === req.id} size="icon" className="h-8 w-8 bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-500 dark:hover:text-white border border-rose-100 dark:border-rose-500/20 rounded-lg">
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
