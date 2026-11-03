import { NextResponse } from 'next/server'
import type { Session } from 'next-auth'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getUsersManagementTier, isAdmin } from '@/lib/access-control'

// Guardas de autorização usadas por server actions e rotas de API.
// Server actions ('use server') são endpoints públicos: o middleware NÃO
// as protege (matcher exclui /api e actions chegam por POST na página),
// então cada ação sensível precisa checar login e permissão por conta própria.

type Sessao = Session
type Resultado = { session: Sessao; role?: string; colaboradorId?: string } | { erro: string; status: 401 | 403 }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const dadosUsuario = (s: Sessao) => s.user as any

export async function exigirLogin(): Promise<Resultado> {
    const session = (await auth()) as Session | null
    if (!session?.user) return { erro: 'Não autorizado', status: 401 }
    const u = dadosUsuario(session)
    return { session, role: u?.role, colaboradorId: u?.colaborador_id }
}

// Gestão de Usuários: ADMIN sempre; senão exige o nível mínimo da matriz
// (ver getUsersManagementTier). Nível 1 = desligar/reativar/aprovar conta;
// nível 3 = ações destrutivas e de escopo global.
export async function exigirGestaoUsuarios(nivelMinimo: 1 | 2 | 3 = 1): Promise<Resultado> {
    const r = await exigirLogin()
    if ('erro' in r) return r
    if (isAdmin(r.role)) return r
    if (!r.colaboradorId) return { erro: 'Acesso negado', status: 403 }
    const { data: colab } = await createServerSupabaseClient()
        .from('colaboradores')
        .select('cargo_atual, nucleo_atual, status')
        .eq('id', r.colaboradorId)
        .single()
    if (!colab || colab.status === 'Desligado') return { erro: 'Acesso negado', status: 403 }
    if (getUsersManagementTier(colab.cargo_atual, colab.nucleo_atual) < nivelMinimo) {
        return { erro: 'Acesso negado', status: 403 }
    }
    return r
}

export function respostaErro(r: { erro: string; status: 401 | 403 }) {
    return NextResponse.json({ error: r.erro }, { status: r.status })
}
