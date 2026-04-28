"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Zap, Loader2, CheckCircle, AlertTriangle, Calculator } from "lucide-react"

export function PipjLaunchDialog() {
    const [open, setOpen] = useState(false)
    const [countdown, setCountdown] = useState(5)
    const [canConfirm, setCanConfirm] = useState(false)
    const [launching, setLaunching] = useState(false)
    const [fetchingPreview, setFetchingPreview] = useState(false)
    const [previewData, setPreviewData] = useState<any>(null)
    const [overrides, setOverrides] = useState<Record<string, { deducao?: number, valor_final?: number, motivo: string }>>({})
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    const resetState = useCallback(() => {
        setCountdown(5)
        setCanConfirm(false)
        setLaunching(false)
        setResult(null)
        setError(null)
        setPreviewData(null)
        setOverrides({})
        if (intervalRef.current) clearInterval(intervalRef.current)
    }, [])

    const fetchPreview = useCallback(async () => {
        setFetchingPreview(true)
        setError(null)
        try {
            const res = await fetch('/api/pipj/preview')
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'Erro ao carregar prévia.')
            } else {
                setPreviewData(data)
                // Start countdown only after preview is loaded
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
            }
        } catch (e) {
            setError('Erro de conexão ao buscar prévia.')
        } finally {
            setFetchingPreview(false)
        }
    }, [])

    useEffect(() => {
        if (open) {
            resetState()
            fetchPreview()
        } else {
            resetState()
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    }, [open, resetState, fetchPreview])

    const handleOverrideChange = (colabId: string, field: 'deducao' | 'motivo' | 'valor_final', value: string, calculatedVal?: number) => {
        setOverrides(prev => {
            const current = prev[colabId] || { motivo: '' }
            if (field === 'deducao') {
                const deducao = value === '' ? undefined : Number(value);
                const final = deducao === undefined ? undefined : Math.max(0, (calculatedVal || 0) - deducao);
                return { ...prev, [colabId]: { ...current, deducao, valor_final: final } }
            } else if (field === 'valor_final') {
                const final = value === '' ? undefined : Number(value);
                const deducao = final === undefined ? undefined : (calculatedVal || 0) - final;
                return { ...prev, [colabId]: { ...current, valor_final: final, deducao } }
            }
            return { ...prev, [colabId]: { ...current, motivo: value } }
        })
    }

    async function handleLaunch() {
        setLaunching(true)
        setError(null)
        try {
            const res = await fetch('/api/pipj/lancar', { 
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ overrides })
            })
            const data = await res.json()
            if (!res.ok) {
                setError(data.error || 'Erro ao lançar PIPJ.')
                setLaunching(false)
                return
            }
            setResult(data)
            setLaunching(false)
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
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="shrink-0">
                    <DialogTitle className="font-display text-xl flex items-center gap-2">
                        <Zap className="h-5 w-5 text-emerald-500" />
                        Lançar PIPJ Mensal
                    </DialogTitle>
                    <DialogDescription>
                        Revise os cálculos abaixo. Você pode aplicar ajustes manuais (+/-) e informar o motivo antes de confirmar o lançamento.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto py-4">
                    {fetchingPreview && (
                        <div className="flex items-center justify-center p-8 text-slate-500">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <span className="ml-3">Calculando prévia do PIPJ...</span>
                        </div>
                    )}

                    {!result && !error && previewData && (
                        <div className="space-y-4">
                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                                <div className="text-sm text-amber-800 dark:text-amber-200">
                                    <p className="font-bold mb-1">Atenção!</p>
                                    <p>Esta ação é <strong>irreversível</strong>. Verifique os valores abaixo e insira ajustes se necessário.</p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                                        <tr>
                                            <th className="text-left p-3 font-bold">Colaborador</th>
                                            <th className="text-right p-3 font-bold">Calculado</th>
                                            <th className="text-right p-3 font-bold">Dedução (R$)</th>
                                            <th className="text-left p-3 font-bold w-40">Descrição / Motivo</th>
                                            <th className="text-right p-3 font-bold">Valor Final (R$)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewData.detalhes?.map((d: any) => {
                                            const override = overrides[d.colaborador_id]
                                            const deducao = override?.deducao ?? ''
                                            const final = override?.valor_final ?? Math.max(0, d.valor_calculado)
                                            const isChanged = final !== Math.max(0, d.valor_calculado);
                                            return (
                                                <tr key={d.colaborador_id} className="border-t border-slate-100 dark:border-slate-800">
                                                    <td className="p-3">
                                                        <p className="font-medium">{d.nome}</p>
                                                        <p className="text-slate-500 text-[10px]">{d.cargo}</p>
                                                    </td>
                                                    <td className="p-3 text-right font-medium text-slate-600 dark:text-slate-400">
                                                        R$ {Number(d.valor_calculado).toFixed(2).replace('.', ',')}
                                                    </td>
                                                    <td className="p-2">
                                                        <Input 
                                                            type="number" 
                                                            className="h-8 text-right text-xs" 
                                                            placeholder="0,00"
                                                            value={deducao}
                                                            onChange={(e) => handleOverrideChange(d.colaborador_id, 'deducao', e.target.value, d.valor_calculado)}
                                                        />
                                                    </td>
                                                    <td className="p-2">
                                                        <Input 
                                                            type="text" 
                                                            className="h-8 text-xs" 
                                                            placeholder="Motivo da alteração..."
                                                            disabled={!isChanged}
                                                            value={override?.motivo || ''}
                                                            onChange={(e) => handleOverrideChange(d.colaborador_id, 'motivo', e.target.value)}
                                                        />
                                                    </td>
                                                    <td className="p-2">
                                                        <Input 
                                                            type="number" 
                                                            className="h-8 text-right text-xs font-bold text-emerald-600 dark:text-emerald-400" 
                                                            value={final}
                                                            onChange={(e) => handleOverrideChange(d.colaborador_id, 'valor_final', e.target.value, d.valor_calculado)}
                                                        />
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {!canConfirm && (
                                <div className="text-center py-4">
                                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 mb-2">
                                        <span className="text-xl font-display font-bold text-slate-900 dark:text-white">{countdown}</span>
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                                        Aguarde para confirmar...
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {result && (
                        <div className="space-y-4">
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
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-start gap-3">
                            <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 shrink-0" />
                            <div className="text-sm text-red-800 dark:text-red-200">
                                <p className="font-bold mb-1">Erro</p>
                                <p>{error}</p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="shrink-0 mt-4">
                    {!result ? (
                        <Button
                            onClick={handleLaunch}
                            disabled={!canConfirm || launching || fetchingPreview}
                            className={`w-full ${canConfirm && !launching
                                ? 'bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/25'
                                : 'bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                                }`}
                        >
                            {launching ? (
                                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processando...</>
                            ) : !canConfirm && previewData ? (
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
