"use client"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { NAO_AVALIAR } from "@/lib/forms-runtime"

interface PerguntaInputProps {
    pergunta: any
    valor: any
    onChange: (valor: any) => void
    colaboradores: { id: string, nome: string }[]
    selfId?: string | null
    numero: number
}

// Renderiza UMA pergunta de formulário (enunciado + controle de resposta).
// Compartilhado entre a tela em que o membro responde e a simulação de
// resposta em Gestão de Formulários, para que o teste mostre exatamente o
// mesmo formulário que o membro vai ver.
export function PerguntaInput({ pergunta: p, valor, onChange, colaboradores, selfId, numero }: PerguntaInputProps) {
    if (p.tipo === 'titulo') {
        return (
            <div className="pt-2 pb-1">
                {p.titulo && <h2 className="text-lg font-bold text-slate-900 dark:text-white">{p.titulo}</h2>}
                {p.descricao && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{p.descricao}</p>}
            </div>
        )
    }

    const outros = colaboradores.filter(c => c.id !== selfId).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    return (
        <div className="space-y-2">
            <label className="text-sm font-bold text-slate-900 dark:text-slate-200 flex items-center gap-2">
                <span className="text-violet-600 dark:text-violet-400">{numero}.</span>
                <span dangerouslySetInnerHTML={{ __html: p.titulo }} />
                {p.obrigatoria && <span className="text-rose-500 text-xs">*</span>}
            </label>

            {p.tipo === 'texto' && (
                <Textarea
                    placeholder="Sua resposta..."
                    className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl min-h-[80px] resize-none focus-visible:ring-violet-500 text-sm"
                    value={valor || ''}
                    onChange={(e) => onChange(e.target.value)}
                />
            )}

            {p.tipo === 'selecao_unica' && Array.isArray(p.opcoes) && (
                <div className="space-y-2">
                    {p.opcoes.map((opt: string, oi: number) => (
                        <label key={oi} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600 cursor-pointer transition-colors has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50/50 dark:has-[:checked]:bg-violet-500/10">
                            <input
                                type="radio"
                                name={`q_${p.id}`}
                                value={opt}
                                checked={valor === opt}
                                onChange={() => onChange(opt)}
                                className="accent-violet-600"
                            />
                            <span className="text-sm text-slate-700 dark:text-slate-300">{opt}</span>
                        </label>
                    ))}
                </div>
            )}

            {p.tipo === 'selecao_multipla' && Array.isArray(p.opcoes) && (
                <div className="space-y-2">
                    {p.opcoes.map((opt: string, oi: number) => {
                        const current = valor || []
                        const isChecked = current.includes(opt)
                        return (
                            <label key={oi} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-violet-300 dark:hover:border-violet-600 cursor-pointer transition-colors has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50/50 dark:has-[:checked]:bg-violet-500/10">
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => onChange(isChecked ? current.filter((v: string) => v !== opt) : [...current, opt])}
                                    className="accent-violet-600"
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300">{opt}</span>
                            </label>
                        )
                    })}
                </div>
            )}

            {p.tipo === 'escala' && (
                <div className="space-y-2">
                    <div className="flex justify-between text-[10px] text-slate-400 px-1">
                        <span>{p.opcoes?.labelMin || '1'}</span>
                        <span>{p.opcoes?.labelMax || '5'}</span>
                    </div>
                    <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map(v => {
                            const criterio = (p.opcoes?.criterios?.[v] || '').trim()
                            return (
                                <div key={v} className={`group relative flex-1 ${criterio ? 'cursor-help' : ''}`}>
                                    <button
                                        type="button"
                                        onClick={() => onChange(v.toString())}
                                        className={`w-full h-11 rounded-xl font-bold text-sm transition-all ${
                                            valor === v.toString()
                                                ? 'bg-violet-600 text-white shadow-lg shadow-violet-500/20'
                                                : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-violet-100 dark:hover:bg-violet-500/10'
                                        }`}
                                    >
                                        {v}
                                    </button>
                                    {/* Critério dessa nota (definido manualmente na pergunta) —
                                        aparece ao passar o mouse/tocar, igual ao padrão já usado
                                        no NPS Projeto. Some sozinho quando não há critério. */}
                                    {criterio && (
                                        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 z-20 hidden group-hover:block group-focus-within:block w-48 bg-slate-900 dark:bg-slate-950 text-white text-[11px] leading-snug rounded-lg px-2.5 py-2 shadow-lg pointer-events-none">
                                            <span className="font-bold">{v} — </span>{criterio}
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                    {/* Critério da nota já escolhida, sempre visível abaixo (não só no
                        hover) — importante em telas de toque, onde não há "passar o mouse". */}
                    {valor && valor !== NAO_AVALIAR && (p.opcoes?.criterios?.[Number(valor)] || '').trim() && (
                        <p className="text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-slate-800 rounded-lg px-3 py-2">
                            <span className="font-bold text-violet-600 dark:text-violet-400">{valor}: </span>
                            {p.opcoes.criterios[Number(valor)]}
                        </p>
                    )}
                    {/* "Não avaliar": para quem não tem insumo para julgar. A
                        resposta não é gravada, então não entra em nenhuma média. */}
                    {p.permite_nao_avaliar && (
                        <button
                            type="button"
                            onClick={() => onChange(valor === NAO_AVALIAR ? '' : NAO_AVALIAR)}
                            className={`w-full h-9 rounded-xl text-xs font-bold transition-all border border-dashed ${
                                valor === NAO_AVALIAR
                                    ? 'bg-slate-700 text-white border-slate-700 dark:bg-slate-600 dark:border-slate-600'
                                    : 'bg-transparent text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-800'
                            }`}
                        >
                            Não avaliar {valor === NAO_AVALIAR ? '(selecionado — não entra na média)' : '— não tenho insumo para avaliar'}
                        </button>
                    )}
                </div>
            )}

            {p.tipo === 'colaborador_unico' && (
                <Select value={valor || ''} onValueChange={(v) => onChange(v)}>
                    <SelectTrigger className="bg-transparent border-slate-200 dark:border-slate-700 rounded-xl h-11 focus:ring-violet-500">
                        <SelectValue placeholder="Selecione um colaborador" />
                    </SelectTrigger>
                    <SelectContent className="bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-xl">
                        {outros.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            )}

            {p.tipo === 'colaborador_multiplo' && (
                <div className="space-y-2 max-h-52 overflow-y-auto custom-scrollbar">
                    {outros.map(c => {
                        const current = valor || []
                        const isChecked = current.includes(c.id)
                        return (
                            <label key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-violet-300 cursor-pointer transition-colors has-[:checked]:border-violet-500 has-[:checked]:bg-violet-50/50 dark:has-[:checked]:bg-violet-500/10">
                                <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => onChange(isChecked ? current.filter((v: string) => v !== c.id) : [...current, c.id])}
                                    className="accent-violet-600"
                                />
                                <span className="text-sm text-slate-700 dark:text-slate-300">{c.nome}</span>
                            </label>
                        )
                    })}
                </div>
            )}

            {p.tipo === 'grade_multipla_escolha' && p.opcoes?.linhas && p.opcoes?.colunas && (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                        <thead>
                            <tr>
                                <th className="p-2 text-left" />
                                {(p.opcoes.colunas as string[]).map((col: string, ci: number) => (
                                    <th key={ci} className="p-2 text-center text-xs font-semibold text-slate-600 dark:text-slate-400">{col}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {(p.opcoes.linhas as string[]).map((linha: string, li: number) => {
                                const respostaGrade = valor || {}
                                return (
                                    <tr key={li} className={li % 2 === 0 ? 'bg-slate-50 dark:bg-slate-800/30' : ''}>
                                        <td className="p-2 text-xs font-medium text-slate-700 dark:text-slate-300 pr-4">{linha}</td>
                                        {(p.opcoes.colunas as string[]).map((col: string, ci: number) => (
                                            <td key={ci} className="p-2 text-center">
                                                <input
                                                    type="radio"
                                                    name={`grade_${p.id}_${li}`}
                                                    value={col}
                                                    checked={respostaGrade[linha] === col}
                                                    onChange={() => onChange({ ...(valor || {}), [linha]: col })}
                                                    className="accent-violet-600"
                                                />
                                            </td>
                                        ))}
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    )
}
