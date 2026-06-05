import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { auth } from '@/auth'
import Anthropic from '@anthropic-ai/sdk'

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001'
const MESES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

// Rótulos amigáveis das métricas de NPS
const LABELS_CONSULTOR: Record<string, string> = {
    comunicacao: 'Comunicação', dedicacao: 'Dedicação', confianca: 'Confiança',
    pontualidade: 'Pontualidade', organizacao: 'Organização', proatividade: 'Proatividade',
    qualidade_entregas: 'Qualidade das Entregas', dominio_tecnico: 'Domínio Técnico',
}
const LABELS_GERENTE: Record<string, string> = {
    comunicacao: 'Comunicação', suporte: 'Suporte', relacionamento: 'Relacionamento',
    resolutividade: 'Resolutividade', lideranca: 'Liderança',
}

// ──────────────────────────────────────────────────────────── NPS (agregado + anônimo)
type MonthBucket = { key: string; label: string; metricas: Record<string, { soma: number; n: number }>; feedbacks: string[]; n: number }

function ensureBucket(map: Map<string, MonthBucket>, ano: number, mes: number) {
    const key = `${ano}-${String(mes).padStart(2, '0')}`
    if (!map.has(key)) map.set(key, { key, label: `${MESES[mes - 1]}/${ano}`, metricas: {}, feedbacks: [], n: 0 })
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
        .slice(-4) // últimos 4 meses para o assistente
        .map(b => ({
            mes: b.label,
            avaliacoes: b.n,
            metricas: Object.fromEntries(Object.entries(b.metricas).map(([k, v]) => [k, Number((v.soma / v.n).toFixed(1))])),
            // máx 4 comentários por mês, cada um até 200 chars — serão SEMPRE parafraseados pelo modelo
            comentarios: b.feedbacks.filter(Boolean).slice(0, 4).map(c => c.slice(0, 200)),
        }))
}

async function gatherNps(supabase: ReturnType<typeof createServerSupabaseClient>, ownId: string) {
    // ── NPS Externo / Projeto (avaliacoes_nps) — o usuário é o AVALIADO ──────
    const externoMap = new Map<string, MonthBucket>()
    let externoTotal = 0
    try {
        const { data } = await supabase
            .from('avaliacoes_nps')
            .select('mes, ano, comunicacao, dedicacao, confianca, pontualidade, organizacao, proatividade, qualidade_entregas, dominio_tecnico, suporte, relacionamento, resolutividade, lideranca, nps_geral, feedback_texto, tipo_avaliacao, created_at')
            .eq('colaborador_id', ownId)
        for (const r of data || []) {
            let mes = Number(r.mes), ano = Number(r.ano)
            if (!mes || !ano) { const d = new Date(r.created_at); mes = d.getMonth() + 1; ano = d.getFullYear() }
            const b = ensureBucket(externoMap, ano, mes)
            b.n++; externoTotal++
            const labels = r.tipo_avaliacao === 'gerente' ? LABELS_GERENTE : LABELS_CONSULTOR
            for (const [field, label] of Object.entries(labels)) {
                if ((r as any)[field] != null) addMetric(b, label, Number((r as any)[field]))
            }
            if (r.feedback_texto && String(r.feedback_texto).trim()) b.feedbacks.push(String(r.feedback_texto).trim())
        }
    } catch { /* fonte opcional */ }

    // ── NPS Interno (formulário "Piloto de Elite") — o usuário é o AVALIADO ──
    const internoMap = new Map<string, MonthBucket>()
    let internoTotal = 0
    try {
        const { data: forms } = await supabase
            .from('formularios').select('id, titulo')
            .or('titulo.ilike.%piloto%,titulo.ilike.%elite%')
        const form = (forms || [])[0]
        if (form) {
            const { data: perguntas } = await supabase
                .from('formulario_perguntas').select('id, tipo, titulo, ordem')
                .eq('formulario_id', form.id).order('ordem', { ascending: true })
            const avaliadoPergunta = (perguntas || []).find(p => p.tipo === 'colaborador_unico')
            const escalaPerguntas = (perguntas || []).filter(p => p.tipo === 'escala')
            const textoPerguntas = (perguntas || []).filter(p => ['texto', 'texto_longo', 'paragrafo'].includes(p.tipo))
            if (avaliadoPergunta) {
                const { data: respostas } = await supabase
                    .from('formulario_respostas')
                    .select('id, enviado_em, formulario_respostas_itens(pergunta_id, valor, valores)')
                    .eq('formulario_id', form.id)
                for (const r of respostas || []) {
                    const items = (r as any).formulario_respostas_itens || []
                    const avaliadoItem = items.find((it: any) => it.pergunta_id === avaliadoPergunta.id)
                    if (!avaliadoItem || avaliadoItem.valor !== ownId) continue // só avaliações sobre ESTE usuário
                    const d = new Date(r.enviado_em)
                    const b = ensureBucket(internoMap, d.getFullYear(), d.getMonth() + 1)
                    b.n++; internoTotal++
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
    } catch { /* fonte opcional */ }

    return {
        npsExterno: { total: externoTotal, porMes: bucketsToObject(externoMap) },
        npsInterno: { total: internoTotal, porMes: bucketsToObject(internoMap) },
    }
}

// ──────────────────────────────────────────────────────────── TAREFAS (Minhas Prioridades)
const PRIO_LABEL: Record<string, string> = { alta: 'Alta', media: 'Média', baixa: 'Baixa' }
function fmtEstimate(min: number) {
    if (!min) return null
    if (min < 60) return `${min}min`
    const h = Math.floor(min / 60), m = min % 60
    return m ? `${h}h${m}` : `${h}h`
}
async function gatherTarefas(supabase: ReturnType<typeof createServerSupabaseClient>, ownId: string, hojeISO: string) {
    let cats: Record<string, string> = {}
    try {
        const { data } = await supabase.from('prioridades_categorias').select('id, name').eq('colaborador_id', ownId)
        for (const c of data || []) cats[c.id] = c.name
    } catch { /* opcional */ }

    try {
        const { data } = await supabase
            .from('prioridades_tarefas')
            .select('title, notes, category, priority, urgent, important, status, due, estimate, subtasks')
            .eq('colaborador_id', ownId)
        const rows = data || []
        const ativas = rows.filter(t => t.status !== 'done').map(t => {
            const subs = Array.isArray(t.subtasks) ? t.subtasks : []
            return {
                titulo: t.title,
                categoria: cats[t.category] || t.category || '—',
                prioridade: PRIO_LABEL[t.priority] || t.priority,
                urgente: !!t.urgent,
                importante: !!t.important,
                status: t.status === 'doing' ? 'Fazendo' : 'A fazer',
                prazo: t.due || null,
                vencida: !!t.due && t.due < hojeISO,
                para_hoje: t.due === hojeISO,
                estimativa: fmtEstimate(t.estimate || 0),
                checklist: subs.length ? `${subs.filter((s: any) => s.done).length}/${subs.length}` : null,
            }
        })
        return {
            total_ativas: ativas.length,
            concluidas: rows.filter(t => t.status === 'done').length,
            tarefas: ativas.slice(0, 60),
        }
    } catch {
        return { total_ativas: 0, concluidas: 0, tarefas: [] }
    }
}

// ──────────────────────────────────────────────────────────── PDI
async function gatherPdi(supabase: ReturnType<typeof createServerSupabaseClient>, ownId: string) {
    try {
        const { data: planos } = await supabase
            .from('pdi_planos').select('id, titulo, descricao, data_prazo, progresso, status')
            .eq('colaborador_id', ownId)
        if (!planos || planos.length === 0) return { total: 0, planos: [] }
        const ids = planos.map(p => p.id)
        const { data: tarefas } = await supabase
            .from('pdi_tarefas').select('plano_id, titulo, tipo, status, data_conclusao')
            .in('plano_id', ids)
        const porPlano = new Map<string, any[]>()
        for (const t of tarefas || []) {
            if (!porPlano.has(t.plano_id)) porPlano.set(t.plano_id, [])
            porPlano.get(t.plano_id)!.push(t)
        }
        return {
            total: planos.length,
            planos: planos.map(p => {
                const ts = porPlano.get(p.id) || []
                const pendentes = ts.filter(t => String(t.status).toUpperCase() !== 'CONCLUIDO')
                return {
                    titulo: p.titulo,
                    prazo: p.data_prazo || null,
                    progresso: p.progresso ?? null,
                    status: p.status || null,
                    tarefas_pendentes: pendentes.map(t => ({ titulo: t.titulo, tipo: t.tipo, status: t.status })),
                }
            }),
        }
    } catch {
        return { total: 0, planos: [] }
    }
}

// ──────────────────────────────────────────────────────────── FORMULÁRIOS pendentes
async function gatherFormularios(supabase: ReturnType<typeof createServerSupabaseClient>, ownId: string, now: Date) {
    try {
        const { data: forms } = await supabase
            .from('formularios').select('id, titulo, data_prazo, status').eq('status', 'ativo')
        if (!forms || forms.length === 0) return { pendentes: [] }
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString()
        const { data: respostas } = await supabase
            .from('formulario_respostas').select('formulario_id, enviado_em')
            .eq('colaborador_id', ownId).gte('enviado_em', firstDay).lte('enviado_em', lastDay)
        const respondidos = new Set((respostas || []).map(r => r.formulario_id))
        const pendentes = forms.filter(f => !respondidos.has(f.id)).map(f => ({ titulo: f.titulo, prazo: f.data_prazo || null }))
        return { pendentes }
    } catch {
        return { pendentes: [] }
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

        // ISOLAMENTO: o alvo é SEMPRE o próprio colaborador da sessão.
        // Nenhum id vindo do cliente é aceito — não há como pedir dados de outra pessoa.
        const ownId = (session.user as any).colaborador_id
        if (!ownId) return NextResponse.json({ error: 'Colaborador não identificado.' }, { status: 400 })

        const body = await request.json().catch(() => ({}))
        const messages: { role: 'user' | 'assistant'; content: string }[] = Array.isArray(body.messages) ? body.messages : []

        const supabase = createServerSupabaseClient()
        const now = new Date()
        const hojeISO = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
        const diaSemana = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'][now.getDay()]

        const { data: eu } = await supabase.from('colaboradores').select('nome, cargo_atual, nucleo_atual').eq('id', ownId).single()

        const [tarefas, pdi, formularios, nps] = await Promise.all([
            gatherTarefas(supabase, ownId, hojeISO),
            gatherPdi(supabase, ownId),
            gatherFormularios(supabase, ownId, now),
            gatherNps(supabase, ownId),
        ])

        const dados = {
            hoje: `${diaSemana}, ${hojeISO}`,
            tarefas,
            pdi,
            formularios,
            feedbacks: nps,
        }

        const primeiroNome = (eu?.nome || '').split(' ')[0] || 'colaborador(a)'

        const systemPrompt = `Você é o Assistente Pessoal de ${eu?.nome || 'um colaborador'} na Produtiva Júnior — um agente de rotina que ajuda APENAS esta pessoa a se organizar. Fale em português, em tom próximo, prático e direto. Trate por "${primeiroNome}".

DATA DE HOJE: ${diaSemana}, ${hojeISO}.

O QUE VOCÊ CONHECE (apenas desta pessoa): tarefas do "Minhas Prioridades", planos de PDI e seus prazos, formulários pendentes, e os feedbacks de NPS recebidos.

COMO RESPONDER:
- "O que devo fazer hoje?" → olhe as tarefas vencidas e as com prazo de hoje, tarefas de PDI ainda pendentes cujo prazo se aproxima, e formulários ainda não respondidos. Monte um roteiro curto e priorizado para o dia.
- "O que devo priorizar?" → combine urgência/importância (matriz), prioridade e a estimativa de tempo de cada tarefa. Sugira começar pelas urgentes+importantes e encaixar tarefas curtas nos intervalos.
- Seja conciso. Use listas curtas e markdown leve (## títulos, **negrito**, listas). Nada de enrolação.
- Nunca invente dados. Se algo não existe, diga com naturalidade.

REGRAS DE PRIVACIDADE (OBRIGATÓRIAS) sobre os FEEDBACKS:
- ORIGEM DOS FEEDBACKS: são avaliações INTERNAS, feitas por OUTROS MEMBROS da empresa (colegas do mesmo núcleo e/ou que atuaram nos mesmos projetos, incluindo gerentes) — NUNCA por clientes externos. Jamais use as palavras "cliente", "consumidor" ou "público externo"; trate como feedback de colegas e da equipe interna.
- As respostas são 100% ANÔNIMAS. NUNCA revele, cite literalmente (nem entre aspas) ou deixe deduzir QUEM escreveu um feedback.
- SEMPRE parafraseie e generalize os comentários — reescreva com outras palavras, juntando temas. Jamais reproduza um comentário tal como foi escrito.
- Não mencione nomes, cargos, projetos, datas específicas ou qualquer pista que identifique o autor.
- Só fale dos dados DESTA pessoa. Nunca traga informação de outros colaboradores.
- Ao falar de feedback, seja simples e resumido (pontos fortes e pontos de atenção em poucas linhas).
- SEMPRE que tratar de feedback, encerre recomendando agendar uma conversa com alguém do núcleo de Gestão de Pessoas para um feedback mais aprofundado e assertivo.

DADOS (somente desta pessoa):
${JSON.stringify(dados)}`

        const anthropic = new Anthropic({ apiKey })

        const convo = messages.length > 0
            ? messages
            : [{ role: 'user' as const, content: 'Faça um resumo da minha rotina e me diga, de forma priorizada, o que devo focar hoje.' }]

        const resp = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 2000,
            system: systemPrompt,
            messages: convo,
        })

        const text = resp.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('\n')
        return NextResponse.json({ text, colaborador: eu?.nome || null })
    } catch (err: any) {
        console.error('assistente-pessoal error:', err)
        const msg = err?.error?.error?.message || err?.message || 'Erro ao gerar resposta.'
        return NextResponse.json({ error: msg }, { status: 500 })
    }
}
