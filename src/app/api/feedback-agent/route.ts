import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { auth } from '@/auth'
import Anthropic from '@anthropic-ai/sdk'
import { mesReferenciaFromDate } from '@/lib/nps-period'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'
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
        .slice(-6) // apenas os 6 meses mais recentes
        .map(b => ({
            mes: b.label,
            avaliacoes: b.n,
            metricas: Object.fromEntries(
                Object.entries(b.metricas).map(([k, v]) => [k, Number((v.soma / v.n).toFixed(1))])
            ),
            // comentários por mês: o material qualitativo é o que importa, então mantemos boa parte do texto
            comentarios: b.feedbacks.filter(Boolean).slice(0, 10).map(c => c.slice(0, 500)),
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
            if (!mes || !ano) { const ref = mesReferenciaFromDate(r.created_at); mes = ref.mes; ano = ref.ano }
            const b = ensureBucket(externoMap, ano, mes)
            b.n++
            externoTotal++
            const labels = r.tipo_avaliacao === 'gerente' ? LABELS_GERENTE : LABELS_CONSULTOR
            for (const [field, label] of Object.entries(labels)) {
                if ((r as any)[field] != null) addMetric(b, label, Number((r as any)[field]))
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
                    const ref = mesReferenciaFromDate(r.enviado_em)
                    const b = ensureBucket(internoMap, ref.ano, ref.mes)
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

        const systemPrompt = `Você é o Agente de Feedback da Produtiva Júnior. Sua missão é ler as avaliações internas recebidas por um membro e devolver um feedback qualitativo, humano e construtivo — como um mentor que leu com atenção o que os colegas escreveram, não como um relatório estatístico.

CONTEXTO IMPORTANTE: estas avaliações são INTERNAS — feitas por OUTROS MEMBROS da própria empresa (colegas do mesmo núcleo e/ou pessoas que atuaram nos mesmos projetos, incluindo gerentes). NÃO são avaliações de clientes externos. Nunca se refira a "clientes", "consumidores" ou "público externo": trate sempre como feedback de colegas de trabalho e da equipe interna.

FOCO QUALITATIVO (regra principal): construa o feedback principalmente a partir dos COMENTÁRIOS escritos pelos avaliadores — é ali que está o conteúdo real sobre o que a pessoa faz bem e o que pode melhorar. Leia os comentários, identifique temas e padrões recorrentes, e narre isso em linguagem natural e específica. As notas/métricas numéricas são apoio, não o centro: use-as apenas para confirmar uma tendência ou situar um ponto de atenção (ex.: "isso é reforçado pela nota consistentemente mais baixa em X"). NÃO liste notas mês a mês, NÃO faça tabelas de números, NÃO transforme a análise numa auditoria de métricas.

Estrutura sugerida (markdown, adapte se os dados pedirem):
## Visão geral — como a pessoa tem sido percebida pelos colegas, em poucas frases, com um tom qualitativo.
## Pontos fortes — o que os comentários mostram que a pessoa faz bem, com temas/exemplos citados (não apenas "nota alta em X").
## Pontos de melhoria — os temas de melhoria que aparecem nos comentários, com contexto e exemplos, não só "nota baixa em X".
## Evolução — só inclua se houver comentários/notas de 2+ meses distintos; comente como a percepção mudou.
## Recomendações — 2 a 4 ações concretas, realistas e conectadas aos temas que apareceram nos comentários.

Regras: baseie-se apenas nos dados fornecidos, nunca invente comentários ou fatos; se não houver comentários suficientes, seja honesto sobre isso em vez de inflar a análise com números; responda perguntas de acompanhamento mantendo o mesmo tom qualitativo e os mesmos dados.

Colaborador: ${alvo?.nome || 'Desconhecido'} | Cargo: ${alvo?.cargo_atual || '—'}
${semDados ? 'Sem avaliações registradas.' : JSON.stringify(dados)}`

        const anthropic = new Anthropic({ apiKey })

        // Se for a primeira interação (sem mensagens), gera o feedback automático.
        const convo = messages.length > 0
            ? messages
            : [{ role: 'user' as const, content: semDados
                ? 'Não há avaliações registradas. Explique isso de forma gentil.'
                : 'Gere o feedback completo com base nas minhas avaliações recebidas.' }]

        const resp = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 3000,
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
