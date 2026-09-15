import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'

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
    // Painéis de líder/admin (passos 4 e 5) ainda vão ampliar quem pode ler
    // uma solicitação que não é a sua própria.
    if (solicitacao.colaborador_id !== colaboradorId) {
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
    const { action } = await req.json()
    const supabase = createServerSupabaseClient()

    const { data: solicitacao, error: fetchError } = await supabase
        .from('pdi_solicitacoes')
        .select('*')
        .eq('id', id)
        .single()

    if (fetchError || !solicitacao) {
        return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    }
    // Ações de líder (aceitar, sugerir horário, concluir) chegam no passo 4,
    // com sua própria validação de papel — aqui só o dono da solicitação.
    if (solicitacao.colaborador_id !== colaboradorId) {
        return NextResponse.json({ error: 'Você não tem permissão para alterar esta solicitação.' }, { status: 403 })
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
            texto: 'Solicitação cancelada pelo colaborador.',
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

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
}
