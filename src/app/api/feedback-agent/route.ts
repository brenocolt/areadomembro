import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { auth } from '@/auth'
import Anthropic from '@anthropic-ai/sdk'
import { mesReferenciaFromDate, janelaEnvioDaReferencia, janelaEnvioUltimosMeses } from '@/lib/nps-period'
import { buscarTodasPaginas } from '@/lib/paginacao'
import { isCargoGerencial, isCargoAssessorGP } from '@/lib/cargos'
import { getRespostasFormulariosSobreColaborador, getRespostasFormulariosGeral } from '@/lib/forms-avaliacoes-membro'
import { stripHtml } from '@/lib/forms-runtime'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'
// Quantos meses (de referência) o agente recebe por fonte — ver bucketsToObject.
const MESES_RECENTES = 6
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
        .slice(-MESES_RECENTES) // apenas os meses mais recentes
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

type Filtro = { mes?: number; ano?: number }

// `targetId` ausente = modo geral: agrega TODA a empresa em vez de uma
// pessoa só (ver getRespostasFormulariosGeral). `filtro` restringe a um mês
// e/ou ano específico (mês de referência — o mesmo usado no resto do
// sistema, ver mesReferenciaFromDate), pra quem quiser olhar só um período.
async function gatherEvaluations(targetId: string | undefined, filtro?: Filtro) {
    const supabase = createServerSupabaseClient()

    // ── NPS Externo / Projeto (avaliacoes_nps) ──────────────────────────────
    const externoMap = new Map<string, MonthBucket>()
    let externoTotal = 0
    try {
        // Em páginas (a API corta em 1000 linhas) e, com filtro, só o período.
        const { data } = await buscarTodasPaginas<any>((de, ate) => {
            let query = supabase
                .from('avaliacoes_nps')
                .select('id, mes, ano, comunicacao, dedicacao, confianca, pontualidade, organizacao, proatividade, qualidade_entregas, dominio_tecnico, suporte, relacionamento, resolutividade, lideranca, nps_geral, feedback_texto, tipo_avaliacao, created_at')
            if (targetId) query = query.eq('colaborador_id', targetId)
            if (filtro?.mes) query = query.eq('mes', filtro.mes)
            if (filtro?.ano) query = query.eq('ano', filtro.ano)
            return query.order('created_at').order('id').range(de, ate)
        })
        for (const r of data) {
            // mês de referência da avaliação; cai para created_at se faltar
            let mes = Number(r.mes), ano = Number(r.ano)
            if (!mes || !ano) { const ref = mesReferenciaFromDate(r.created_at); mes = ref.mes; ano = ref.ano }
            if (filtro?.mes && mes !== filtro.mes) continue
            if (filtro?.ano && ano !== filtro.ano) continue
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

    // ── Avaliações recebidas em formulários ─────────────────────────────────
    // Com targetId: só as respostas em que o AVALIADO é ele (direcionado via
    // Quem Recebe, ou com uma pergunta "Selecionar 1 Colaborador"). Sem
    // targetId (modo geral): as respostas de TODOS os formulários, agregadas
    // por Tipo de Formulário (a "pasta" em Gestão de Formulários) — o agente
    // enxerga a empresa inteira, sem estar preso a uma pessoa. No modo geral
    // o banco devolve só o período usado: o do filtro ou, sem filtro, os
    // últimos meses que o agente recebe (bucketsToObject).
    const formulariosMap = new Map<string, Map<string, MonthBucket>>()
    let formulariosTotal = 0
    try {
        const respostas = targetId
            ? await getRespostasFormulariosSobreColaborador(supabase, targetId)
            : await getRespostasFormulariosGeral(supabase, filtro ? janelaEnvioDaReferencia(filtro) : janelaEnvioUltimosMeses(MESES_RECENTES))
        for (const r of respostas) {
            const escalaPerguntas = r.perguntas.filter(p => p.tipo === 'escala')
            const textoPerguntas = r.perguntas.filter(p => p.tipo === 'texto' || p.tipo === 'texto_longo' || p.tipo === 'paragrafo')
            const tipo = r.tipoFormulario || 'Formulário'
            const ref = mesReferenciaFromDate(r.enviado_em)
            if (filtro?.mes && ref.mes !== filtro.mes) continue
            if (filtro?.ano && ref.ano !== filtro.ano) continue
            if (!formulariosMap.has(tipo)) formulariosMap.set(tipo, new Map())
            const b = ensureBucket(formulariosMap.get(tipo)!, ref.ano, ref.mes)
            b.n++
            formulariosTotal++
            for (const ep of escalaPerguntas) {
                const it = r.itens.find(i => i.pergunta_id === ep.id)
                const v = Number(it?.valor)
                if (it && !isNaN(v)) addMetric(b, ep.competencia?.trim() || stripHtml(ep.titulo), v)
            }
            for (const tp of textoPerguntas) {
                const it = r.itens.find(i => i.pergunta_id === tp.id)
                if (it?.valor && String(it.valor).trim()) b.feedbacks.push(String(it.valor).trim())
            }
        }
    } catch (e) { /* fonte opcional */ }
    const avaliacoesFormularios = Object.fromEntries(
        Array.from(formulariosMap.entries()).map(([tipo, map]) => [tipo, { porMes: bucketsToObject(map) }])
    )

    return {
        npsExterno: { total: externoTotal, porMes: bucketsToObject(externoMap) },
        avaliacoesFormularios: { total: formulariosTotal, porTipo: avaliacoesFormularios },
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
        const mesFiltro = Number(body.mes) || undefined
        const anoFiltro = Number(body.ano) || undefined
        const filtro: Filtro | undefined = (mesFiltro || anoFiltro) ? { mes: mesFiltro, ano: anoFiltro } : undefined

        const role = (session.user as any).role
        const ownId = (session.user as any).colaborador_id
        const isAdmin = role === 'ADMIN' || role === 'admin'

        // Autorização: admin/gerente e assessores de Gestão de Pessoas podem
        // escolher (ou deixar em branco = modo geral); demais só veem o próprio.
        const supabase = createServerSupabaseClient()
        let isGerente = false
        let isAssessorGP = false
        if (ownId) {
            const { data: me } = await supabase.from('colaboradores').select('cargo_atual, nucleo_atual').eq('id', ownId).single()
            isGerente = isCargoGerencial(me?.cargo_atual, me?.nucleo_atual)
            isAssessorGP = isCargoAssessorGP(me?.cargo_atual, me?.nucleo_atual)
        }
        const canChoose = isAdmin || isGerente || isAssessorGP

        // targetId indefinido = MODO GERAL (só possível pra quem pode
        // escolher — sem isso, ninguém "esquece" de selecionar a si mesmo).
        let targetId: string | undefined
        if (canChoose) {
            targetId = requestedId || undefined
        } else {
            targetId = ownId
        }
        if (!targetId && !canChoose) return NextResponse.json({ error: 'Colaborador não identificado.' }, { status: 400 })

        const alvo = targetId ? (await supabase.from('colaboradores').select('nome, cargo_atual').eq('id', targetId).single()).data : null
        const dados = await gatherEvaluations(targetId, filtro)

        const semDados = dados.npsExterno.total === 0 && dados.avaliacoesFormularios.total === 0
        const periodoLabel = filtro
            ? `${filtro.mes ? MESES[filtro.mes - 1] : 'todos os meses'}${filtro.ano ? ` de ${filtro.ano}` : ''}`
            : `os ${MESES_RECENTES} meses mais recentes com avaliações`

        const systemPrompt = targetId
            ? `Você é o Agente de Feedback da Produtiva Júnior. Sua missão é ler as avaliações internas recebidas por um membro e devolver um feedback qualitativo, humano e construtivo — como um mentor que leu com atenção o que os colegas escreveram, não como um relatório estatístico.

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
Período considerado: ${periodoLabel}
${semDados ? 'Sem avaliações registradas neste período.' : JSON.stringify(dados)}`
            : `Você é o Agente de Feedback da Produtiva Júnior, funcionando agora em MODO GERAL: ainda não foi escolhido nenhum colaborador específico. Nesse modo você é um assistente de IA comum, mas com acesso completo aos dados de avaliações e respostas qualitativas de TODA a empresa (agregados por tipo de formulário e por mês — não presos a uma pessoa só). Use isso para ajudar com pedidos gerais: um resumo do clima/qualidade das avaliações internas, os temas que mais aparecem nos comentários captados nos formulários, ajuda para redigir ou estruturar um texto de feedback, ou qualquer outra dúvida sobre esses dados.

Se o usuário quiser o feedback de UMA pessoa específica, oriente-o a selecioná-la no menu "Selecione o colaborador" no topo da tela — você não tem (e não deve inventar) o detalhamento individual de ninguém neste modo, só os agregados da empresa.

CONTEXTO: os dados abaixo são agregados por Tipo de Formulário e por mês, cobrindo TODA a empresa.
Período considerado: ${periodoLabel}
${semDados ? 'Sem avaliações registradas neste período.' : JSON.stringify(dados)}`

        const anthropic = new Anthropic({ apiKey })

        // Se for a primeira interação (sem mensagens), gera o feedback automático.
        const convo = messages.length > 0
            ? messages
            : [{ role: 'user' as const, content: targetId
                ? (semDados ? 'Não há avaliações registradas. Explique isso de forma gentil.' : 'Gere o feedback completo com base nas minhas avaliações recebidas.')
                : 'Faça um resumo geral do clima e das avaliações qualitativas mais recentes da empresa.' }]

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
