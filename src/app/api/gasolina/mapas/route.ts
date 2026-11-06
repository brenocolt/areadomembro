import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirMembroGasolina } from '@/lib/gasolina-server'
import { mapsAtivo } from '@/lib/google-maps'

// O formulário de viagem pergunta se o Google Maps está ligado (chave
// configurada no servidor) para mostrar sugestões e o botão de calcular km.
export async function GET() {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })
    return NextResponse.json({ ativo: mapsAtivo() })
}
