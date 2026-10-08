import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirLider, lerItemDoBanco } from '@/lib/pdi-server'

// Editar e excluir: só quem criou o item (ou um administrador).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function carregarComPermissao(id: string): Promise<{ ok: true, supabase: any, tipo: string } | { ok: false, res: NextResponse }> {
    const session = await auth()
    const supabase = createServerSupabaseClient()
    const acesso = await exigirLider(supabase, (session?.user as any)?.colaborador_id)
    if (!acesso.ok) return { ok: false, res: NextResponse.json({ error: acesso.error }, { status: acesso.status }) }

    const { data: item } = await supabase.from('pdi_banco_itens').select('autor_id, tipo').eq('id', id).single()
    if (!item) return { ok: false, res: NextResponse.json({ error: 'Item não encontrado.' }, { status: 404 }) }
    const isAdmin = (session?.user as any)?.role === 'ADMIN'
    if (item.autor_id !== acesso.colaboradorId && !isAdmin) {
        return { ok: false, res: NextResponse.json({ error: 'Só quem criou o item pode alterá-lo.' }, { status: 403 }) }
    }
    return { ok: true, supabase, tipo: item.tipo }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const r = await carregarComPermissao(id)
    if (!r.ok) return r.res

    const lido = lerItemDoBanco(await req.json(), r.tipo)
    if (!lido.ok) return NextResponse.json({ error: lido.error }, { status: 400 })

    const { data, error } = await r.supabase
        .from('pdi_banco_itens')
        .update({ ...lido.item, atualizado_em: new Date().toISOString() })
        .eq('id', id)
        .select('*, autor:autor_id(nome)')
        .single()
    if (error || !data) return NextResponse.json({ error: 'Erro ao salvar.', detalhe: error?.message }, { status: 500 })
    return NextResponse.json({ item: data })
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const r = await carregarComPermissao(id)
    if (!r.ok) return r.res

    const { error } = await r.supabase.from('pdi_banco_itens').delete().eq('id', id)
    if (error) return NextResponse.json({ error: 'Erro ao excluir.', detalhe: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
}
