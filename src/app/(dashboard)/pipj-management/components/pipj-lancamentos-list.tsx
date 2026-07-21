"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { supabase } from "@/lib/supabase"
import { RotateCcw, Loader2, ListChecks } from "lucide-react"
import { toast } from "sonner"

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

interface Lancamento {
    id: string
    mes: number
    ano: number
    total_lancado: number
    total_colaboradores: number
    revertido_em: string | null
    created_at: string
}

export function PipjLancamentosList() {
    const [lancamentos, setLancamentos] = useState<Lancamento[]>([])
    const [loading, setLoading] = useState(true)
    const [revertingId, setRevertingId] = useState<string | null>(null)

    const fetchData = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('lancamentos_pipj')
            .select('id, mes, ano, total_lancado, total_colaboradores, revertido_em, created_at')
            .order('created_at', { ascending: false })
            .limit(12)
        if (data) setLancamentos(data as Lancamento[])
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
        window.addEventListener('refreshPipjData', fetchData)
        return () => window.removeEventListener('refreshPipjData', fetchData)
    }, [])

    const handleReverter = async (l: Lancamento) => {
        const periodo = `${MESES[l.mes - 1]}/${l.ano}`
        if (!confirm(`Reverter o lançamento de ${periodo}?\n\nR$ ${Number(l.total_lancado).toFixed(2).replace('.', ',')} serão deduzidos da carteira de PIPJ de ${l.total_colaboradores} colaborador(es). Essa ação não pode ser desfeita.`)) return

        setRevertingId(l.id)
        try {
            const res = await fetch('/api/pipj/reverter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ lancamentoId: l.id })
            })
            const data = await res.json()
            if (!res.ok) {
                toast.error(data.error || 'Erro ao reverter lançamento.')
            } else {
                toast.success(`Lançamento de ${periodo} revertido.`)
                window.dispatchEvent(new Event('refreshPipjData'))
            }
        } catch {
            toast.error('Erro de conexão.')
        } finally {
            setRevertingId(null)
        }
    }

    if (loading) return <Card className="h-64 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-3xl border-none" />

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none shadow-lg rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-slate-100 dark:border-white/5">
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ListChecks className="h-4 w-4 text-slate-500" />
                    Lançamentos de PIPJ
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                {lancamentos.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-slate-400 dark:text-slate-500 text-sm">
                        Nenhum lançamento registrado ainda.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-white/5">
                        {lancamentos.map(l => {
                            const isReverting = revertingId === l.id
                            return (
                                <div key={l.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                            {MESES[l.mes - 1]}/{l.ano}
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            {l.total_colaboradores} colaborador(es) · R$ {Number(l.total_lancado).toFixed(2).replace('.', ',')}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        {l.revertido_em ? (
                                            <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 font-bold text-[10px] uppercase tracking-wider border-none">
                                                Revertido
                                            </Badge>
                                        ) : (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                className="h-8 px-3 text-xs border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700 dark:border-rose-900/30 dark:text-rose-400 dark:hover:bg-rose-900/20"
                                                disabled={isReverting || revertingId !== null}
                                                onClick={() => handleReverter(l)}
                                            >
                                                {isReverting ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5 mr-1" />}
                                                Reverter
                                            </Button>
                                        )}
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
