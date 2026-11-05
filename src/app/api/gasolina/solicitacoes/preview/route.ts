import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirMembroGasolina, montarPreview } from '@/lib/gasolina-server'

// Prévia do que entra numa solicitação de reembolso (projeto/prospecção):
// viagens Pendentes com preço do mês definido; as outras aparecem como
// "fora desta solicitação" com o motivo.
export async function GET(req: NextRequest) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const centro = req.nextUrl.searchParams.get('centro')
    const projeto = req.nextUrl.searchParams.get('projeto')
    if (!centro || !projeto) return NextResponse.json({ error: 'Informe o centro de custo e o projeto.' }, { status: 400 })

    try {
        const [preview, pix] = await Promise.all([
            montarPreview(supabase, acesso.colaboradorId, centro, projeto),
            supabase.from('colaboradores').select('chave_pix').eq('id', acesso.colaboradorId).single(),
        ])
        return NextResponse.json({ ...preview, chave_pix: pix.data?.chave_pix ?? null })
    } catch {
        return NextResponse.json({ error: 'Erro ao montar a prévia.' }, { status: 500 })
    }
}
