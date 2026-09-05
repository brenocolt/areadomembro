// Lógica de execução de um formulário (seções, lógica condicional,
// validação) compartilhada entre a tela em que o membro responde
// (src/app/(dashboard)/formularios) e a simulação de resposta dentro de
// Gestão de Formulários — assim o teste reflete exatamente o que o membro vê.

export interface FormSection {
    id: string | null
    titulo: string
    descricao: string
    perguntas: any[]
}

// Valor sentinela de uma pergunta de escala marcada como "Não avaliar"
// (habilitada por formulario_perguntas.permite_nao_avaliar). Satisfaz a
// obrigatoriedade da pergunta, mas NÃO é gravado no banco — logo não entra
// em nenhuma média nem contagem de avaliações.
export const NAO_AVALIAR = '__nao_avaliar__'

// Extrai o texto puro de um campo rich-text (negrito/itálico gravados como
// HTML simples, ver RichTextInput) — usado sempre que o valor vai virar um
// rótulo curto (nome de competência, métrica pro Assistente/Agente de
// Feedback) em vez de ser exibido como rich text de verdade. Insere um
// espaço no lugar de cada tag para não colar as palavras dos dois lados.
export function stripHtml(html: string | null | undefined): string {
    return (html || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

// Nome exibido de uma pergunta de escala nas visualizações de competência
// (sub-abas de Performance): usa a competência quando definida, senão cai de
// volta no título da pergunta (sempre como texto puro — "competência" é um
// rótulo curto, não rich text).
export function competenciaLabel(pergunta: { competencia?: string | null, titulo?: string | null }): string {
    const c = (pergunta.competencia || '').trim()
    return c || stripHtml(pergunta.titulo) || 'Sem título'
}

// Resolve, pra cada pergunta "normal" (escala, texto etc.), qual pergunta
// "Selecionar 1 Colaborador" (colaborador_unico) da MESMA SEÇÃO identifica
// quem ela avalia. A maioria dos formulários com colaborador_unico tem só
// UMA dessas perguntas (a resposta inteira é sobre uma pessoa só) — mas um
// formulário pode ter várias, uma por seção (ex.: um NPS Projetos único:
// "quem é o gerente" numa seção, "quem é a dupla" noutra) avaliando pessoas
// DIFERENTES na MESMA resposta. Sem essa resolução por seção, todo mundo
// que lê "sobre quem é esta resposta" atribuiria (ou perderia) notas entre
// as pessoas avaliadas.
//
// Formulário com só um colaborador_unico (o caso de hoje) continua se
// comportando exatamente igual: todas as perguntas caem na mesma seção
// "efetiva" e viram atribuídas a esse único alvo.
//
// Espera as perguntas já na ordem do formulário (campo `ordem`) — aceita
// tanto a lista de um formulário só quanto perguntas de vários formulários
// concatenadas, desde que cada formulário mantenha sua sequência interna
// intacta (uma pergunta 'secao' sempre fecha o que vinha antes dela).
export function avaliadoPerguntaPorSecao(perguntas: { id: string, tipo: string }[]): Map<string, string> {
    const resultado = new Map<string, string>()
    let avaliadoId: string | null = null
    let pendentes: string[] = []
    const flush = () => {
        if (avaliadoId) {
            for (const pid of pendentes) resultado.set(pid, avaliadoId)
        }
        avaliadoId = null
        pendentes = []
    }
    for (const p of perguntas) {
        if (p.tipo === 'secao') { flush(); continue }
        if (p.tipo === 'colaborador_unico') { avaliadoId = p.id; continue }
        if (p.tipo === 'titulo') continue // cabeçalho decorativo, não é resposta
        pendentes.push(p.id)
    }
    flush()
    return resultado
}

// Agrupa a lista linear de perguntas em "seções" — cada pergunta do tipo
// 'secao' inicia uma seção nova (ela mesma vira o cabeçalho, não entra na
// lista de perguntas da seção). Perguntas antes da primeira 'secao' formam
// uma seção inicial implícita (sem cabeçalho); formulários sem nenhuma
// 'secao' resultam em uma única seção com tudo — comportamento idêntico ao
// de antes da navegação por seções existir.
export function buildSections(perguntas: any[]): FormSection[] {
    const sections: FormSection[] = []
    let current: FormSection = { id: null, titulo: '', descricao: '', perguntas: [] }
    for (const p of perguntas) {
        if (p.tipo === 'secao') {
            sections.push(current)
            current = { id: p.id, titulo: p.titulo || '', descricao: p.descricao || '', perguntas: [] }
        } else {
            current.perguntas.push(p)
        }
    }
    sections.push(current)
    return sections.filter((s, i) => !(i === 0 && s.id === null && s.perguntas.length === 0 && sections.length > 1))
}

// Resolve o alvo da lógica condicional configurado na primeira pergunta de
// seleção única respondida (dentro da seção atual) que tiver uma regra para
// a opção escolhida. Sem lógica configurada/respondida, segue a sequência.
export function resolveNextTarget(section: FormSection, respostas: Record<string, any>): string {
    for (const p of section.perguntas) {
        if (p.tipo !== 'selecao_unica' || !p.logica_condicional) continue
        const resposta = respostas[p.id]
        if (!resposta) continue
        const optionIndex = (p.opcoes || []).indexOf(resposta)
        if (optionIndex === -1) continue
        const target = p.logica_condicional[optionIndex]
        if (target) return target
    }
    return 'continuar'
}

export function computeNext(
    sections: FormSection[], currentIndex: number, respostas: Record<string, any>
): { type: 'submit' } | { type: 'section', index: number } {
    const target = resolveNextTarget(sections[currentIndex], respostas)
    if (target === 'enviar') return { type: 'submit' }
    if (target !== 'continuar') {
        const idx = sections.findIndex(s => s.id === target)
        if (idx !== -1) return { type: 'section', index: idx }
        // Alvo inválido (ex: seção foi excluída depois) — cai no padrão abaixo.
    }
    return currentIndex + 1 < sections.length ? { type: 'section', index: currentIndex + 1 } : { type: 'submit' }
}

export function validateSection(section: FormSection, respostas: Record<string, any>): string | null {
    for (const p of section.perguntas) {
        if (p.tipo === 'titulo' || !p.obrigatoria) continue
        if (p.tipo === 'grade_multipla_escolha') {
            const linhas: string[] = p.opcoes?.linhas || []
            const respostaGrade = respostas[p.id] || {}
            const allAnswered = linhas.every((l: string) => respostaGrade[l])
            if (!allAnswered) return `Pergunta obrigatória não respondida: "${p.titulo}" — responda todas as linhas`
        } else {
            const val = respostas[p.id]
            // "Não avaliar" conta como respondida: a pessoa declarou que não
            // tem insumo, o que é diferente de ter deixado em branco.
            if (!val || (typeof val === 'string' && val.trim() === '') || (Array.isArray(val) && val.length === 0)) {
                return `Pergunta obrigatória não respondida: "${p.titulo}"`
            }
        }
    }
    return null
}

// Monta as linhas de formulario_respostas_itens de um envio. Perguntas
// marcadas como "Não avaliar" e perguntas sem resposta ficam de fora.
export function buildRespostaItens(respostaId: string, perguntas: any[], respostas: Record<string, any>) {
    return perguntas.map(p => {
        const val = respostas[p.id]
        if (val === NAO_AVALIAR) return null
        if (p.tipo === 'grade_multipla_escolha') {
            return {
                resposta_id: respostaId,
                pergunta_id: p.id,
                valor: val ? JSON.stringify(val) : null,
                valores: null,
            }
        }
        const isMulti = Array.isArray(val)
        return {
            resposta_id: respostaId,
            pergunta_id: p.id,
            valor: isMulti ? null : (val?.toString() || null),
            valores: isMulti ? val : null,
        }
    }).filter((item): item is NonNullable<typeof item> =>
        item !== null && (!!item.valor || (Array.isArray(item.valores) && item.valores.length > 0))
    )
}
