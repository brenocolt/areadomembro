import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient, ConfiguracaoPendenteError } from '@/lib/supabase-admin'
import {
    avaliarAcessoReconhecimentos,
    type ColaboradorDb,
    type ResultadoAcesso,
    type UsuarioAutorizado,
    type UsuarioDb,
} from './acesso-servidor'
import { ErroDeRequisicao } from './erros'

// Identidade (users/colaboradores) é lida com o mesmo cliente que o resto do
// sistema usa; os DADOS da aba só são lidos/gravados com a service role.
export async function obterAcessoReconhecimentos(): Promise<ResultadoAcesso> {
    const sessao = await auth()
    const supabase = createServerSupabaseClient()
    return avaliarAcessoReconhecimentos(sessao, {
        async buscarUsuario(id) {
            const { data } = await supabase.from('users').select('id, email, role, colaborador_id').eq('id', id).maybeSingle()
            return (data as UsuarioDb | null) ?? null
        },
        async buscarColaborador(id) {
            const { data } = await supabase
                .from('colaboradores')
                .select('id, nome, cargo_atual, nucleo_atual, paginas_permitidas, status')
                .eq('id', id)
                .maybeSingle()
            return (data as ColaboradorDb | null) ?? null
        },
    })
}

export interface ContextoReconhecimentos {
    usuario: UsuarioAutorizado
    db: ReturnType<typeof createAdminSupabaseClient>
}

export type RespostaErro = { error: string; detalhe?: string }

// Envolve uma rota: exige sessão + VP/ADMIN ANTES de qualquer acesso a dados
// e converte falhas previsíveis em respostas JSON.
export async function comAcessoReconhecimentos(
    handler: (ctx: ContextoReconhecimentos) => Promise<Response>,
): Promise<Response> {
    const acesso = await obterAcessoReconhecimentos()
    if (!acesso.ok) return NextResponse.json({ error: acesso.erro }, { status: acesso.status })
    try {
        const db = createAdminSupabaseClient()
        return await handler({ usuario: acesso.usuario, db })
    } catch (e) {
        if (e instanceof ConfiguracaoPendenteError) {
            return NextResponse.json({ error: e.message, configuracaoPendente: true }, { status: 503 })
        }
        if (e instanceof ErroDeRequisicao) {
            return NextResponse.json({ error: e.message }, { status: e.status })
        }
        console.error('[reconhecimentos]', e)
        return NextResponse.json({ error: e instanceof Error ? e.message : 'Erro interno.' }, { status: 500 })
    }
}
