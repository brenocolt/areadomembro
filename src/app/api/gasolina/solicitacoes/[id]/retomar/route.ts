import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirMembroGasolina, retomarSolicitacao } from '@/lib/gasolina-server'

// POST: o membro retoma uma solicitação recusada — as viagens voltam a
// Pendente para ele corrigir e solicitar de novo.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const { id } = await params
    const { data: solicitacao } = await supabase.from('gasolina_solicitacoes')
        .select('id, status').eq('id', id).eq('colaborador_id', acesso.colaboradorId).maybeSingle()
    if (!solicitacao) return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
    if (solicitacao.status !== 'Recusado') {
        return NextResponse.json({ error: 'Só dá para retomar solicitações recusadas.' }, { status: 409 })
    }

    const resultado = await retomarSolicitacao(supabase, id)
    if (!resultado.retomadas && !resultado.vencidas) {
        return NextResponse.json({ error: 'As viagens desta solicitação já foram retomadas.' }, { status: 409 })
    }
    return NextResponse.json(resultado)
}
