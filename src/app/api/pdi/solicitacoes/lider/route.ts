import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { resolverPapelId } from '@/lib/pdi'

// Solicitações relevantes para o líder logado — todas as que pedem o papel
// de liderança dele, independente de já ter alguém aceito ou não (o
// agrupamento em seções "Abertas para você" / "Aceitos por você" / etc.
// é feito no cliente, olhando pdi_solicitacao_lideres).
export async function GET() {
    const session = await auth()
    const colaboradorId = (session?.user as any)?.colaborador_id as string | undefined
    if (!colaboradorId) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()

    const { data: colaborador } = await supabase
        .from('colaboradores')
        .select('cargo_atual, nucleo_atual')
        .eq('id', colaboradorId)
        .single()

    const { data: mapeamentos } = await supabase.from('pdi_cargos').select('papel_id, cargo_atual, nucleo_atual')
    const papelId = resolverPapelId(colaborador?.cargo_atual, colaborador?.nucleo_atual, mapeamentos || [])

    if (!papelId) {
        return NextResponse.json({ souLider: false, papelId: null, solicitacoes: [] })
    }

    const { data: solicitacoes, error } = await supabase
        .from('pdi_solicitacoes')
        .select('*, colaborador:colaborador_id(nome, nucleo_atual), pdi_solicitacao_lideres(papel_id, lider_id, aceito_em, lider:lider_id(nome))')
        .contains('cargos', [papelId])
        .neq('status', 'cancelado')
        .order('data', { ascending: true })

    if (error) {
        return NextResponse.json({ error: 'Erro ao buscar solicitações.' }, { status: 500 })
    }

    return NextResponse.json({ souLider: true, papelId, solicitacoes })
}
