import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirMembroGasolina } from '@/lib/gasolina-server'
import { validarChavePix } from '@/lib/gasolina'

// Chave Pix do próprio membro — vai automaticamente no card do Monday.
export async function GET() {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const { data, error } = await supabase.from('colaboradores').select('chave_pix').eq('id', acesso.colaboradorId).single()
    if (error) return NextResponse.json({ error: 'Erro ao buscar a chave Pix.' }, { status: 500 })
    return NextResponse.json({ chave_pix: data?.chave_pix ?? null })
}

export async function PATCH(req: NextRequest) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const body = await req.json().catch(() => ({}))
    const validacao = validarChavePix(typeof body.chave_pix === 'string' ? body.chave_pix : '')
    if (!validacao.ok) return NextResponse.json({ error: validacao.error }, { status: 400 })

    const { error } = await supabase.from('colaboradores').update({ chave_pix: validacao.chave }).eq('id', acesso.colaboradorId)
    if (error) return NextResponse.json({ error: 'Erro ao salvar a chave Pix.' }, { status: 500 })
    return NextResponse.json({ chave_pix: validacao.chave, tipo: validacao.tipo })
}
