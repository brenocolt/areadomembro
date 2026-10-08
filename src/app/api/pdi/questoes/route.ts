import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import type { PdiDesempenho, PdiQuestaoTreino, PdiResultadoQuestao } from '@/lib/pdi'

// Treino de questões — aberto a qualquer membro logado. O banco em si é só
// para líderes, mas aqui as questões saem SEM a resposta certa e sem o
// comentário; eles só voltam na correção (POST).

const MAX_QUESTOES = 30
const SEM_CATEGORIA = 'Sem categoria'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function lerDesempenho(supabase: any, colaboradorId: string): Promise<PdiDesempenho> {
    const { data } = await supabase
        .from('pdi_questoes_tentativas')
        .select('itens')
        .eq('colaborador_id', colaboradorId)
    const porCategoria = new Map<string, { total: number, acertos: number }>()
    let total = 0, acertos = 0
    for (const t of data || []) {
        for (const it of (t.itens || []) as { categoria: string | null, acertou: boolean }[]) {
            const cat = it.categoria || SEM_CATEGORIA
            const agg = porCategoria.get(cat) || { total: 0, acertos: 0 }
            agg.total++
            total++
            if (it.acertou) { agg.acertos++; acertos++ }
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
        .select('id, categoria, conteudo, alternativas')
        .eq('tipo', 'questao')
        .not('alternativas', 'is', null)
    if (error) return NextResponse.json({ error: 'Erro ao buscar questões.', detalhe: error.message }, { status: 500 })
    const disponiveis = (banco || []) as { id: string, categoria: string | null, conteudo: string | null, alternativas: string[] }[]

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
    const questoes: PdiQuestaoTreino[] = elegiveis.slice(0, qtd).map(q => ({
        id: q.id, categoria: q.categoria, enunciado: q.conteudo || '', alternativas: q.alternativas,
    }))
    return NextResponse.json({ questoes })
}

// POST { respostas: [{ id, escolha }] } → corrige, grava a tentativa e devolve
// o gabarito com o índice de acerto.
export async function POST(req: NextRequest) {
    const session = await auth()
    const colaboradorId = (session?.user as { colaborador_id?: string } | undefined)?.colaborador_id
    if (!colaboradorId) return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })

    const body = await req.json()
    const respostas: { id: string, escolha: number | null }[] = Array.isArray(body.respostas) ? body.respostas : []
    const ids = respostas.map(r => r?.id)
    if (respostas.length === 0 || respostas.length > MAX_QUESTOES || new Set(ids).size !== ids.length || ids.some(id => typeof id !== 'string')) {
        return NextResponse.json({ error: 'Respostas inválidas.' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    const { data: questoes } = await supabase
        .from('pdi_banco_itens')
        .select('id, categoria, alternativas, correta, resposta')
        .eq('tipo', 'questao')
        .in('id', ids)
    const porId = new Map<string, { id: string, categoria: string | null, alternativas: string[] | null, correta: number | null, resposta: string | null }>(
        (questoes || []).map((q: { id: string }) => [q.id, q as never])
    )
    if (ids.some(id => !porId.get(id)?.alternativas || porId.get(id)?.correta == null)) {
        return NextResponse.json({ error: 'Alguma questão não existe mais. Gere um novo treino.' }, { status: 400 })
    }

    const resultados: PdiResultadoQuestao[] = []
    const itens: { questao_id: string, categoria: string | null, escolha: number | null, correta: number, acertou: boolean }[] = []
    for (const r of respostas) {
        const q = porId.get(r.id)!
        const escolha = Number.isInteger(r.escolha) && r.escolha! >= 0 && r.escolha! < q.alternativas!.length ? r.escolha! : null
        const acertou = escolha === q.correta
        resultados.push({ id: q.id, acertou, escolha, correta: q.correta!, comentario: q.resposta })
        itens.push({ questao_id: q.id, categoria: q.categoria, escolha, correta: q.correta!, acertou })
    }
    const acertos = resultados.filter(r => r.acertou).length

    const { error } = await supabase.from('pdi_questoes_tentativas').insert({
        colaborador_id: colaboradorId, total: resultados.length, acertos, itens,
    })
    if (error) return NextResponse.json({ error: 'Erro ao salvar o resultado.', detalhe: error.message }, { status: 500 })

    return NextResponse.json({ total: resultados.length, acertos, resultados, desempenho: await lerDesempenho(supabase, colaboradorId) })
}
