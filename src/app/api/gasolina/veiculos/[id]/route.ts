import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirGestorGasolina, exigirMembroGasolina, recalcularPendentes } from '@/lib/gasolina-server'
import { lerNumero } from '@/lib/gasolina'

// PATCH: só a VP corrige a autonomia (o membro, se precisar mudar, exclui e
// cadastra de novo com uma nova foto do painel).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirGestorGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const autonomia = lerNumero(body.autonomia_km_l)
    if (autonomia === null || autonomia < 3 || autonomia > 40) {
        return NextResponse.json({ error: 'Autonomia inválida (entre 3 e 40 km/L).' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('gasolina_veiculos')
        .update({
            autonomia_km_l: autonomia,
            autonomia_alterada_por: acesso.colaboradorId,
            autonomia_alterada_em: new Date().toISOString(),
            atualizado_em: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('ativo', true)
        .select('*')
        .maybeSingle()
    if (error) return NextResponse.json({ error: 'Erro ao alterar a autonomia.' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Carro não encontrado.' }, { status: 404 })

    // A correção vale para as viagens ainda pendentes feitas com esse carro.
    const recalculadas = await recalcularPendentes(supabase, { veiculoId: id })
    return NextResponse.json({ veiculo: data, recalculadas })
}

// DELETE: o membro exclui o próprio carro. Fica guardado como inativo para
// não perder o histórico das viagens feitas com ele.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const { id } = await params
    const agora = new Date().toISOString()
    const { data, error } = await supabase
        .from('gasolina_veiculos')
        .update({ ativo: false, excluido_em: agora, atualizado_em: agora })
        .eq('id', id)
        .eq('colaborador_id', acesso.colaboradorId)
        .eq('ativo', true)
        .select('id')
        .maybeSingle()
    if (error) return NextResponse.json({ error: 'Erro ao excluir o carro.' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Carro não encontrado.' }, { status: 404 })
    return NextResponse.json({ ok: true })
}
