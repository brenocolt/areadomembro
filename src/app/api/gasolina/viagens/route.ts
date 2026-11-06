import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { calcularViagem, exigirMembroGasolina, precoDoMes } from '@/lib/gasolina-server'
import { STATUS_VIAGEM } from '@/lib/gasolina'
import { lerViagem } from './validar'

const CAMPOS = '*, veiculo:veiculo_id(modelo), centro:centro_custo_id(nome), solicitacao:solicitacao_id(id, status, motivo_recusa)'

// GET: viagens do membro. ?todos=1 (só VP): de todos os membros, com filtros
// opcionais ?colaborador=, ?status=, ?mes=AAAA-MM.
export async function GET(req: NextRequest) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const params = req.nextUrl.searchParams
    const todos = params.get('todos') === '1'
    if (todos && !acesso.gestor) {
        return NextResponse.json({ error: 'Apenas a Vice Presidência pode ver as viagens de todos.' }, { status: 403 })
    }

    let query = supabase
        .from('gasolina_viagens')
        .select(todos ? `${CAMPOS}, colaborador:colaborador_id(nome)` : CAMPOS)
        .order('data_viagem', { ascending: false })
        .order('criado_em', { ascending: false })
        .limit(2000)

    if (!todos) {
        query = query.eq('colaborador_id', acesso.colaboradorId)
    } else {
        const colaborador = params.get('colaborador')
        const status = params.get('status')
        const mes = params.get('mes')
        if (colaborador) query = query.eq('colaborador_id', colaborador)
        if (status && (STATUS_VIAGEM as readonly string[]).includes(status)) query = query.eq('status', status)
        if (mes && /^\d{4}-\d{2}$/.test(mes)) {
            const [a, m] = mes.split('-').map(Number)
            query = query.gte('data_viagem', `${mes}-01`).lte('data_viagem', new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10))
        }
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Erro ao buscar as viagens.' }, { status: 500 })
    return NextResponse.json({ viagens: data ?? [] })
}

// POST: membro lança uma viagem. Litros e valor são calculados aqui (nunca
// confiamos no que vem do navegador).
export async function POST(req: NextRequest) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const lido = await lerViagem(supabase, acesso.colaboradorId, await req.json().catch(() => ({})))
    if (!lido.ok) return NextResponse.json({ error: lido.error }, { status: lido.status })

    const calculo = calcularViagem(lido.viagem.distancia_km, lido.autonomia, await precoDoMes(supabase, lido.viagem.data_viagem))
    const { data, error } = await supabase
        .from('gasolina_viagens')
        .insert({ ...lido.viagem, ...calculo, colaborador_id: acesso.colaboradorId, status: 'Pendente', origem: 'app' })
        .select(CAMPOS)
        .single()
    if (error) return NextResponse.json({ error: 'Erro ao lançar a viagem.' }, { status: 500 })
    return NextResponse.json({ viagem: data })
}
