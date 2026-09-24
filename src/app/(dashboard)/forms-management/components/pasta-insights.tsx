"use client"
import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { Trophy, Medal, Loader2, Calendar } from "lucide-react"
import { modeloAvaliacao, type ItemRanking } from "@/lib/forms-avaliacao"
import { buscarTodasPaginas } from "@/lib/paginacao"

interface Props {
    // Formulários desta pasta (mesmo Tipo do Formulário). Entram os que
    // avaliam pessoas — por pergunta "Selecionar 1 Colaborador" ou por
    // direcionamento (Público → quem recebe) —, igual ao Ranking dos
    // Avaliados de cada formulário individual.
    formularioIds: string[]
}

const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']
const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']

const MEDAL_STYLES = [
    { badge: 'bg-amber-400 text-amber-950', card: 'border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5' },
    { badge: 'bg-slate-300 text-slate-800', card: 'border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40' },
    { badge: 'bg-orange-300 text-orange-950', card: 'border-orange-200 dark:border-orange-500/20 bg-orange-50/50 dark:bg-orange-500/5' },
]

const chaveMes = (data: string) => {
    const d = new Date(data)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// Insumo comparativo de uma pasta de formulários: média das notas RECEBIDAS
// por cada membro num mês (mês de envio, como no painel de cada formulário),
// somando os formulários da pasta — mesma conta do "Ranking dos Avaliados"
// (ver src/lib/forms-avaliacao.ts). Quem saiu do cadastro fica de fora.
export function PastaInsights({ formularioIds }: Props) {
    const [loading, setLoading] = useState(true)
    const [perguntas, setPerguntas] = useState<any[]>([])
    const [respostas, setRespostas] = useState<any[]>([])
    const [nomes, setNomes] = useState<Map<string, string>>(new Map())
    const [mesSelecionado, setMesSelecionado] = useState('')
    const [showFull, setShowFull] = useState<Record<string, boolean>>({})
    const idsKey = formularioIds.join(',')

    useEffect(() => {
        let cancelado = false
        async function carregar() {
            setLoading(true)
            const ids = idsKey ? idsKey.split(',') : []
            if (ids.length === 0) { setPerguntas([]); setRespostas([]); setLoading(false); return }
            const [{ data: pData }, { data: rData }, { data: cData }] = await Promise.all([
                supabase.from('formulario_perguntas').select('id, formulario_id, tipo, titulo, competencia, ordem').in('formulario_id', ids),
                buscarTodasPaginas((de, ate) => supabase.from('formulario_respostas')
                    .select('id, formulario_id, enviado_em, alvo_colaborador_id, formulario_respostas_itens(pergunta_id, valor)')
                    .in('formulario_id', ids).order('id').range(de, ate)),
                supabase.from('colaboradores').select('id, nome'),
            ])
            if (cancelado) return
            // Perguntas de cada formulário juntas e na ordem dele (ver modeloAvaliacao).
            const ordenadas = [...(pData || [])].sort((a: any, b: any) =>
                (ids.indexOf(a.formulario_id) - ids.indexOf(b.formulario_id)) || ((a.ordem ?? 0) - (b.ordem ?? 0)))
            setPerguntas(ordenadas)
            setRespostas(rData || [])
            setNomes(new Map((cData || []).map((c: any) => [c.id, c.nome])))
            setMesSelecionado('')
            setShowFull({})
            setLoading(false)
        }
        carregar()
        return () => { cancelado = true }
    }, [idsKey])

    const modelo = useMemo(
        () => modeloAvaliacao(perguntas, respostas, { avaliadoValido: id => nomes.has(id) }),
        [perguntas, respostas, nomes],
    )

    // Linhas com alguém avaliado e ao menos uma nota, e os meses em que há.
    const linhas = useMemo(
        () => respostas.flatMap(r => modelo.linhasDaResposta(r)).filter(l => l.avaliadoId && l.notas.length > 0),
        [respostas, modelo],
    )
    const meses = useMemo(() => {
        const vistos = new Set(linhas.map(l => chaveMes(l.resposta.enviado_em)))
        return Array.from(vistos).sort((a, b) => b.localeCompare(a)).map(key => {
            const [ano, mes] = key.split('-').map(Number)
            return { key, mes, ano, label: `${MESES_CURTOS[mes - 1]}/${ano}` }
        })
    }, [linhas])

    if (loading) {
        return <div className="p-4 text-xs text-slate-400 flex items-center gap-2"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Calculando médias da pasta...</div>
    }
    if (meses.length === 0) return null

    // Padrão: o mês mais recente com avaliações.
    const mes = meses.find(m => m.key === mesSelecionado) ?? meses[0]
    const resumo = modelo.resumir(linhas.filter(l => chaveMes(l.resposta.enviado_em) === mes.key))
    const blocos = resumo.papeis.filter(p => p.chave !== null && p.ranking.length > 0)
    const mostrarPapel = blocos.length > 1

    const nomeDe = (id: string) => nomes.get(id) || 'Membro removido'
    const plural = (n: number) => `${n} avaliação${n !== 1 ? 'ões' : ''}`

    const renderRanking = (chave: string, ranking: ItemRanking[]) => {
        const completo = showFull[chave]
        return (
            <>
                {ranking.length > 3 && (
                    <div className="flex justify-end -mt-1 mb-2">
                        <button onClick={() => setShowFull(v => ({ ...v, [chave]: !v[chave] }))} className="text-xs font-bold text-violet-600 dark:text-violet-400 hover:underline">
                            {completo ? 'Ver apenas top 3' : `Ver todos (${ranking.length})`}
                        </button>
                    </div>
                )}
                {!completo ? (
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {ranking.slice(0, 3).map((r, i) => (
                            <div key={r.avaliadoId} className={`flex flex-col items-center text-center gap-2 p-4 rounded-xl border ${MEDAL_STYLES[i].card}`}>
                                <div className={`flex items-center justify-center w-9 h-9 rounded-full font-black text-sm ${MEDAL_STYLES[i].badge}`}>
                                    {i === 0 ? <Trophy className="h-4 w-4" /> : <Medal className="h-4 w-4" />}
                                </div>
                                <p className="font-bold text-sm text-slate-900 dark:text-white truncate max-w-full">{nomeDe(r.avaliadoId)}</p>
                                <p className="text-2xl font-black text-violet-600 dark:text-violet-400">{r.media.toFixed(2)}<span className="text-sm text-slate-400 font-bold">/5</span></p>
                                <p className="text-[11px] text-slate-400">{plural(r.qtdRespostas)}</p>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="space-y-1.5 max-h-96 overflow-y-auto pr-1">
                        {ranking.map((r, i) => (
                            <div key={r.avaliadoId} className={`flex items-center justify-between px-3 py-2 rounded-xl border ${i < 3 ? MEDAL_STYLES[i].card : 'bg-white dark:bg-transparent border-slate-100 dark:border-slate-800'}`}>
                                <div className="flex items-center gap-3 min-w-0">
                                    <span className={`shrink-0 flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-black ${i < 3 ? MEDAL_STYLES[i].badge : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>
                                        {i + 1}
                                    </span>
                                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300 truncate">{nomeDe(r.avaliadoId)}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-[11px] text-slate-400">{plural(r.qtdRespostas)}</span>
                                    <span className="font-bold text-violet-600 dark:text-violet-400 text-sm">{r.media.toFixed(2)}/5</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </>
        )
    }

    return (
        <div className="bg-gradient-to-br from-violet-50 to-white dark:from-violet-500/10 dark:to-slate-800/50 p-5 rounded-2xl border border-violet-100 dark:border-violet-500/20 mb-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2 flex-wrap mb-3">
                <Trophy className="h-4 w-4 text-amber-500" />
                Médias recebidas nesta pasta em {MESES[mes.mes - 1]}/{mes.ano}
                <span className="text-xs font-normal text-slate-400">— soma dos formulários deste tipo enviados no mês</span>
            </h3>

            <div className="flex flex-wrap items-center gap-1.5 mb-4">
                <Calendar className="h-3.5 w-3.5 text-violet-500 shrink-0" />
                {meses.map(m => (
                    <button
                        key={m.key}
                        onClick={() => setMesSelecionado(m.key)}
                        className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition-all ${m.key === mes.key ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/20' : 'bg-white/70 dark:bg-slate-800 text-slate-500 hover:bg-violet-100 dark:hover:bg-violet-500/10 hover:text-violet-700'}`}
                    >
                        {m.label}
                    </button>
                ))}
            </div>

            <div className="space-y-5">
                {blocos.map(p => (
                    <div key={p.chave}>
                        {mostrarPapel && (
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2">{p.label}</p>
                        )}
                        {renderRanking(p.chave!, p.ranking)}
                    </div>
                ))}
            </div>
        </div>
    )
}
