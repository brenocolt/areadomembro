"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"
import { Zap, Loader2, CheckCircle, AlertTriangle } from "lucide-react"

export function PipjLaunchDialog() {
    const [open, setOpen] = useState(false)
    const [countdown, setCountdown] = useState(5)
    const [canConfirm, setCanConfirm] = useState(false)
    const [launching, setLaunching] = useState(false)
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    const resetState = useCallback(() => {
        setCountdown(5)
        setCanConfirm(false)
        setLaunching(false)
        setResult(null)
        setError(null)
        if (intervalRef.current) clearInterval(intervalRef.current)
    }, [])

    useEffect(() => {
        if (open) {
            resetState()
            intervalRef.current = setInterval(() => {
                setCountdown(prev => {
                    if (prev <= 1) {
                        setCanConfirm(true)
                        if (intervalRef.current) clearInterval(intervalRef.current)
                        return 0
                    }
                    return prev - 1
                })
            }, 1000)
        } else {
            resetState()
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    }, [open, resetState])

    async function handleLaunch() {
        setLaunching(true)
        setError(null)
        try {
            const res = await fetch('/api/pipj/lancar', { method: 'POST' })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'Erro ao lançar PIPJ.')
                setLaunching(false)
                return
            }
            setResult(data)
            setLaunching(false)
            // Dispatch event to refresh stats
            window.dispatchEvent(new Event('refreshPipjData'))
        } catch {
            setError('Erro de conexão. Tente novamente.')
            setLaunching(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25">
                    <Zap className="mr-2 h-4 w-4" />
                    Lançar PIPJ
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                    <DialogTitle className="font-display text-xl flex items-center gap-2">
                        <Zap className="h-5 w-5 text-emerald-500" />
                        Lançar PIPJ Mensal
                    </DialogTitle>
                    <DialogDescription>
                        Esta ação calculará e creditará o PIPJ para <strong>todos os colaboradores ativos</strong> com base nas regras de cálculo.
                    </DialogDescription>
                </DialogHeader>

                {!result && !error && (
                    <div className="py-6 space-y-4">
                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                            <div className="text-sm text-amber-800 dark:text-amber-200">
                                <p className="font-bold mb-1">Atenção!</p>
                                <p>Esta ação é <strong>irreversível</strong> e pode ser executada apenas <strong>uma vez por mês</strong>. Verifique se todos os dados de projetos, níveis e ausências estão corretos.</p>
                            </div>
                        </div>

                        {!canConfirm && (
                            <div className="text-center">
                                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 border-2 border-slate-200 dark:border-white/10 mb-2">
                                    <span className="text-2xl font-display font-bold text-slate-900 dark:text-white">{countdown}</span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                    Aguarde para confirmar...
                                </p>
                            </div>
                        )}
                    </div>
                )}

                {result && (
                    <div className="py-6 space-y-4">
                        <div className="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl p-4 flex items-start gap-3">
                            <CheckCircle className="h-5 w-5 text-emerald-500 mt-0.5 shrink-0" />
                            <div className="text-sm text-emerald-800 dark:text-emerald-200">
                                <p className="font-bold mb-1">PIPJ lançado com sucesso!</p>
                                <p>
                                    <strong>{result.total_colaboradores}</strong> colaboradores receberam um total de{' '}
                                    <strong>R$ {Number(result.total_lancado).toFixed(2).replace('.', ',')}</strong>
                                </p>
                            </div>
                        </div>

                        <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 dark:border-white/10">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800">
                                    <tr>
                                        <th className="text-left p-2 font-bold">Nome</th>
                                        <th className="text-left p-2 font-bold">Cargo</th>
                                        <th className="text-right p-2 font-bold">Valor</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {result.detalhes?.map((d: any, i: number) => (
                                        <tr key={i} className="border-t border-slate-100 dark:border-white/5">
                                            <td className="p-2 font-medium">{d.nome}</td>
                                            <td className="p-2 text-slate-500">{d.cargo}</td>
                                            <td className="p-2 text-right font-bold text-emerald-600 dark:text-emerald-400">
                                                R$ {Number(d.valor_calculado).toFixed(2).replace('.', ',')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {error && (
                    <div className="py-6">
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                            <div className="text-sm text-red-800 dark:text-red-200">
                                <p className="font-bold mb-1">Erro</p>
                                <p>{error}</p>
                            </div>
                        </div>
                    </div>
                )}

                <DialogFooter>
                    {!result ? (
                        <Button
                            onClick={handleLaunch}
                            disabled={!canConfirm || launching}
                            className={`w-full ${canConfirm && !launching
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                }`}
                        >
                            {launching ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
                            ) : !canConfirm ? (
                                `Aguarde ${countdown}s para confirmar`
                            ) : (
                                <><Zap className="mr-2 h-4 w-4" /> Confirmar Lançamento</>
                            )}
                        </Button>
                    ) : (
                        <Button onClick={() => setOpen(false)} className="w-full">
                            Fechar
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
