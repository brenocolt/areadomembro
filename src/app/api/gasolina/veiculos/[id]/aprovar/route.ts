import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirGestorGasolina } from '@/lib/gasolina-server'

// POST: a VP aprova o carro de um membro (depois de conferir a foto do painel
// e a autonomia). Só então ele pode ser usado para lançar viagens.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirGestorGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const { id } = await params
    const agora = new Date().toISOString()
    const { data, error } = await supabase.from('gasolina_veiculos')
        .update({ aprovado_em: agora, aprovado_por: acesso.colaboradorId, atualizado_em: agora })
        .eq('id', id).eq('ativo', true).is('aprovado_em', null)
        .select('id').maybeSingle()
    if (error) return NextResponse.json({ error: 'Erro ao aprovar o carro.' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Carro não encontrado ou já aprovado.' }, { status: 404 })
    return NextResponse.json({ ok: true })
}
