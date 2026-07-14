"use client"

import React, { useState, useEffect, useCallback, useRef, Fragment } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog, DialogContent, DialogDescription, DialogFooter,
    DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Zap, Loader2, CheckCircle, AlertTriangle, ChevronDown, ChevronRight, CalendarDays } from "lucide-react"

const MESES = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
]

function getYearOptions() {
    const current = new Date().getFullYear()
    return [current - 1, current, current + 1]
}

// Mesmo percentual usado no backend (/api/pipj/lancar) para o bônus manual
// "NPS 10/CSAT 5". É somado ao bônus de NPS automático — nunca aplicado em
// cima dele — por isso ambos usam a mesma base (subtotal_apos_ausencia).
const NPS_CSAT_BONUS_PERCENT = 0.10
// Bônus manual "Reconhecimento": valor FIXO, somado por fora — nunca entra
// na base dos bônus percentuais de NPS/CSAT, nem é limitado pelo teto.
const RECONHECIMENTO_BONUS_VALOR = 50
const MAX_PER_PERSON = 300

export function PipjLaunchDialog() {
    const now = new Date()
    const [open, setOpen] = useState(false)
    const [selectedMes, setSelectedMes] = useState(now.getMonth() + 1)
    const [selectedAno, setSelectedAno] = useState(now.getFullYear())
    const [mesSemLucro, setMesSemLucro] = useState(false)
    const [countdown, setCountdown] = useState(5)
    const [canConfirm, setCanConfirm] = useState(false)
    const [launching, setLaunching] = useState(false)
    const [fetchingPreview, setFetchingPreview] = useState(false)
    const [previewData, setPreviewData] = useState<any>(null)
    const [overrides, setOverrides] = useState<Record<string, { deducao?: number, valorFinal?: number, source?: 'deducao' | 'final', motivo: string }>>({})
    const [npsCsatBonus, setNpsCsatBonus] = useState<Record<string, boolean>>({})
    const [reconhecimentoBonus, setReconhecimentoBonus] = useState<Record<string, boolean>>({})
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
    const [result, setResult] = useState<any>(null)
    const [error, setError] = useState<string | null>(null)
    const intervalRef = useRef<NodeJS.Timeout | null>(null)

    const toggleRow = (colabId: string) => {
        setExpandedRows(prev => ({ ...prev, [colabId]: !prev[colabId] }))
    }

    const toggleNpsCsat = (colabId: string) => {
        setNpsCsatBonus(prev => ({ ...prev, [colabId]: !prev[colabId] }))
    }

    const toggleReconhecimento = (colabId: string) => {
        setReconhecimentoBonus(prev => ({ ...prev, [colabId]: !prev[colabId] }))
    }

    // Bônus manual "NPS 10/CSAT 5" e valor final de um colaborador. Usa a
    // MESMA base que o bônus de NPS automático (subtotal_apos_ausencia) —
    // nunca o valor "Calculado" que já inclui aquele bônus, senão os dois
    // bônus percentuais comporiam entre si em vez de somar. Uma dedução
    // manual reduz essa base antes do cálculo dos 10% (ex.: base R$100,
    // dedução R$20 → bônus = 10% de R$80 = R$8, final R$88). Reativo —
    // recalcula sempre que a dedução ou a caixa de seleção mudam, em
    // qualquer ordem.
    const getBonusInfo = (d: any) => {
        const override = overrides[d.colaborador_id]
        const isPunido = !!d.detalhes_calculo?.plano_punicao
        const isCsatSelected = !!npsCsatBonus[d.colaborador_id] && !isPunido
        const isReconhecimentoSelected = !!reconhecimentoBonus[d.colaborador_id] && !isPunido
        const subtotalBase = d.detalhes_calculo?.subtotal_apos_ausencia ?? d.valor_calculado
        const bonusReconhecimento = isReconhecimentoSelected ? RECONHECIMENTO_BONUS_VALOR : 0

        const naturalBonus = isCsatSelected ? Math.round(subtotalBase * NPS_CSAT_BONUS_PERCENT * 100) / 100 : 0
        const naturalFinal = Math.max(0, Math.min(d.valor_calculado + naturalBonus, MAX_PER_PERSON) + bonusReconhecimento)

        if (override?.source === 'final') {
            // Valor Final digitado diretamente é um override absoluto — não
            // recalcula bônus em cima dele.
            const final = Math.max(0, override.valorFinal ?? naturalFinal)
            return { bonusCsat: 0, bonusReconhecimento, final, naturalFinal }
        }

        if (override?.source === 'deducao') {
            const deducao = override.deducao ?? 0
            const baseParaBonus = Math.max(0, subtotalBase - deducao)
            const bonusCsat = isCsatSelected ? Math.round(baseParaBonus * NPS_CSAT_BONUS_PERCENT * 100) / 100 : 0
            const final = Math.max(0, Math.min((d.valor_calculado - deducao) + bonusCsat, MAX_PER_PERSON) + bonusReconhecimento)
            return { bonusCsat, bonusReconhecimento, final, naturalFinal }
        }

        return { bonusCsat: naturalBonus, bonusReconhecimento, final: naturalFinal, naturalFinal }
    }

    const resetState = useCallback(() => {
        setCountdown(5)
        setCanConfirm(false)
        setLaunching(false)
        setResult(null)
        setError(null)
        setPreviewData(null)
        setOverrides({})
        setNpsCsatBonus({})
        setReconhecimentoBonus({})
        if (intervalRef.current) clearInterval(intervalRef.current)
    }, [])

    const fetchPreview = useCallback(async () => {
        setFetchingPreview(true)
        setError(null)
        try {
            const res = await fetch(`/api/pipj/preview?mes=${selectedMes}&ano=${selectedAno}&mesSemLucro=${mesSemLucro}`)
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
    }, [selectedMes, selectedAno, mesSemLucro])

    useEffect(() => {
        if (open) {
            resetState()
            fetchPreview()
        } else {
            resetState()
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
    }, [open, resetState, fetchPreview])

    const handleOverrideChange = (colabId: string, field: 'deducao' | 'motivo' | 'valor_final', value: string) => {
        setOverrides(prev => {
            const current = prev[colabId] || { motivo: '' }
            if (field === 'deducao') {
                const deducao = value === '' ? undefined : Number(value);
                return { ...prev, [colabId]: { ...current, deducao, valorFinal: undefined, source: deducao === undefined ? undefined : 'deducao' } }
            } else if (field === 'valor_final') {
                const valorFinal = value === '' ? undefined : Number(value);
                return { ...prev, [colabId]: { ...current, valorFinal, deducao: undefined, source: valorFinal === undefined ? undefined : 'final' } }
            }
            return { ...prev, [colabId]: { ...current, motivo: value } }
        })
    }

    async function handleLaunch() {
        setLaunching(true)
        setError(null)
        try {
            // Envia a dedução/valor final "crus" — o backend é quem calcula o
            // bônus NPS 10/CSAT 5 sobre a base já com a dedução aplicada
            // (fonte de verdade, evita o front e o back divergirem no cálculo).
            const payloadOverrides: Record<string, { deducao?: number, valor_final?: number, motivo: string }> = {}
            for (const [colabId, o] of Object.entries(overrides)) {
                if (!o.source) continue
                payloadOverrides[colabId] = o.source === 'deducao'
                    ? { deducao: o.deducao, motivo: o.motivo }
                    : { valor_final: o.valorFinal, motivo: o.motivo }
            }

            const res = await fetch('/api/pipj/lancar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ overrides: payloadOverrides, npsCsatBonus, reconhecimentoBonus, mes: selectedMes, ano: selectedAno, mesSemLucro })
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
            <DialogContent className="sm:max-w-[1100px] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
                <DialogHeader className="shrink-0">
                    <DialogTitle className="font-display text-xl flex items-center gap-2">
                        <Zap className="h-5 w-5 text-emerald-500" />
                        Lançar PIPJ Mensal
                    </DialogTitle>
                    <DialogDescription>
                        Selecione o mês de referência, revise os cálculos e aplique ajustes se necessário.
                    </DialogDescription>
                    {/* Seletor de mês/ano (sempre visível) */}
                    {!result && (
                        <div className="flex items-center gap-2 pt-2 flex-wrap">
                            <CalendarDays className="h-4 w-4 text-slate-400 shrink-0" />
                            <span className="text-xs text-slate-500 font-medium shrink-0">Referência:</span>
                            <Select value={String(selectedMes)} onValueChange={v => { setSelectedMes(Number(v)); resetState(); }}>
                                <SelectTrigger className="h-7 w-32 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {MESES.map((m, i) => (
                                        <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">{m}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Select value={String(selectedAno)} onValueChange={v => { setSelectedAno(Number(v)); resetState(); }}>
                                <SelectTrigger className="h-7 w-20 text-xs">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {getYearOptions().map(y => (
                                        <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            {!fetchingPreview && (
                                <Button size="sm" variant="outline" className="h-7 text-xs px-2" onClick={() => { resetState(); fetchPreview() }}>
                                    Calcular
                                </Button>
                            )}
                            <label className="flex items-center gap-1.5 ml-1 cursor-pointer">
                                <input
                                    type="checkbox"
                                    className="h-3.5 w-3.5 accent-amber-500 cursor-pointer"
                                    checked={mesSemLucro}
                                    onChange={(e) => { setMesSemLucro(e.target.checked); resetState(); }}
                                />
                                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Mês sem lucro</span>
                            </label>
                        </div>
                    )}
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
                            {/* Mês/Ano referência */}
                            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                                <CalendarDays className="h-4 w-4 text-slate-500 shrink-0" />
                                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 shrink-0">Mês de referência:</span>
                                <Select value={String(selectedMes)} onValueChange={v => { setSelectedMes(Number(v)); resetState(); }}>
                                    <SelectTrigger className="h-8 w-36 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {MESES.map((m, i) => (
                                            <SelectItem key={i + 1} value={String(i + 1)} className="text-xs">{m}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Select value={String(selectedAno)} onValueChange={v => { setSelectedAno(Number(v)); resetState(); }}>
                                    <SelectTrigger className="h-8 w-24 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {getYearOptions().map(y => (
                                            <SelectItem key={y} value={String(y)} className="text-xs">{y}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <label className="flex items-center gap-1.5 ml-auto cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="h-3.5 w-3.5 accent-amber-500 cursor-pointer"
                                        checked={mesSemLucro}
                                        onChange={(e) => { setMesSemLucro(e.target.checked); resetState(); }}
                                    />
                                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Mês sem lucro</span>
                                </label>
                                <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => { resetState(); fetchPreview() }}>
                                    Recalcular
                                </Button>
                            </div>

                            {mesSemLucro && (
                                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 flex items-center gap-2">
                                    <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                                    <p className="text-xs text-amber-800 dark:text-amber-200">
                                        <strong>Mês sem lucro ativo:</strong> o valor base do cargo foi reduzido em 30% e o adicional por projeto passou de R$15 para R$10 para todos os colaboradores.
                                    </p>
                                </div>
                            )}

                            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
                                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                                <div className="text-sm text-amber-800 dark:text-amber-200">
                                    <p className="font-bold mb-1">Atenção!</p>
                                    <p>Esta ação é <strong>irreversível</strong>. Verifique os valores abaixo e insira ajustes se necessário.</p>
                                </div>
                            </div>

                            <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
                              <div className="overflow-x-auto">
                                <table className="w-full min-w-[920px] text-xs">
                                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                                        <tr>
                                            <th className="text-left p-3 font-bold whitespace-nowrap">Colaborador</th>
                                            <th className="text-right p-3 font-bold whitespace-nowrap">Calculado</th>
                                            <th className="text-center p-3 font-bold whitespace-nowrap">NPS 10/CSAT 5</th>
                                            <th className="text-center p-3 font-bold whitespace-nowrap">Reconhecimento</th>
                                            <th className="text-right p-3 font-bold whitespace-nowrap w-28">Dedução (R$)</th>
                                            <th className="text-left p-3 font-bold w-48">Descrição / Motivo</th>
                                            <th className="text-right p-3 font-bold whitespace-nowrap w-32">Valor Final (R$)</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[...(previewData.detalhes ?? [])].sort((a: any, b: any) => (a.nome ?? '').localeCompare(b.nome ?? '', 'pt-BR')).map((d: any) => {
                                            const override = overrides[d.colaborador_id]
                                            const deducao = override?.source === 'deducao' ? (override.deducao ?? '') : ''
                                            const { bonusCsat, bonusReconhecimento, final, naturalFinal } = getBonusInfo(d)
                                            const isCsatSelected = !!npsCsatBonus[d.colaborador_id]
                                            const isReconhecimentoSelected = !!reconhecimentoBonus[d.colaborador_id]
                                            const isChanged = final !== naturalFinal
                                            const isExpanded = !!expandedRows[d.colaborador_id]
                                            
                                            return (
                                                <Fragment key={d.colaborador_id}>
                                                    <tr className="border-t border-slate-100 dark:border-slate-800">
                                                        <td className="p-3">
                                                            <div className="flex items-center gap-2">
                                                                <button 
                                                                    onClick={() => toggleRow(d.colaborador_id)}
                                                                    className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded text-slate-500"
                                                                >
                                                                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                                                                </button>
                                                                <div>
                                                                    <p className="font-medium">{d.nome}</p>
                                                                    <p className="text-slate-500 text-[10px]">{d.cargo}</p>
                                                                </div>
                                                            </div>
                                                        </td>
                                                        <td className="p-3 text-right font-medium text-slate-600 dark:text-slate-400">
                                                            {d.detalhes_calculo?.plano_punicao
                                                                ? <span className="text-rose-500 font-bold text-xs">R$ 0,00 <span className="text-[10px] opacity-70">(punição)</span></span>
                                                                : `R$ ${Number(d.valor_calculado).toFixed(2).replace('.', ',')}`
                                                            }
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <input
                                                                    type="checkbox"
                                                                    className="h-4 w-4 accent-emerald-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                                                                    checked={isCsatSelected}
                                                                    disabled={!!d.detalhes_calculo?.plano_punicao}
                                                                    onChange={() => toggleNpsCsat(d.colaborador_id)}
                                                                />
                                                                {isCsatSelected && (
                                                                    <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                                                                        +R$ {bonusCsat.toFixed(2).replace('.', ',')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-2 text-center">
                                                            <div className="flex flex-col items-center gap-0.5">
                                                                <input
                                                                    type="checkbox"
                                                                    className="h-4 w-4 accent-violet-600 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                                                                    checked={isReconhecimentoSelected}
                                                                    disabled={!!d.detalhes_calculo?.plano_punicao}
                                                                    onChange={() => toggleReconhecimento(d.colaborador_id)}
                                                                />
                                                                {isReconhecimentoSelected && (
                                                                    <span className="text-[10px] font-bold text-violet-600 dark:text-violet-400">
                                                                        +R$ {bonusReconhecimento.toFixed(2).replace('.', ',')}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>
                                                        <td className="p-2">
                                                            <Input
                                                                type="number"
                                                                className="h-8 text-right text-xs"
                                                                placeholder="0,00"
                                                                value={deducao}
                                                                disabled={!!d.detalhes_calculo?.plano_punicao}
                                                                onChange={(e) => handleOverrideChange(d.colaborador_id, 'deducao', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <Input
                                                                type="text"
                                                                className="h-8 text-xs"
                                                                placeholder="Motivo da alteração..."
                                                                disabled={!isChanged || !!d.detalhes_calculo?.plano_punicao}
                                                                value={override?.motivo || ''}
                                                                onChange={(e) => handleOverrideChange(d.colaborador_id, 'motivo', e.target.value)}
                                                            />
                                                        </td>
                                                        <td className="p-2">
                                                            <Input
                                                                type="number"
                                                                className="h-8 text-right text-xs font-bold text-emerald-600 dark:text-emerald-400"
                                                                value={final}
                                                                onChange={(e) => handleOverrideChange(d.colaborador_id, 'valor_final', e.target.value)}
                                                            />
                                                        </td>
                                                    </tr>
                                                    {isExpanded && d.detalhes_calculo && (
                                                        <tr className="bg-slate-50/50 dark:bg-slate-800/20 border-b border-slate-100 dark:border-slate-800">
                                                            <td colSpan={7} className="p-4 text-xs text-slate-600 dark:text-slate-400">
                                                                <div className="grid grid-cols-2 sm:grid-cols-6 gap-4">
                                                                    <div>
                                                                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Base Cargo</span>
                                                                        <span>R$ {Number(d.detalhes_calculo.base_cargo || 0).toFixed(2).replace('.', ',')}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Nível ({d.detalhes_calculo.nivel || 1})</span>
                                                                        <span className="text-emerald-600 dark:text-emerald-400">+ R$ {Number(d.detalhes_calculo.bonus_nivel || 0).toFixed(2).replace('.', ',')}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Projetos ({d.detalhes_calculo.qtd_projetos || 0})</span>
                                                                        <span className="text-emerald-600 dark:text-emerald-400">+ R$ {Number(d.detalhes_calculo.bonus_projetos || 0).toFixed(2).replace('.', ',')}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="block text-[10px] font-bold text-slate-400 uppercase">NPS ({Number(d.detalhes_calculo.nps_score || 0).toFixed(1)})</span>
                                                                        <span className="text-emerald-600 dark:text-emerald-400">+ R$ {Number(d.detalhes_calculo.bonus_nps || 0).toFixed(2).replace('.', ',')}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Punição (-{d.detalhes_calculo.pontos_negativos || 0} pts)</span>
                                                                        <span className="text-red-500">- R$ {Number(d.detalhes_calculo.desconto_punicao || 0).toFixed(2).replace('.', ',')}</span>
                                                                    </div>
                                                                    <div>
                                                                        <span className="block text-[10px] font-bold text-slate-400 uppercase">Ausência ({d.detalhes_calculo.dias_ausencia || 0}d)</span>
                                                                        <span className="text-red-500">- R$ {Number(d.detalhes_calculo.desconto_ausencia || 0).toFixed(2).replace('.', ',')}</span>
                                                                    </div>
                                                                    {isCsatSelected && (
                                                                        <div>
                                                                            <span className="block text-[10px] font-bold text-slate-400 uppercase">NPS 10/CSAT 5</span>
                                                                            <span className="text-emerald-600 dark:text-emerald-400">+ R$ {bonusCsat.toFixed(2).replace('.', ',')}</span>
                                                                        </div>
                                                                    )}
                                                                    {isReconhecimentoSelected && (
                                                                        <div>
                                                                            <span className="block text-[10px] font-bold text-slate-400 uppercase">Reconhecimento</span>
                                                                            <span className="text-violet-600 dark:text-violet-400">+ R$ {bonusReconhecimento.toFixed(2).replace('.', ',')}</span>
                                                                        </div>
                                                                    )}
                                                                    {d.detalhes_calculo.plano_punicao && (
                                                                        <div className="col-span-2 sm:col-span-6 mt-1">
                                                                            <span className="inline-flex items-center gap-1 bg-rose-100 dark:bg-rose-500/20 text-rose-700 dark:text-rose-400 text-[10px] font-bold px-2 py-1 rounded-full">
                                                                                <AlertTriangle className="h-3 w-3" /> PLANO DE PUNIÇÃO ATIVO — PIPJ zerado
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    )}
                                                </Fragment>
                                            )
                                        })}
                                    </tbody>
                                </table>
                              </div>
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
