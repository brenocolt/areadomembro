import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { calcularViagem, exigirMembroGasolina, precoDoMes } from '@/lib/gasolina-server'
import { lerViagem } from '../validar'

// Editar/excluir: só a própria viagem e só enquanto estiver Pendente (depois
// de solicitada, o valor já foi para o Monday).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function viagemPendenteDoMembro(supabase: any, id: string, colaboradorId: string) {
    const { data } = await supabase.from('gasolina_viagens').select('id, status')
        .eq('id', id).eq('colaborador_id', colaboradorId).maybeSingle()
    if (!data) return { ok: false as const, status: 404, error: 'Viagem não encontrada.' }
    if (data.status !== 'Pendente') return { ok: false as const, status: 409, error: `Só dá para mudar viagens pendentes (esta está "${data.status}").` }
    return { ok: true as const }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const { id } = await params
    const pode = await viagemPendenteDoMembro(supabase, id, acesso.colaboradorId)
    if (!pode.ok) return NextResponse.json({ error: pode.error }, { status: pode.status })

    const lido = await lerViagem(supabase, acesso.colaboradorId, await req.json().catch(() => ({})))
    if (!lido.ok) return NextResponse.json({ error: lido.error }, { status: lido.status })

    const calculo = calcularViagem(lido.viagem.distancia_km, lido.autonomia, await precoDoMes(supabase, lido.viagem.data_viagem))
    const { data, error } = await supabase
        .from('gasolina_viagens')
        .update({ ...lido.viagem, ...calculo, atualizado_em: new Date().toISOString() })
        .eq('id', id)
        .eq('status', 'Pendente')
        .select('*, veiculo:veiculo_id(modelo), centro:centro_custo_id(nome)')
        .maybeSingle()
    if (error) return NextResponse.json({ error: 'Erro ao salvar a viagem.' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'A viagem mudou de status enquanto você editava.' }, { status: 409 })
    return NextResponse.json({ viagem: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const { id } = await params
    const pode = await viagemPendenteDoMembro(supabase, id, acesso.colaboradorId)
    if (!pode.ok) return NextResponse.json({ error: pode.error }, { status: pode.status })

    const { error } = await supabase.from('gasolina_viagens').delete().eq('id', id).eq('status', 'Pendente')
    if (error) return NextResponse.json({ error: 'Erro ao excluir a viagem.' }, { status: 500 })
    return NextResponse.json({ ok: true })
}
