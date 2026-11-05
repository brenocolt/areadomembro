import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirMembroGasolina } from '@/lib/gasolina-server'
import { COMBUSTIVEIS, lerNumero } from '@/lib/gasolina'

// GET: carros ativos do membro. ?todos=1 (só VP): carros de todos os membros.
export async function GET(req: NextRequest) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const todos = req.nextUrl.searchParams.get('todos') === '1'
    if (todos && !acesso.gestor) {
        return NextResponse.json({ error: 'Apenas a Vice Presidência pode ver os carros de todos.' }, { status: 403 })
    }

    let query = supabase
        .from('gasolina_veiculos')
        .select(todos
            ? '*, colaborador:colaborador_id(nome), alterado_por:autonomia_alterada_por(nome)'
            : '*')
        .eq('ativo', true)
        .order('criado_em', { ascending: true })
    if (!todos) query = query.eq('colaborador_id', acesso.colaboradorId)

    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Erro ao buscar os carros.' }, { status: 500 })
    return NextResponse.json({ veiculos: data ?? [] })
}

// POST: membro cadastra um carro (mesmos campos do Google Form de autonomia,
// sem a capacidade do tanque). A foto do painel é obrigatória.
export async function POST(req: NextRequest) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const body = await req.json().catch(() => ({}))
    const modelo = typeof body.modelo === 'string' ? body.modelo.trim() : ''
    const ano = body.ano === '' || body.ano == null ? null : lerNumero(body.ano)
    const combustivel = typeof body.combustivel === 'string' ? body.combustivel : ''
    const autonomia = lerNumero(body.autonomia_km_l)
    const foto = typeof body.foto_painel_url === 'string' ? body.foto_painel_url.trim() : ''
    const anoAtual = new Date().getFullYear()

    if (!modelo || modelo.length > 80) return NextResponse.json({ error: 'Informe o modelo do carro (até 80 caracteres).' }, { status: 400 })
    if (ano !== null && (!Number.isInteger(ano) || ano < 1970 || ano > anoAtual + 1)) {
        return NextResponse.json({ error: 'Ano inválido.' }, { status: 400 })
    }
    if (!(COMBUSTIVEIS as readonly string[]).includes(combustivel)) return NextResponse.json({ error: 'Escolha o combustível.' }, { status: 400 })
    if (autonomia === null || autonomia < 3 || autonomia > 40) {
        return NextResponse.json({ error: 'Autonomia inválida — informe quantos km o carro faz com 1 litro (entre 3 e 40).' }, { status: 400 })
    }
    if (!foto.startsWith('http')) return NextResponse.json({ error: 'Anexe a foto do painel mostrando a autonomia.' }, { status: 400 })

    const { data, error } = await supabase
        .from('gasolina_veiculos')
        .insert({
            colaborador_id: acesso.colaboradorId,
            modelo,
            ano,
            combustivel,
            autonomia_informada: autonomia,
            autonomia_km_l: autonomia,
            foto_painel_url: foto,
        })
        .select('*')
        .single()
    if (error) return NextResponse.json({ error: 'Erro ao cadastrar o carro.' }, { status: 500 })
    return NextResponse.json({ veiculo: data })
}
