import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirGestorGasolina } from '@/lib/gasolina-server'

// POST { motivo }: a VP invalida o carro de um membro (tentativa de fraude).
// O carro sai de uso (ativo = false) e guarda quem, quando e por quê.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirGestorGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const { id } = await params
    const body = await req.json().catch(() => ({}))
    const motivo = typeof body.motivo === 'string' ? body.motivo.trim().slice(0, 500) : ''
    if (motivo.length < 5) return NextResponse.json({ error: 'Escreva o motivo da invalidação (o membro vai ver).' }, { status: 400 })

    const agora = new Date().toISOString()
    const { data, error } = await supabase.from('gasolina_veiculos')
        .update({ ativo: false, invalidado_em: agora, invalidado_por: acesso.colaboradorId, motivo_invalidacao: motivo, atualizado_em: agora })
        .eq('id', id).eq('ativo', true)
        .select('id').maybeSingle()
    if (error) return NextResponse.json({ error: 'Erro ao invalidar o carro.' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Carro não encontrado ou já fora de uso.' }, { status: 404 })
    return NextResponse.json({ ok: true })
}

// DELETE: a VP desfaz a invalidação (carro volta a valer).
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirGestorGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const { id } = await params
    const { data, error } = await supabase.from('gasolina_veiculos')
        .update({ ativo: true, invalidado_em: null, invalidado_por: null, motivo_invalidacao: null, atualizado_em: new Date().toISOString() })
        .eq('id', id).not('invalidado_em', 'is', null)
        .select('id').maybeSingle()
    if (error) return NextResponse.json({ error: 'Erro ao reativar o carro.' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Carro não encontrado ou não está invalidado.' }, { status: 404 })
    return NextResponse.json({ ok: true })
}
