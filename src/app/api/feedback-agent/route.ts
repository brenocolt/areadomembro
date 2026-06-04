import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { auth } from '@/auth'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest'
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

// Rótulos amigáveis das métricas do NPS Externo/Projeto
const LABELS_CONSULTOR: Record<string, string> = {
    comunicacao: 'Comunicação',
    dedicacao: 'Dedicação',
    confianca: 'Confiança',
    pontualidade: 'Pontualidade',
    organizacao: 'Organização',
    proatividade: 'Proatividade',
    qualidade_entregas: 'Qualidade das Entregas',
    dominio_tecnico: 'Domínio Técnico',
}
const LABELS_GERENTE: Record<string, string> = {
    comunicacao: 'Comunicação',
    suporte: 'Suporte',
    relacionamento: 'Relacionamento',
    resolutividade: 'Resolutividade',
    lideranca: 'Liderança',
}

type MonthBucket = {
    key: string
    label: string
    metricas: Record<string, { soma: number; n: number }>
    feedbacks: string[]
    n: number
}

function ensureBucket(map: Map<string, MonthBucket>, ano: number, mes: number) {
    const key = `${ano}-${String(mes).padStart(2, '0')}`
    if (!map.has(key)) {
        map.set(key, { key, label: `${MESES[mes - 1]}/${ano}`, metricas: {}, feedbacks: [], n: 0 })
    }
    return map.get(key)!
}

function addMetric(bucket: MonthBucket, label: string, valor: number) {
    if (isNaN(valor)) return
    if (!bucket.metricas[label]) bucket.metricas[label] = { soma: 0, n: 0 }
    bucket.metricas[label].soma += valor
    bucket.metricas[label].n++
}

function bucketsToObject(map: Map<string, MonthBucket>) {
    return Array.from(map.values())
        .sort((a, b) => a.key.localeCompare(b.key))
        .map(b => ({
            mes: b.label,
            avaliacoes: b.n,
            metricas: Object.fromEntries(
                Object.entries(b.metricas).map(([k, v]) => [k, Number((v.soma / v.n).toFixed(2))])
            ),
            comentarios: b.feedbacks.filter(Boolean),
        }))
}

async function gatherEvaluations(targetId: string) {
    const supabase = createServerSupabaseClient()

    // ── NPS Externo / Projeto (avaliacoes_nps) ──────────────────────────────
    const externoMap = new Map<string, MonthBucket>()
    let externoTotal = 0
    try {
        const { data } = await supabase
            .from('avaliacoes_nps')
            .select('mes, ano, comunicacao, dedicacao, confianca, pontualidade, organizacao, proatividade, qualidade_entregas, dominio_tecnico, suporte, relacionamento, resolutividade, lideranca, nps_geral, feedback_texto, tipo_avaliacao, created_at')
            .eq('colaborador_id', targetId)
        for (const r of data || []) {
            // mês de referência da avaliação; cai para created_at se faltar
            let mes = Number(r.mes), ano = Number(r.ano)
            if (!mes || !ano) { const d = new Date(r.created_at); mes = d.getMonth() + 1; ano = d.getFullYear() }
            const b = ensureBucket(externoMap, ano, mes)
            b.n++
            externoTotal++
            const labels = r.tipo_avaliacao === 'gerente' ? LABELS_GERENTE : LABELS_CONSULTOR
            for (const [field, label] of Object.entries(labels)) {
                if (r[field] != null) addMetric(b, label, Number(r[field]))
            }
            if (r.feedback_texto && String(r.feedback_texto).trim()) b.feedbacks.push(String(r.feedback_texto).trim())
        }
    } catch (e) { /* fonte opcional */ }

    // ── NPS Interno (formulário "Piloto de Elite") ──────────────────────────
    const internoMap = new Map<string, MonthBucket>()
    let internoTotal = 0
    try {
        const { data: forms } = await supabase
            .from('formularios')
            .select('id, titulo')
            .or('titulo.ilike.%piloto%,titulo.ilike.%elite%')
        const form = (forms || [])[0]
        if (form) {
            const { data: perguntas } = await supabase
                .from('formulario_perguntas')
                .select('id, tipo, titulo, ordem')
                .eq('formulario_id', form.id)
                .order('ordem', { ascending: true })
            const avaliadoPergunta = (perguntas || []).find(p => p.tipo === 'colaborador_unico')
            const escalaPerguntas = (perguntas || []).filter(p => p.tipo === 'escala')
            const textoPerguntas = (perguntas || []).filter(p => p.tipo === 'texto' || p.tipo === 'texto_longo' || p.tipo === 'paragrafo')

            if (avaliadoPergunta) {
                const { data: respostas } = await supabase
                    .from('formulario_respostas')
                    .select('id, enviado_em, formulario_respostas_itens(pergunta_id, valor, valores)')
                    .eq('formulario_id', form.id)
                for (const r of respostas || []) {
                    const items = (r as any).formulario_respostas_itens || []
                    const avaliadoItem = items.find((it: any) => it.pergunta_id === avaliadoPergunta.id)
                    if (!avaliadoItem || avaliadoItem.valor !== targetId) continue
                    const d = new Date(r.enviado_em)
                    const b = ensureBucket(internoMap, d.getFullYear(), d.getMonth() + 1)
                    b.n++
                    internoTotal++
                    for (const ep of escalaPerguntas) {
                        const it = items.find((i: any) => i.pergunta_id === ep.id)
                        const v = Number(it?.valor)
                        if (it && !isNaN(v)) addMetric(b, ep.titulo, v)
                    }
                    for (const tp of textoPerguntas) {
                        const it = items.find((i: any) => i.pergunta_id === tp.id)
                        if (it?.valor && String(it.valor).trim()) b.feedbacks.push(String(it.valor).trim())
                    }
                }
            }
        }
    } catch (e) { /* fonte opcional */ }

    return {
        npsExterno: { total: externoTotal, porMes: bucketsToObject(externoMap) },
        npsInterno: { total: internoTotal, porMes: bucketsToObject(internoMap) },
    }
}

export async function POST(request: Request) {
    try {
        const session = await auth()
        if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

        const apiKey = process.env.ANTHROPIC_API_KEY
        if (!apiKey) {
            return NextResponse.json({ error: 'IA não configurada: defina ANTHROPIC_API_KEY no .env do servidor.' }, { status: 500 })
        }

        const body = await request.json().catch(() => ({}))
        const messages: { role: 'user' | 'assistant'; content: string }[] = Array.isArray(body.messages) ? body.messages : []
        const requestedId: string | undefined = body.colaboradorId

        const role = (session.user as any).role
        const ownId = (session.user as any).colaborador_id
        const isAdmin = role === 'ADMIN' || role === 'admin'

        // Autorização: admin/gerente podem escolher; demais só veem o próprio.
        let targetId = ownId
        const supabase = createServerSupabaseClient()
        let isGerente = false
        if (ownId) {
            const { data: me } = await supabase.from('colaboradores').select('cargo_atual').eq('id', ownId).single()
            isGerente = (me?.cargo_atual || '').toLowerCase().includes('gerente')
        }
        if (requestedId && (isAdmin || isGerente)) targetId = requestedId
        if (!targetId) return NextResponse.json({ error: 'Colaborador não identificado.' }, { status: 400 })

        const { data: alvo } = await supabase.from('colaboradores').select('nome, cargo_atual').eq('id', targetId).single()
        const dados = await gatherEvaluations(targetId)

        const semDados = dados.npsExterno.total === 0 && dados.npsInterno.total === 0

        const systemPrompt = `Você é o "Agente de Feedback" da Produtiva Júnior, um analista de desenvolvimento de pessoas. Sua função é analisar as avaliações de NPS que um colaborador RECEBEU e produzir um feedback construtivo, honesto e acionável, em português do Brasil.

Diretrizes:
- Analise TANTO as notas (escala 1 a 5) QUANTO os comentários em texto das avaliações.
- Estruture a resposta em seções claras com títulos em markdown:
  1. "## Visão geral" — resumo curto do desempenho.
  2. "## Pontos fortes" — o que se destaca (com as métricas/notas que sustentam).
  3. "## Pontos de melhoria" — DÊ ÊNFASE AQUI; seja específico e prático, citando notas e trechos de comentários quando houver.
  4. "## Evolução ao longo dos meses" — compare meses consecutivos e destaque o que MELHOROU ou PIOROU. Ex.: "No mês anterior a Comunicação era um ponto fraco (3,2), mas neste mês melhorou (4,1)". Só afirme evolução quando houver dados de mais de um mês.
  5. "## Recomendações" — 3 a 5 ações concretas.
- Seja respeitoso e motivador, mas não esconda os pontos de melhoria.
- Use as notas com 1 casa decimal. Não invente dados que não estão no JSON.
- Quando o usuário fizer perguntas de acompanhamento, responda com base nos mesmos dados.

Dados do colaborador avaliado (nome: ${alvo?.nome || 'Desconhecido'}, cargo: ${alvo?.cargo_atual || '—'}):
${semDados ? 'NÃO há avaliações registradas para este colaborador.' : JSON.stringify(dados, null, 2)}`

        const anthropic = new Anthropic({ apiKey })

        // Se for a primeira interação (sem mensagens), gera o feedback automático.
        const convo = messages.length > 0
            ? messages
            : [{ role: 'user' as const, content: semDados
                ? 'Não há avaliações registradas. Explique isso de forma gentil.'
                : 'Gere o feedback completo com base nas minhas avaliações recebidas.' }]

        const resp = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 2000,
            system: systemPrompt,
            messages: convo,
        })

        const text = resp.content
            .filter((c: any) => c.type === 'text')
            .map((c: any) => c.text)
            .join('\n')

        return NextResponse.json({ text, colaborador: alvo?.nome || null })
    } catch (err: any) {
        console.error('feedback-agent error:', err)
        const msg = err?.error?.error?.message || err?.message || 'Erro ao gerar feedback.'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
