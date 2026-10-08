import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { PDI_PESO_AUTOAVALIACAO, type PdiAutoavaliacao, type PdiDesempenho, type PdiQuestaoTreino } from '@/lib/pdi'

// Treino de questões subjetivas — aberto a qualquer membro logado. O banco em
// si é restrito, mas aqui as questões saem SEM o gabarito; ele só é buscado
// (POST action 'gabarito') depois que o membro escreve a resposta. Entram no
// treino as questões do banco que têm enunciado e gabarito.

const MAX_QUESTOES = 30
const MAX_RESPOSTA = 5000
const SEM_CATEGORIA = 'Sem categoria'
const NIVEIS = Object.keys(PDI_PESO_AUTOAVALIACAO)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function lerDesempenho(supabase: any, colaboradorId: string): Promise<PdiDesempenho> {
    const { data } = await supabase
        .from('pdi_questoes_tentativas')
        .select('itens')
        .eq('colaborador_id', colaboradorId)
    const porCategoria = new Map<string, { total: number, acertos: number }>()
    let total = 0, acertos = 0
    for (const t of data || []) {
        for (const it of (t.itens || []) as { categoria: string | null, nivel: PdiAutoavaliacao }[]) {
            const peso = PDI_PESO_AUTOAVALIACAO[it.nivel] ?? 0
            const cat = it.categoria || SEM_CATEGORIA
            const agg = porCategoria.get(cat) || { total: 0, acertos: 0 }
            agg.total++; agg.acertos += peso
            total++; acertos += peso
            porCategoria.set(cat, agg)
        }
    }
    return {
        total, acertos,
        porCategoria: Array.from(porCategoria, ([categoria, v]) => ({ categoria, ...v })).sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt-BR')),
    }
}

// GET ?resumo=1            → áreas com questões disponíveis + desempenho do membro
// GET ?areas=A,B&qtd=10    → sorteia questões (sem gabarito) das áreas escolhidas
export async function GET(req: NextRequest) {
    const session = await auth()
    const colaboradorId = (session?.user as { colaborador_id?: string } | undefined)?.colaborador_id
    if (!colaboradorId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    const supabase = createServerSupabaseClient()

    const { data: banco, error } = await supabase
        .from('pdi_banco_itens')
        .select('id, categoria, conteudo')
        .eq('tipo', 'questao')
        .not('conteudo', 'is', null)
        .not('resposta', 'is', null)
    if (error) return NextResponse.json({ error: 'Erro ao buscar questões.', detalhe: error.message }, { status: 500 })
    const disponiveis = (banco || []) as { id: string, categoria: string | null, conteudo: string }[]

    if (req.nextUrl.searchParams.get('resumo')) {
        const contagem = new Map<string, number>()
        for (const q of disponiveis) contagem.set(q.categoria || SEM_CATEGORIA, (contagem.get(q.categoria || SEM_CATEGORIA) || 0) + 1)
        return NextResponse.json({
            total: disponiveis.length,
            categorias: Array.from(contagem, ([categoria, total]) => ({ categoria, total })).sort((a, b) => a.categoria.localeCompare(b.categoria, 'pt-BR')),
            desempenho: await lerDesempenho(supabase, colaboradorId),
        })
    }

    const areas = (req.nextUrl.searchParams.get('areas') || '').split(',').map(a => a.trim()).filter(Boolean)
    const qtd = Math.min(Math.max(parseInt(req.nextUrl.searchParams.get('qtd') || '10', 10) || 10, 1), MAX_QUESTOES)
    const elegiveis = areas.length > 0
        ? disponiveis.filter(q => areas.includes(q.categoria || SEM_CATEGORIA))
        : disponiveis
    // Embaralha (Fisher-Yates) e pega as primeiras `qtd`.
    for (let i = elegiveis.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [elegiveis[i], elegiveis[j]] = [elegiveis[j], elegiveis[i]]
    }
    const questoes: PdiQuestaoTreino[] = elegiveis.slice(0, qtd).map(q => ({ id: q.id, categoria: q.categoria, enunciado: q.conteudo }))
    return NextResponse.json({ questoes })
}

// POST { action: 'gabarito', ids }                 → gabaritos das questões
// POST { action: 'finalizar', avaliacoes: [...] }  → grava a tentativa e devolve o desempenho
export async function POST(req: NextRequest) {
    const session = await auth()
    const colaboradorId = (session?.user as { colaborador_id?: string } | undefined)?.colaborador_id
    if (!colaboradorId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    const supabase = createServerSupabaseClient()
    const body = await req.json()

    if (body.action === 'gabarito') {
        const ids: string[] = Array.isArray(body.ids) ? body.ids : []
        if (ids.length === 0 || ids.length > MAX_QUESTOES || ids.some(id => typeof id !== 'string')) {
            return NextResponse.json({ error: 'Pedido inválido.' }, { status: 400 })
        }
        const { data, error } = await supabase
            .from('pdi_banco_itens')
            .select('id, resposta')
            .eq('tipo', 'questao')
            .in('id', ids)
        if (error) return NextResponse.json({ error: 'Erro ao buscar o gabarito.', detalhe: error.message }, { status: 500 })
        return NextResponse.json({ gabaritos: (data || []).map((q: { id: string, resposta: string | null }) => ({ id: q.id, gabarito: q.resposta })) })
    }

    if (body.action === 'finalizar') {
        const avaliacoes: { id: string, resposta: string | null, nivel: PdiAutoavaliacao }[] = Array.isArray(body.avaliacoes) ? body.avaliacoes : []
        const ids = avaliacoes.map(a => a?.id)
        if (avaliacoes.length === 0 || avaliacoes.length > MAX_QUESTOES || new Set(ids).size !== ids.length
            || avaliacoes.some(a => typeof a.id !== 'string' || !NIVEIS.includes(a.nivel))) {
            return NextResponse.json({ error: 'Avaliação inválida.' }, { status: 400 })
        }
        const { data: questoes } = await supabase.from('pdi_banco_itens').select('id, categoria').eq('tipo', 'questao').in('id', ids)
        const categoriaPorId = new Map<string, string | null>((questoes || []).map((q: { id: string, categoria: string | null }) => [q.id, q.categoria]))
        if (ids.some(id => !categoriaPorId.has(id))) return NextResponse.json({ error: 'Alguma questão não existe mais.' }, { status: 400 })

        const itens = avaliacoes.map(a => ({
            questao_id: a.id,
            categoria: categoriaPorId.get(a.id) ?? null,
            resposta: typeof a.resposta === 'string' ? a.resposta.slice(0, MAX_RESPOSTA) : null,
            nivel: a.nivel,
        }))
        const pontos = itens.reduce((n, i) => n + PDI_PESO_AUTOAVALIACAO[i.nivel], 0)

        // Gravar o histórico não pode esconder o resultado do membro: se falhar,
        // volta `salvo: false` com o motivo e a tela avisa.
        const { error } = await supabase.from('pdi_questoes_tentativas').insert({
            colaborador_id: colaboradorId, total: itens.length, acertos: Math.round(pontos), itens,
        })
        if (error) console.error('Erro ao salvar a tentativa do treino de questões:', error.message)
        return NextResponse.json({
            total: itens.length, acertos: pontos,
            desempenho: await lerDesempenho(supabase, colaboradorId),
            salvo: !error, detalheSalvar: error?.message ?? null,
        })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
}
