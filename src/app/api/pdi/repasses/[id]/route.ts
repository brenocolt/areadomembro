import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirLider } from '@/lib/pdi-server'
import { confirmarRepasse, cancelarRepasse } from '@/lib/pdi-repasses'

// PATCH { action: 'confirmar' | 'cancelar' } — só o responsável (ou admin).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    const session = await auth()
    const supabase = createServerSupabaseClient()
    const acesso = await exigirLider(supabase, (session?.user as { colaborador_id?: string } | undefined)?.colaborador_id)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })
    const isAdmin = (session?.user as { role?: string } | undefined)?.role === 'ADMIN'

    const { action } = await req.json()
    if (action !== 'confirmar' && action !== 'cancelar') return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })

    const r = action === 'confirmar'
        ? await confirmarRepasse(supabase, id, acesso.colaboradorId, isAdmin)
        : await cancelarRepasse(supabase, id, acesso.colaboradorId, isAdmin)
    if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
    return NextResponse.json({ success: true, agenda: r.agenda ?? null, aviso: r.aviso ?? null })
}
