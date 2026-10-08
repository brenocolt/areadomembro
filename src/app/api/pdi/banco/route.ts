import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirAcessoBancos, lerItemDoBanco } from '@/lib/pdi-server'
import { PDI_BANCO_TIPOS, type PdiBancoTipo } from '@/lib/pdi'

export async function GET(req: NextRequest) {
    const session = await auth()
    const supabase = createServerSupabaseClient()
    const acesso = await exigirAcessoBancos(supabase, (session?.user as any)?.colaborador_id)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const tipo = req.nextUrl.searchParams.get('tipo')
    let query = supabase
        .from('pdi_banco_itens')
        .select('*, autor:autor_id(nome)')
        .order('criado_em', { ascending: false })
    if (tipo) {
        if (!PDI_BANCO_TIPOS.includes(tipo as PdiBancoTipo)) return NextResponse.json({ error: 'Tipo inválido.' }, { status: 400 })
        query = query.eq('tipo', tipo)
    }
    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Erro ao buscar itens.', detalhe: error.message }, { status: 500 })
    return NextResponse.json({ itens: data })
}

export async function POST(req: NextRequest) {
    const session = await auth()
    const supabase = createServerSupabaseClient()
    const acesso = await exigirAcessoBancos(supabase, (session?.user as any)?.colaborador_id)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const body = await req.json()
    if (!PDI_BANCO_TIPOS.includes(body.tipo)) return NextResponse.json({ error: 'Tipo inválido.' }, { status: 400 })
    const lido = lerItemDoBanco(body)
    if (!lido.ok) return NextResponse.json({ error: lido.error }, { status: 400 })

    const { data, error } = await supabase
        .from('pdi_banco_itens')
        .insert({ tipo: body.tipo, ...lido.item, autor_id: acesso.colaboradorId })
        .select('*, autor:autor_id(nome)')
        .single()
    if (error || !data) return NextResponse.json({ error: 'Erro ao salvar.', detalhe: error?.message }, { status: 500 })
    return NextResponse.json({ item: data })
}
