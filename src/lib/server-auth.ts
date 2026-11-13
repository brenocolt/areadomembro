// Conferência de quem está chamando, para Server Actions ('use server').
//
// Uma Server Action é um endereço público: qualquer pessoa pode chamá-la
// direto, sem abrir a tela que a usa. Por isso cada action precisa conferir
// a sessão e a permissão por conta própria — esconder o botão na tela não
// protege nada.
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getUsersManagementTier, isAdmin, paginaPermitida, type AccessColaborador } from '@/lib/access-control'

export type Chamador = {
    colaboradorId: string | null
    role: string | null
    colaborador: AccessColaborador | null
}

export async function obterChamador(): Promise<Chamador | null> {
    const session = await auth()
    if (!session?.user) return null
    const user = session.user as { role?: string | null, colaborador_id?: string | null }
    const colaboradorId = user.colaborador_id ?? null
    let colaborador: AccessColaborador | null = null
    if (colaboradorId) {
        const supabase = createServerSupabaseClient()
        const { data } = await supabase
            .from('colaboradores')
            .select('cargo_atual, nucleo_atual, paginas_permitidas')
            .eq('id', colaboradorId)
            .maybeSingle()
        colaborador = (data as AccessColaborador | null) ?? null
    }
    return { colaboradorId, role: user.role ?? null, colaborador }
}

// Quem pode abrir a página também pode usar as actions dela.
export async function exigirPagina(pathname: string): Promise<Chamador | null> {
    const chamador = await obterChamador()
    if (!chamador) return null
    return paginaPermitida(pathname, chamador.colaborador, chamador.role) ? chamador : null
}

export function nivelGestaoUsuarios(chamador: Chamador): 0 | 1 | 2 | 3 {
    if (isAdmin(chamador.role)) return 3
    return getUsersManagementTier(chamador.colaborador?.cargo_atual, chamador.colaborador?.nucleo_atual)
}

export const SEM_PERMISSAO = 'Você não tem permissão para fazer isso. Entre de novo no portal e tente outra vez.'
