"use client"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Trophy, Medal, Loader2 } from "lucide-react"
import { avaliadoPerguntaPorSecao } from "@/lib/forms-runtime"

interface Props {
    // Formulários desta pasta (mesmo Tipo do Formulário) que participam da
    // comparação — só entram os que tiverem o padrão "avaliação de pares"
    // (uma pergunta colaborador_unico + perguntas de escala), igual ao
    // Ranking dos Avaliados de cada formulário individual.
    formularioIds: string[]
}

const MEDAL_STYLES = [
    { badge: 'bg-amber-400 text-amber-950', card: 'border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5' },
    { badge: 'bg-slate-300 text-slate-800', card: 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40' },
    { badge: 'bg-orange-300 text-orange-950', card: 'border-orange-200 dark:border-orange-500/20 bg-orange-50/50 dark:bg-orange-500/5' },
]

// Insumo comparativo de uma pasta de formulários: média das notas RECEBIDAS
// por cada membro, somando todas as avaliações de todos os formulários dessa
// pasta — mesma lógica do "Ranking dos Avaliados" de um formulário só (ver
// FormResponsesDashboard), agora combinando vários formulários do mesmo tipo
// (ex: os 5 formulários de Diretoria, ou os 3 de Tático).
export function PastaInsights({ formularioIds }: Props) {
    const [loading, setLoading] = useState(true)
    const [ranking, setRanking] = useState<{ id: string; nome: string; media: number; totalAvaliacoes: number }[]>([])
    const [showFull, setShowFull] = useState(false)

    useEffect(() => {
        let cancelado = false
        async function carregar() {
            setLoading(true)
            if (formularioIds.length === 0) { setRanking([]); setLoading(false); return }
            const [{ data: perguntas }, { data: respostas }, { data: colaboradores }] = await Promise.all([
                supabase.from('formulario_perguntas').select('id, formulario_id, tipo, ordem').in('formulario_id', formularioIds),
                supabase.from('formulario_respostas').select('id, formulario_id, formulario_respostas_itens(pergunta_id, valor)').in('formulario_id', formularioIds),
                supabase.from('colaboradores').select('id, nome'),
            ])
            if (cancelado) return

            const nomePorId = new Map((colaboradores || []).map((c: any) => [c.id, c.nome]))

            // Por formulário: quais são as perguntas de escala (as notas) e,
            // pra cada uma, qual pergunta colaborador_unico DA MESMA SEÇÃO
            // identifica quem está sendo avaliado ali (ver
            // avaliadoPerguntaPorSecao — a maioria dos formulários tem só
            // UM colaborador_unico, mas um formulário como um NPS Projetos
            // único pode ter vários, um por seção, cada um sobre uma
            // pessoa diferente na MESMA resposta).
            const escalaPerguntasPorForm = new Map<string, Set<string>>()
            const perguntasPorForm = new Map<string, { id: string, formulario_id: string, tipo: string, ordem?: number }[]>()
            for (const p of perguntas || []) {
                const arr = perguntasPorForm.get(p.formulario_id) || []
                arr.push(p)
                perguntasPorForm.set(p.formulario_id, arr)
                if (p.tipo === 'escala') {
                    const set = escalaPerguntasPorForm.get(p.formulario_id) || new Set<string>()
                    set.add(p.id)
                    escalaPerguntasPorForm.set(p.formulario_id, set)
                }
            }
            const avaliadoPorFormPergunta = new Map<string, Map<string, string>>()
            for (const [formId, ps] of perguntasPorForm.entries()) {
                const ordenadas = [...ps].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
                avaliadoPorFormPergunta.set(formId, avaliadoPerguntaPorSecao(ordenadas))
            }

            const acc: Record<string, { soma: number; qtd: number; avaliacoes: Set<string> }> = {}
            for (const r of respostas || []) {
                const avaliadoMap = avaliadoPorFormPergunta.get(r.formulario_id)
                const escalaIds = escalaPerguntasPorForm.get(r.formulario_id)
                if (!avaliadoMap || avaliadoMap.size === 0 || !escalaIds || escalaIds.size === 0) continue

                const itens = r.formulario_respostas_itens || []
                // Uma resposta pode ter mais de um colaborador_unico (uma
                // pessoa avaliada por seção) — soma as escalas de cada um
                // separadamente, na conta de quem foi avaliado ali.
                const colaboradorUnicoIds = new Set(avaliadoMap.values())
                for (const cuId of colaboradorUnicoIds) {
                    const avaliadoItem = itens.find((it: any) => it.pergunta_id === cuId)
                    const avaliadoId = avaliadoItem?.valor
                    if (!avaliadoId) continue

                    for (const it of itens) {
                        if (!escalaIds.has(it.pergunta_id)) continue
                        if (avaliadoMap.get(it.pergunta_id) !== cuId) continue
                        const v = Number(it.valor)
                        if (isNaN(v)) continue
                        if (!acc[avaliadoId]) acc[avaliadoId] = { soma: 0, qtd: 0, avaliacoes: new Set() }
                        acc[avaliadoId].soma += v
                        acc[avaliadoId].qtd += 1
                        acc[avaliadoId].avaliacoes.add(r.id)
                    }
                }
            }

            const result = Object.entries(acc)
                .map(([id, d]) => ({ id, nome: nomePorId.get(id) || id, media: d.qtd > 0 ? d.soma / d.qtd : 0, totalAvaliacoes: d.avaliacoes.size }))
                .sort((a, b) => b.media - a.media)

            setRanking(result)
            setLoading(false)
        }
        carregar()
        return () => { cancelado = true }
    }, [formularioIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

    if (loading) {
        return <div className="p-4 text-xs text-slate-400 flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculando médias da pasta...</div>
    }

    if (ranking.length === 0) {
        return null
    }

    return (
        <div className="bg-gradient-to-br from-violet-50 to-white dark:from-violet-500/10 dark:to-slate-800/50 p-5 rounded-2xl border border-violet-100 dark:border-violet-500/20 mb-4">
            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    Médias recebidas nesta pasta
                    <span className="text-xs font-normal text-slate-400">— soma de todos os formulários deste tipo</span>
                </h3>
                {ranking.length > 3 && (
                    <button onClick={() => setShowFull(v => !v)} className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline">
                        {showFull ? 'Ver apenas top 3' : `Ver todos (${ranking.length})`}
                    </button>
                )}
            </div>

            {!showFull ? (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {ranking.slice(0, 3).map((r, i) => (
                        <div key={r.id} className={`flex flex-col items-center text-center gap-2 p-4 rounded-xl border ${MEDAL_STYLES[i].card}`}>
                            <div className={`flex items-center justify-center w-9 h-9 rounded-full font-black text-sm ${MEDAL_STYLES[i].badge}`}>
                                {i === 0 ? <Trophy className="h-4 w-4" /> : <Medal className="h-4 w-4" />}
                            </div>
                            <p className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-full">{r.nome}</p>
                            <p className="text-2xl font-black text-violet-600 dark:text-violet-400">{r.media.toFixed(1)}<span className="text-sm text-slate-400 font-bold">/5</span></p>
                            <p className="text-[11px] text-slate-400">{r.totalAvaliacoes} avaliação{r.totalAvaliacoes !== 1 ? 'ões' : ''}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                    {ranking.map((r, i) => (
                        <div key={r.id} className={`flex items-center justify-between px-3 py-2 rounded-xl border ${i < 3 ? MEDAL_STYLES[i].card : 'bg-white dark:bg-transparent border-slate-100 dark:border-slate-800'}`}>
                            <div className="flex items-center gap-3 min-w-0">
                                <span className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black ${i < 3 ? MEDAL_STYLES[i].badge : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                    {i + 1}
                                </span>
                                <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{r.nome}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                                <span className="text-[11px] text-slate-400">{r.totalAvaliacoes} avaliação{r.totalAvaliacoes !== 1 ? 'ões' : ''}</span>
                                <span className="font-bold text-violet-600 dark:text-violet-400 text-sm">{r.media.toFixed(1)}/5</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
