import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirMembroGasolina, montarPreview } from '@/lib/gasolina-server'
import { criarCardReembolso } from '@/lib/gasolina-monday'

const CAMPOS = '*, centro:centro_custo_id(nome), viagens:gasolina_viagens(id, data_viagem, origem_local, destino_local, distancia_km, litros, valor, status)'

// GET: solicitações do membro. ?todos=1 (só VP): de todos.
export async function GET(req: NextRequest) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const todos = req.nextUrl.searchParams.get('todos') === '1'
    if (todos && !acesso.gestor) {
        return NextResponse.json({ error: 'Apenas a Vice Presidência pode ver as solicitações de todos.' }, { status: 403 })
    }

    let query = supabase
        .from('gasolina_solicitacoes')
        .select(todos ? `${CAMPOS}, colaborador:colaborador_id(nome)` : CAMPOS)
        .order('criado_em', { ascending: false })
        .limit(500)
    if (!todos) query = query.eq('colaborador_id', acesso.colaboradorId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Erro ao buscar as solicitações.' }, { status: 500 })
    return NextResponse.json({ solicitacoes: data ?? [] })
}

// POST: confirma a solicitação de um projeto. Marca as viagens como
// "Em solicitação" e cria o card no Monday; se o Monday falhar, desfaz tudo.
export async function POST(req: NextRequest) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const body = await req.json().catch(() => ({}))
    const centroId = typeof body.centro_custo_id === 'string' ? body.centro_custo_id : ''
    const projeto = typeof body.projeto === 'string' ? body.projeto.trim() : ''
    if (!centroId || !projeto) return NextResponse.json({ error: 'Informe o centro de custo e o projeto.' }, { status: 400 })

    const [{ data: colaborador }, { data: centro }] = await Promise.all([
        supabase.from('colaboradores').select('nome, email_corporativo, email_pessoal, chave_pix').eq('id', acesso.colaboradorId).single(),
        supabase.from('gasolina_centros_custo').select('*').eq('id', centroId).maybeSingle(),
    ])
    if (!colaborador?.chave_pix) {
        return NextResponse.json({ error: 'Cadastre sua chave Pix na aba "Meus carros e Pix" antes de solicitar.' }, { status: 400 })
    }
    const email = colaborador.email_corporativo || colaborador.email_pessoal
    if (!email) return NextResponse.json({ error: 'Seu cadastro está sem e-mail. Peça para a Gestão de Pessoas completar.' }, { status: 400 })
    if (!centro) return NextResponse.json({ error: 'Centro de custo não encontrado.' }, { status: 404 })

    const preview = await montarPreview(supabase, acesso.colaboradorId, centroId, projeto)
    if (!preview.incluidas.length) {
        return NextResponse.json({ error: 'Nenhuma viagem pendente com preço do mês definido para este projeto.' }, { status: 400 })
    }

    const { data: solicitacao, error: erroSolicitacao } = await supabase
        .from('gasolina_solicitacoes')
        .insert({
            colaborador_id: acesso.colaboradorId,
            centro_custo_id: centroId,
            projeto,
            qtd_viagens: preview.incluidas.length,
            litros_total: preview.litros_total,
            valor_total: preview.valor_total,
            chave_pix: colaborador.chave_pix,
            status: 'Solicitado',
        })
        .select('id')
        .single()
    if (erroSolicitacao || !solicitacao) return NextResponse.json({ error: 'Erro ao registrar a solicitação.' }, { status: 500 })

    const ids = preview.incluidas.map(v => v.id)
    const desfazer = async () => {
        await supabase.from('gasolina_viagens').update({ status: 'Pendente', solicitacao_id: null })
            .eq('solicitacao_id', solicitacao.id)
        await supabase.from('gasolina_solicitacoes').delete().eq('id', solicitacao.id)
    }

    // Reserva as viagens (só as que ainda estão Pendentes — protege contra
    // clique duplo ou duas abas abertas).
    const { data: reservadas } = await supabase
        .from('gasolina_viagens')
        .update({ status: 'Em solicitação', solicitacao_id: solicitacao.id, atualizado_em: new Date().toISOString() })
        .in('id', ids)
        .eq('status', 'Pendente')
        .select('id')
    if ((reservadas?.length ?? 0) !== ids.length) {
        await desfazer()
        return NextResponse.json({ error: 'Algumas viagens mudaram enquanto você solicitava. Abra a prévia de novo.' }, { status: 409 })
    }

    let itemId: string
    try {
        itemId = await criarCardReembolso({
            solicitacaoId: solicitacao.id,
            membro: { nome: colaborador.nome, email },
            chavePix: colaborador.chave_pix,
            centro,
            projeto,
            viagens: preview.incluidas,
            valorTotal: preview.valor_total,
            litrosTotal: preview.litros_total,
        })
    } catch (err) {
        await desfazer()
        console.error('[gasolina] Falha ao criar o card no Monday:', err)
        const motivo = err instanceof Error ? err.message.slice(0, 300) : String(err)
        return NextResponse.json({ error: `Não foi possível criar o pedido no Monday. Nada foi solicitado. Motivo: ${motivo}` }, { status: 502 })
    }

    const { error: erroItem } = await supabase.from('gasolina_solicitacoes')
        .update({ monday_item_id: itemId, atualizado_em: new Date().toISOString() })
        .eq('id', solicitacao.id)
    if (erroItem) console.error(`[gasolina] Card ${itemId} criado, mas falhou ao gravar na solicitação ${solicitacao.id}:`, erroItem)

    return NextResponse.json({ solicitacao_id: solicitacao.id, monday_item_id: itemId, valor_total: preview.valor_total })
}
