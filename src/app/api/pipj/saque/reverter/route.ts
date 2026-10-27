import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirAcessoPipj } from '@/lib/pipj-acesso'
import { ErroPipj, reverterSaqueAprovado } from '@/lib/pipj-saque'

// Reverte um saque de PIPJ já aprovado: devolve o saldo e reabre a solicitação como PENDENTE.
export async function POST(request: Request) {
    try {
        const acesso = await exigirAcessoPipj()
        if (acesso.erro) return acesso.erro

        const corpo = await request.json().catch(() => ({}))
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const user = acesso.session!.user as any
        const resultado = await reverterSaqueAprovado(createServerSupabaseClient(), {
            id: typeof corpo.id === 'string' ? corpo.id : '',
            motivo: typeof corpo.motivo === 'string' ? corpo.motivo : '',
            ator: user?.name || user?.email || 'Sistema',
        })
        return NextResponse.json({ success: true, ...resultado })
    } catch (error) {
        if (error instanceof ErroPipj) return NextResponse.json({ error: error.message }, { status: error.status })
        console.error('PIPJ reverter saque error:', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : 'Erro interno' }, { status: 500 })
    }
}
