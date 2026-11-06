import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirMembroGasolina } from '@/lib/gasolina-server'
import { calcularRota, dentroDoLimite, mapsAtivo } from '@/lib/google-maps'

// POST { origem, destino, paradas[], ida_e_volta } → distância de carro pela rota.
export async function POST(req: NextRequest) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })
    if (!mapsAtivo()) return NextResponse.json({ error: 'O cálculo pelo Google Maps não está ligado. Informe os km manualmente.' }, { status: 503 })
    if (!dentroDoLimite(`rota:${acesso.colaboradorId}`, 15)) {
        return NextResponse.json({ error: 'Muitos cálculos em pouco tempo. Espere um minuto e tente de novo.' }, { status: 429 })
    }

    const body = await req.json().catch(() => ({}))
    const texto = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, 200) : '')
    const origem = texto(body.origem)
    const destino = texto(body.destino)
    const paradas = (Array.isArray(body.paradas) ? body.paradas : []).map(texto).filter(Boolean).slice(0, 10)
    if (!origem || !destino) return NextResponse.json({ error: 'Informe o local de saída e o de chegada.' }, { status: 400 })

    try {
        const rota = await calcularRota(origem, paradas, destino, body.ida_e_volta === true)
        if (!rota) return NextResponse.json({ error: 'O Google Maps não encontrou uma rota de carro entre esses endereços. Confira os endereços ou informe os km manualmente.' }, { status: 422 })
        return NextResponse.json({ rota })
    } catch (err) {
        console.error('[gasolina] Falha ao calcular rota no Google:', err)
        const motivo = err instanceof Error ? err.message : String(err)
        return NextResponse.json({ error: `Não foi possível calcular a rota agora (${motivo}). Informe os km manualmente.` }, { status: 502 })
    }
}
