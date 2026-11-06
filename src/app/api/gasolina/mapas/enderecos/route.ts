import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirMembroGasolina } from '@/lib/gasolina-server'
import { dentroDoLimite, mapsAtivo, sugerirEnderecos } from '@/lib/google-maps'

// GET ?q=texto → até 5 sugestões de endereço (Google Places).
export async function GET(req: NextRequest) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })
    if (!mapsAtivo()) return NextResponse.json({ sugestoes: [] })

    const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 150)
    if (q.length < 3) return NextResponse.json({ sugestoes: [] })
    if (!dentroDoLimite(`end:${acesso.colaboradorId}`, 40)) return NextResponse.json({ sugestoes: [] })

    try {
        return NextResponse.json({ sugestoes: await sugerirEnderecos(q) })
    } catch (err) {
        console.error('[gasolina] Falha no autocomplete do Google:', err)
        return NextResponse.json({ sugestoes: [] })   // sem sugestão, o membro digita normalmente
    }
}
