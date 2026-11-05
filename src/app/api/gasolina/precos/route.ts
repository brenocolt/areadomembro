import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirGestorGasolina, exigirMembroGasolina } from '@/lib/gasolina-server'
import { lerNumero } from '@/lib/gasolina'

// Preço médio do litro por mês (antiga aba "Histórico de preços").
export async function GET() {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const { data, error } = await supabase
        .from('gasolina_precos')
        .select('*, atualizado_por_colab:atualizado_por(nome)')
        .order('mes', { ascending: false })
    if (error) return NextResponse.json({ error: 'Erro ao buscar os preços.' }, { status: 500 })
    return NextResponse.json({ precos: data ?? [] })
}

// PUT: VP lança ou corrige o preço de um mês ({ mes: "2026-10", preco_litro }).
export async function PUT(req: NextRequest) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirGestorGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const body = await req.json().catch(() => ({}))
    const mes = typeof body.mes === 'string' ? body.mes.trim() : ''
    const preco = lerNumero(body.preco_litro)
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(mes)) return NextResponse.json({ error: 'Escolha o mês.' }, { status: 400 })
    if (preco === null || preco < 1 || preco > 30) {
        return NextResponse.json({ error: 'Preço inválido — informe o valor do litro em reais (ex.: 6,49).' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from('gasolina_precos')
        .upsert({
            mes: `${mes}-01`,
            preco_litro: preco,
            atualizado_por: acesso.colaboradorId,
            atualizado_em: new Date().toISOString(),
        })
        .select('*')
        .single()
    if (error) return NextResponse.json({ error: 'Erro ao salvar o preço.' }, { status: 500 })
    return NextResponse.json({ preco: data })
}
