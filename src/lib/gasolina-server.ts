// Checagens de acesso das rotas /api/gasolina/* (o app usa a chave anon do
// Supabase, então é aqui que se decide quem pode o quê). Mesmo formato de
// retorno de exigirLider em src/lib/pdi-server.ts.
import { auth } from '@/auth'
import { podeGerirGasolina } from '@/lib/access-control'

type Resultado =
    | { ok: true, colaboradorId: string, gestor: boolean }
    | { ok: false, status: number, error: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function exigirMembroGasolina(supabase: any): Promise<Resultado> {
    const session = await auth()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const colaboradorId = (session?.user as any)?.colaborador_id as string | undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = (session?.user as any)?.role as string | undefined
    if (!colaboradorId) return { ok: false, status: 401, error: 'Não autenticado.' }

    const { data: colaborador } = await supabase
        .from('colaboradores')
        .select('cargo_atual, nucleo_atual, status')
        .eq('id', colaboradorId)
        .single()
    if (!colaborador || colaborador.status !== 'Ativo') {
        return { ok: false, status: 403, error: 'Acesso restrito a membros ativos.' }
    }
    return { ok: true, colaboradorId, gestor: podeGerirGasolina(colaborador, role) }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function exigirGestorGasolina(supabase: any): Promise<Resultado> {
    const acesso = await exigirMembroGasolina(supabase)
    if (acesso.ok && !acesso.gestor) {
        return { ok: false, status: 403, error: 'Apenas a Vice Presidência pode fazer isso.' }
    }
    return acesso
}
