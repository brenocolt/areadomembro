import { isSchemaDesatualizado } from './db-compat'
import { avaliadoPerguntaPorSecao } from './forms-runtime'

// NPS Projetos — Fase B: soma às avaliações do formulário fixo de sempre
// (tabela avaliacoes_nps, escrita por nps-projeto-form.tsx/nps-projeto/page.tsx)
// as respostas de formulários GENÉRICOS marcados com
// formularios.nps_projetos_generico (ver migração
// 20260912_formularios_nps_projetos_generico.sql e o formulário semeado em
// 20260911_nps_projetos_formulario_generico_fase_a.sql).
//
// Em vez de reescrever a lógica de cada consumidor (PIPJ, Performance, NPS
// Gerente, Wallet — mais de dez lugares, cada um com sua própria agregação
// client-side), este módulo devolve linhas SINTÉTICAS no MESMO FORMATO de
// uma linha de avaliacoes_nps — quem consome só precisa buscar as duas
// fontes e concatenar os arrays ANTES de rodar a agregação que já existe,
// sem tocar nela.
//
// Uma resposta do formulário genérico pode ter várias perguntas
// "Selecionar 1 Colaborador" (gerente + até 3 duplas, cada uma numa seção
// — ver avaliadoPerguntaPorSecao), cada uma avaliando uma pessoa diferente.
// Cada uma dessas vira UMA linha sintética própria.
export type AvaliacaoNpsSintetica = {
    colaborador_id: string
    mes: number
    ano: number
    tipo_avaliacao: 'gerente' | 'consultor'
    nps_geral: number
    comunicacao?: number | null
    dedicacao?: number | null
    confianca?: number | null
    pontualidade?: number | null
    organizacao?: number | null
    proatividade?: number | null
    qualidade_entregas?: number | null
    dominio_tecnico?: number | null
    suporte?: number | null
    relacionamento?: number | null
    resolutividade?: number | null
    lideranca?: number | null
    feedback_texto?: string | null
    created_at: string
}

// Nome da competência (ver formulario_perguntas.competencia) -> coluna
// equivalente em avaliacoes_nps, por bloco. "Comunicação" é comum aos dois
// blocos; as demais são exclusivas de um ou de outro, e é isso que permite
// decidir se uma seção é "gerente" ou "consultor" (ver ehConsultor abaixo).
const CAMPOS_GERENTE: Record<string, keyof AvaliacaoNpsSintetica> = {
    'Comunicação': 'comunicacao',
    'Suporte à Execução': 'suporte',
    'Relacionamento com a Equipe': 'relacionamento',
    'Resolutividade': 'resolutividade',
    'Liderança': 'lideranca',
}
const CAMPOS_CONSULTOR: Record<string, keyof AvaliacaoNpsSintetica> = {
    'Comunicação': 'comunicacao',
    'Dedicação': 'dedicacao',
    'Confiança': 'confianca',
    'Pontualidade': 'pontualidade',
    'Organização': 'organizacao',
    'Proatividade': 'proatividade',
    'Qualidade das Entregas': 'qualidade_entregas',
    'Domínio Técnico': 'dominio_tecnico',
}
const CONSULTOR_SO = new Set(['Dedicação', 'Confiança', 'Pontualidade', 'Organização', 'Proatividade', 'Qualidade das Entregas', 'Domínio Técnico'])
const GERENTE_SO = new Set(['Suporte à Execução', 'Relacionamento com a Equipe', 'Resolutividade', 'Liderança'])

export async function getNpsProjetosGenericoFormIds(client: any): Promise<string[]> {
    const { data, error } = await client.from('formularios').select('id').eq('nps_projetos_generico', true)
    if (isSchemaDesatualizado(error)) return []
    return (data || []).map((f: any) => f.id)
}

// `client` pode ser tanto o client do browser (componentes/páginas) quanto
// o supabaseAdmin (rotas de API) — as tabelas lidas aqui têm RLS "Allow all
// for authenticated users", então funcionam com qualquer um dos dois.
//
// `filtro.mes`/`filtro.ano`, se informados, descartam cedo qualquer
// resposta de outro mês (mesmo raciocínio de getNpsInternoMap) — mas o
// filtro real de "de quem" fica por conta de quem chama, depois de juntar
// com as linhas de avaliacoes_nps.
export async function getAvaliacoesNpsGenericoSinteticas(
    client: any,
    filtro?: { mes?: number, ano?: number },
): Promise<AvaliacaoNpsSintetica[]> {
    const formIds = await getNpsProjetosGenericoFormIds(client)
    if (formIds.length === 0) return []

    const { data: perguntasRows } = await client
        .from('formulario_perguntas')
        .select('id, formulario_id, tipo, competencia, ordem')
    const todasPerguntas = (perguntasRows || []) as { id: string, formulario_id: string, tipo: string, competencia?: string | null, ordem?: number }[]
    const perguntas = todasPerguntas.filter(p => formIds.includes(p.formulario_id))

    const perguntasPorForm = new Map<string, typeof perguntas>()
    for (const p of perguntas) {
        const arr = perguntasPorForm.get(p.formulario_id) || []
        arr.push(p)
        perguntasPorForm.set(p.formulario_id, arr)
    }
    const avaliadoPorFormPergunta = new Map<string, Map<string, string>>()
    for (const [formId, ps] of perguntasPorForm.entries()) {
        const ordenadas = [...ps].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
        avaliadoPorFormPergunta.set(formId, avaliadoPerguntaPorSecao(ordenadas))
    }

    const comAlvo = await client
        .from('formulario_respostas')
        .select('id, formulario_id, enviado_em, formulario_respostas_itens(pergunta_id, valor)')
        .in('formulario_id', formIds)
    if (isSchemaDesatualizado(comAlvo.error)) return []
    const respostas = (comAlvo.data || []) as { id: string, formulario_id: string, enviado_em: string, formulario_respostas_itens?: { pergunta_id: string, valor: string | null }[] }[]

    const resultado: AvaliacaoNpsSintetica[] = []
    for (const r of respostas) {
        const d = new Date(r.enviado_em)
        const mes = d.getMonth() + 1
        const ano = d.getFullYear()
        if (filtro?.mes && mes !== filtro.mes) continue
        if (filtro?.ano && ano !== filtro.ano) continue

        const avaliadoMap = avaliadoPorFormPergunta.get(r.formulario_id) || new Map<string, string>()
        const perguntasDoForm = perguntasPorForm.get(r.formulario_id) || []
        const itens = r.formulario_respostas_itens || []
        const colaboradorUnicoIds = new Set(avaliadoMap.values())

        for (const cuId of colaboradorUnicoIds) {
            const avaliadoItem = itens.find(it => it.pergunta_id === cuId)
            const colaboradorId = avaliadoItem?.valor
            if (!colaboradorId) continue

            // Perguntas de escala com competência definida, atribuídas a
            // ESTE colaborador_unico (ver avaliadoPerguntaPorSecao).
            const escalasDoAlvo = perguntasDoForm.filter(p => p.tipo === 'escala' && p.competencia && avaliadoMap.get(p.id) === cuId)
            const labels = new Set(escalasDoAlvo.map(p => p.competencia as string))
            const ehConsultor = [...labels].some(l => CONSULTOR_SO.has(l))
            const ehGerente = !ehConsultor && [...labels].some(l => GERENTE_SO.has(l))
            // Sem nenhum campo distintivo (só "Comunicação", por exemplo) —
            // ambíguo demais pra classificar; ignora essa seção.
            if (!ehConsultor && !ehGerente) continue
            const mapaCampos = ehConsultor ? CAMPOS_CONSULTOR : CAMPOS_GERENTE

            const linha: Partial<AvaliacaoNpsSintetica> = {
                colaborador_id: colaboradorId,
                mes, ano,
                tipo_avaliacao: ehConsultor ? 'consultor' : 'gerente',
                created_at: r.enviado_em,
            }
            const valores: number[] = []
            for (const ep of escalasDoAlvo) {
                const campo = mapaCampos[ep.competencia as string]
                if (!campo) continue
                const it = itens.find(i => i.pergunta_id === ep.id)
                const v = Number(it?.valor)
                if (it && !isNaN(v)) {
                    ; (linha as any)[campo] = v
                    valores.push(v)
                }
            }
            if (valores.length === 0) continue
            linha.nps_geral = valores.reduce((a, b) => a + b, 0) / valores.length

            // Texto livre da mesma seção (feedback qualitativo), se houver.
            const textoPerguntaId = perguntasDoForm.find(p =>
                (p.tipo === 'texto') && avaliadoMap.get(p.id) === cuId
            )?.id
            if (textoPerguntaId) {
                const it = itens.find(i => i.pergunta_id === textoPerguntaId)
                if (it?.valor) linha.feedback_texto = it.valor
            }

            resultado.push(linha as AvaliacaoNpsSintetica)
        }
    }
    return resultado
}
