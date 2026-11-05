import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirGestorGasolina } from '@/lib/gasolina-server'
import { lerCentroCusto } from '../validar'

// Editar ou desativar (ativo=false) um centro de custo. Não há exclusão:
// viagens e solicitações antigas continuam apontando para ele.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirGestorGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const { id } = await params
    const lido = lerCentroCusto(await req.json().catch(() => ({})))
    if (!lido.ok) return NextResponse.json({ error: lido.error }, { status: 400 })

    const { data, error } = await supabase
        .from('gasolina_centros_custo')
        .update({ ...lido.centro, atualizado_em: new Date().toISOString() })
        .eq('id', id)
        .select('*')
        .maybeSingle()
    if (error) return NextResponse.json({ error: 'Erro ao salvar o centro de custo.' }, { status: 500 })
    if (!data) return NextResponse.json({ error: 'Centro de custo não encontrado.' }, { status: 404 })
    return NextResponse.json({ centro: data })
}
