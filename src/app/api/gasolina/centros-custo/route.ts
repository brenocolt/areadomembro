import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirGestorGasolina, exigirMembroGasolina } from '@/lib/gasolina-server'
import { lerCentroCusto } from './validar'

// GET: membros veem só os ativos; a VP vê todos (para reativar).
export async function GET() {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    let query = supabase.from('gasolina_centros_custo').select('*').order('ordem').order('nome')
    if (!acesso.gestor) query = query.eq('ativo', true)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Erro ao buscar os centros de custo.' }, { status: 500 })
    return NextResponse.json({ centros: data ?? [] })
}

export async function POST(req: NextRequest) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirGestorGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const lido = lerCentroCusto(await req.json().catch(() => ({})))
    if (!lido.ok) return NextResponse.json({ error: lido.error }, { status: 400 })

    const { data, error } = await supabase.from('gasolina_centros_custo').insert(lido.centro).select('*').single()
    if (error) return NextResponse.json({ error: 'Erro ao criar o centro de custo.' }, { status: 500 })
    return NextResponse.json({ centro: data })
}
