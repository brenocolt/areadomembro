import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { paginaPermitida } from '@/lib/access-control'

// Mesma regra de acesso da rota de aprovação de saques: ADMIN, ou quem tem acesso à página /pipj-management.
// Devolve a sessão (autorizado) ou a resposta 401/403 pronta.
export async function exigirAcessoPipj() {
    const session = await auth()
    if (!session) return { erro: NextResponse.json({ error: 'Não autorizado' }, { status: 401 }) }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = session.user as any
    const role = user?.role
    if (role === 'ADMIN' || role === 'admin') return { session }

    const colaboradorId = user?.colaborador_id
    if (!colaboradorId) return { erro: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) }
    const { data: colab } = await createServerSupabaseClient()
        .from('colaboradores')
        .select('cargo_atual, nucleo_atual, paginas_permitidas')
        .eq('id', colaboradorId)
        .single()
    if (!paginaPermitida('/pipj-management', colab, role)) return { erro: NextResponse.json({ error: 'Acesso negado' }, { status: 403 }) }
    return { session }
}
