"use client"
import { NAO_AVALIAR } from "@/lib/forms-runtime"

export interface CriterioEscala {
    // Rótulo curto de uma nota (ex: "Muito ruim"). Sem título em NENHUMA
    // nota da pergunta, o controle usa o desenho compacto (botões 1-5 em
    // linha); com pelo menos um título definido, usa a lista de cartões
    // (um por nota, com o critério por extenso).
    titulo?: string
    // Texto mais longo explicando o critério dessa nota.
    descricao?: string
}

// Cor do número de cada nota — vai de vermelho (1) a verde (5), a mesma
// leitura de "quanto pior/melhor" já usada em outras telas (ex.: barras de
// distribuição em FormResponsesDashboard). A cor comunica a nota; o estado
// selecionado usa a cor de marca (violeta), igual a qualquer outra pergunta
// de seleção do sistema.
const COR_NOTA: Record<number, string> = {
    1: 'bg-rose-500',
    2: 'bg-orange-500',
    3: 'bg-amber-500',
    4: 'bg-lime-500',
    5: 'bg-emerald-500',
}

function temCriterioDetalhado(criterios?: Record<number, CriterioEscala>): boolean {
    if (!criterios) return false
    return [1, 2, 3, 4, 5].some(v => (criterios[v]?.titulo || '').trim() || (criterios[v]?.descricao || '').trim())
}

interface EscalaPickerProps {
    value: string
    onChange: (v: string) => void
    criterios?: Record<number, CriterioEscala>
    labelMin?: string
    labelMax?: string
    permiteNaoAvaliar?: boolean
}

// Controle de resposta de uma pergunta de escala (1 a 5). Compartilhado
// entre a tela em que o membro responde (PerguntaInput) e o NPS Projeto
// (ScalePicker), pra manter os dois com a mesma cara.
//
// Dois desenhos, escolhidos automaticamente pelo que a pergunta tem
// configurado:
// - Sem critério detalhado (só labelMin/labelMax, ou nada): botões 1-5
//   compactos em linha — o desenho de sempre.
// - Com critério detalhado (ao menos um título/descrição definido em
//   CreateFormDialog): lista de cartões, um por nota, com o critério por
//   extenso — pra quando a nota sozinha não basta pra saber o que ela
//   significa.
export function EscalaPicker({ value, onChange, criterios, labelMin, labelMax, permiteNaoAvaliar }: EscalaPickerProps) {
    if (temCriterioDetalhado(criterios)) {
        return (
            <div className="space-y-2">
                {[1, 2, 3, 4, 5].map(v => {
                    const c = criterios?.[v]
                    const selecionada = value === v.toString()
                    return (
                        <label
                            key={v}
                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                                selecionada
                                    ? 'border-violet-500 bg-violet-50/50 dark:bg-violet-500/10'
                                    : 'border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600'
                            }`}
                        >
                            <input type="radio" className="sr-only" checked={selecionada} onChange={() => onChange(v.toString())} />
                            <span className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-black text-white ${COR_NOTA[v]}`}>
                                {v}
                            </span>
                            <span className="flex-1 min-w-0 pt-0.5">
                                <p className="text-sm font-bold text-slate-900 dark:text-white">{c?.titulo?.trim() || `Nota ${v}`}</p>
                                {c?.descricao?.trim() && (
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{c.descricao}</p>
                                )}
                            </span>
                        </label>
                    )
                })}
                {permiteNaoAvaliar && (
                    <label
                        className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                            value === NAO_AVALIAR
                                ? 'border-slate-500 bg-slate-100 dark:bg-slate-800'
                                : 'border-dashed border-slate-300 dark:border-slate-600 hover:border-slate-400'
                        }`}
                    >
                        <input type="radio" className="sr-only" checked={value === NAO_AVALIAR} onChange={() => onChange(value === NAO_AVALIAR ? '' : NAO_AVALIAR)} />
                        <span className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white bg-slate-400 dark:bg-slate-600">
                            N/A
                        </span>
                        <span className="flex-1 min-w-0 pt-0.5">
                            <p className="text-sm font-bold text-slate-900 dark:text-white">Não avaliar</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Não tenho insumo — a nota não entra na média</p>
                        </span>
                    </label>
                )}
            </div>
        )
    }

    // Desenho compacto (sem critério detalhado) — igual ao de sempre.
    return (
        <div className="space-y-2">
            <div className="flex justify-between text-[10px] text-slate-400 px-1">
                <span>{labelMin || '1'}</span>
                <span>{labelMax || '5'}</span>
            </div>
            <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(v => (
                    <button
                        key={v}
                        type="button"
                        onClick={() => onChange(v.toString())}
                        className={`flex-1 h-11 rounded-xl font-bold text-sm transition-all ${
                            value === v.toString()
                                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-violet-100 dark:hover:bg-violet-500/10'
                        }`}
                    >
                        {v}
                    </button>
                ))}
            </div>
            {permiteNaoAvaliar && (
                <button
                    type="button"
                    onClick={() => onChange(value === NAO_AVALIAR ? '' : NAO_AVALIAR)}
                    className={`w-full h-9 rounded-xl text-xs font-bold transition-all border border-dashed ${
                        value === NAO_AVALIAR
                            ? 'bg-slate-700 text-white border-slate-700 dark:bg-slate-600 dark:border-slate-600'
                            : 'bg-transparent text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                    Não avaliar {value === NAO_AVALIAR ? '(selecionado — não entra na média)' : '— não tenho insumo para avaliar'}
                </button>
            )}
        </div>
    )
}
