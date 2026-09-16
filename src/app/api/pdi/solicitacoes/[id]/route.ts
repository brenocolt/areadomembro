import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolverPapelId, isDataValida, gerarHorariosDisponiveis } from '@/lib/pdi'

const ACOES_COLABORADOR = ['cancelar', 'aceitar_sugestao', 'manter_original']
const ACOES_LIDER = ['aceitar', 'sugerir_horario', 'concluir']

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    const colaboradorId = (session?.user as any)?.colaborador_id as string | undefined
    if (!colaboradorId) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { data: solicitacao, error } = await supabase
        .from('pdi_solicitacoes')
        .select('*, pdi_solicitacao_lideres(papel_id, lider_id, aceito_em, lider:lider_id(nome)), pdi_anotacoes(*), pdi_eventos(*)')
        .eq('id', id)
        .single()

    if (error || !solicitacao) {
        return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }
    const isAdmin = (session?.user as any)?.role === 'ADMIN'
    if (solicitacao.colaborador_id !== colaboradorId && !isAdmin) {
        return NextResponse.json({ error: 'Você não tem permissão para ver esta solicitação.' }, { status: 403 })
    }

    return NextResponse.json({ solicitacao })
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    const colaboradorId = (session?.user as any)?.colaborador_id as string | undefined
    if (!colaboradorId) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const { action } = body
    const supabase = createServerSupabaseClient()

    const { data: solicitacao, error: fetchError } = await supabase
        .from('pdi_solicitacoes')
        .select('*')
        .eq('id', id)
        .single()

    if (fetchError || !solicitacao) {
        return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }

    if (!ACOES_COLABORADOR.includes(action) && !ACOES_LIDER.includes(action)) {
        return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
    }

    const isAdmin = (session?.user as any)?.role === 'ADMIN'
    // "cancelar" é a única ação do administrador (§7) — ele não designa
    // ninguém, só encerra. As demais ações de colaborador (responder a uma
    // sugestão de horário) continuam exclusivas de quem fez o pedido.
    const podeCancelarComoAdmin = action === 'cancelar' && isAdmin
    if (ACOES_COLABORADOR.includes(action) && solicitacao.colaborador_id !== colaboradorId && !podeCancelarComoAdmin) {
        return NextResponse.json({ error: 'Você não tem permissão para alterar esta solicitação.' }, { status: 403 })
    }

    // Ações de líder: precisa resolver o papel de liderança do usuário
    // logado (a partir do cargo/núcleo dele) e confirmar que é um dos
    // papéis pedidos nesta solicitação — nunca confiar em um papel enviado
    // pelo cliente.
    let meuPapelId: string | null = null
    if (ACOES_LIDER.includes(action)) {
        const { data: colaborador } = await supabase
            .from('colaboradores')
            .select('cargo_atual, nucleo_atual')
            .eq('id', colaboradorId)
            .single()
        const { data: mapeamentos } = await supabase.from('pdi_cargos').select('papel_id, cargo_atual, nucleo_atual')
        meuPapelId = resolverPapelId(colaborador?.cargo_atual, colaborador?.nucleo_atual, mapeamentos || [])

        if (!meuPapelId || !(solicitacao.cargos || []).includes(meuPapelId)) {
            return NextResponse.json({ error: 'Você não tem o papel de liderança pedido nesta solicitação.' }, { status: 403 })
        }
    }

    if (action === 'cancelar') {
        if (solicitacao.status === 'concluido' || solicitacao.status === 'cancelado') {
            return NextResponse.json({ error: 'Esta solicitação já foi encerrada.' }, { status: 400 })
        }
        await supabase.from('pdi_solicitacoes').update({
            status: 'cancelado',
            atualizado_em: new Date().toISOString(),
        }).eq('id', id)
        await supabase.from('pdi_eventos').insert({
            solicitacao_id: id, tipo: 'cancelamento', autor_id: colaboradorId,
            texto: podeCancelarComoAdmin ? 'Solicitação cancelada pela administração.' : 'Solicitação cancelada pelo colaborador.',
        })
        return NextResponse.json({ success: true })
    }

    if (action === 'aceitar_sugestao') {
        if (solicitacao.status !== 'reagendado' || !solicitacao.sugestao) {
            return NextResponse.json({ error: 'Não há sugestão de horário pendente.' }, { status: 400 })
        }
        const sugestao = solicitacao.sugestao as { data: string, hora: string, motivo?: string, lider_id: string, papel_id: string }

        await supabase.from('pdi_solicitacoes').update({
            status: 'agendado',
            data: sugestao.data,
            hora: sugestao.hora,
            sugestao: null,
            atualizado_em: new Date().toISOString(),
        }).eq('id', id)

        await supabase.from('pdi_solicitacao_lideres')
            .update({ lider_id: sugestao.lider_id, aceito_em: new Date().toISOString() })
            .eq('solicitacao_id', id)
            .eq('papel_id', sugestao.papel_id)

        await supabase.from('pdi_eventos').insert({
            solicitacao_id: id, tipo: 'aceite_sugestao', autor_id: colaboradorId,
            texto: `Novo horário aceito: ${sugestao.data} às ${sugestao.hora}.`,
        })
        return NextResponse.json({ success: true })
    }

    if (action === 'manter_original') {
        if (solicitacao.status !== 'reagendado') {
            return NextResponse.json({ error: 'Não há sugestão de horário pendente.' }, { status: 400 })
        }
        await supabase.from('pdi_solicitacoes').update({
            status: 'aguardando',
            sugestao: null,
            atualizado_em: new Date().toISOString(),
        }).eq('id', id)
        await supabase.from('pdi_eventos').insert({
            solicitacao_id: id, tipo: 'recusa_sugestao', autor_id: colaboradorId,
            texto: 'Colaborador manteve o horário original.',
        })
        return NextResponse.json({ success: true })
    }

    if (action === 'aceitar') {
        if (solicitacao.status === 'cancelado' || solicitacao.status === 'concluido') {
            return NextResponse.json({ error: 'Esta solicitação já foi encerrada.' }, { status: 400 })
        }
        const { data: linha } = await supabase
            .from('pdi_solicitacao_lideres')
            .select('*')
            .eq('solicitacao_id', id)
            .eq('papel_id', meuPapelId!)
            .single()
        if (!linha || linha.lider_id) {
            return NextResponse.json({ error: 'Este papel já foi aceito por outra pessoa.' }, { status: 409 })
        }

        await supabase.from('pdi_solicitacao_lideres')
            .update({ lider_id: colaboradorId, aceito_em: new Date().toISOString() })
            .eq('solicitacao_id', id)
            .eq('papel_id', meuPapelId!)

        // Uma solicitação com mais de um papel continua "aberta" para os
        // papéis que ainda não têm ninguém — só a linha desse papel muda.
        if (solicitacao.status === 'aguardando') {
            await supabase.from('pdi_solicitacoes').update({
                status: 'agendado', atualizado_em: new Date().toISOString(),
            }).eq('id', id)
        }

        await supabase.from('pdi_eventos').insert({
            solicitacao_id: id, tipo: 'aceite', autor_id: colaboradorId, texto: 'Momento aceito.',
        })
        return NextResponse.json({ success: true })
    }

    if (action === 'sugerir_horario') {
        if (solicitacao.status === 'cancelado' || solicitacao.status === 'concluido') {
            return NextResponse.json({ error: 'Esta solicitação já foi encerrada.' }, { status: 400 })
        }
        const { data, hora, motivo } = body
        if (!data || !isDataValida(data)) {
            return NextResponse.json({ error: 'Data inválida — escolha um dia útil a partir de amanhã, em até 60 dias.' }, { status: 400 })
        }
        if (!hora || !gerarHorariosDisponiveis().includes(hora)) {
            return NextResponse.json({ error: 'Horário inválido.' }, { status: 400 })
        }

        await supabase.from('pdi_solicitacoes').update({
            status: 'reagendado',
            sugestao: { data, hora, motivo: motivo || null, lider_id: colaboradorId, papel_id: meuPapelId },
            atualizado_em: new Date().toISOString(),
        }).eq('id', id)

        await supabase.from('pdi_eventos').insert({
            solicitacao_id: id, tipo: 'sugestao', autor_id: colaboradorId,
            texto: `Sugeriu novo horário: ${data} às ${hora}.`,
        })
        return NextResponse.json({ success: true })
    }

    if (action === 'concluir') {
        const { resumo, proximos_passos } = body
        if (!resumo || !resumo.trim()) {
            return NextResponse.json({ error: 'Informe um resumo do momento.' }, { status: 400 })
        }
        const { data: linha } = await supabase
            .from('pdi_solicitacao_lideres')
            .select('*')
            .eq('solicitacao_id', id)
            .eq('papel_id', meuPapelId!)
            .single()
        if (!linha || linha.lider_id !== colaboradorId) {
            return NextResponse.json({ error: 'Você precisa ter aceitado este momento antes de concluí-lo.' }, { status: 403 })
        }

        await supabase.from('pdi_anotacoes').insert({
            solicitacao_id: id, autor_id: colaboradorId, texto: resumo, proximos_passos: proximos_passos || null,
        })
        await supabase.from('pdi_solicitacoes').update({
            status: 'concluido', atualizado_em: new Date().toISOString(),
        }).eq('id', id)
        await supabase.from('pdi_eventos').insert({
            solicitacao_id: id, tipo: 'conclusao', autor_id: colaboradorId, texto: 'Momento concluído.',
        })
        return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
}
