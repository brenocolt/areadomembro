// Decisão de acesso à aba Reconhecimentos no servidor, com as consultas
// injetadas para poder ser testada sem next-auth/Supabase.
//
// Regras (todas validadas no servidor, a cada requisição):
//  * sem sessão -> 401;
//  * o papel (role) e o vínculo com o colaborador vêm do BANCO (tabela users),
//    nunca do token da sessão, que pode estar defasado;
//  * ADMIN -> liberado;
//  * senão, só colaborador ATIVO com nucleo_atual = Vice Presidência;
//  * cargo Estratégico de outros núcleos e `paginas_permitidas` NÃO liberam.
import { podeAcessarRotaExclusivaVP, type AccessColaborador } from '@/lib/access-control'

export interface SessaoMinima {
    user?: { id?: string | null } | null
}

export interface UsuarioDb {
    id: string
    email: string
    role: string | null
    colaborador_id: string | null
}

export interface ColaboradorDb extends AccessColaborador {
    id: string
    nome?: string | null
    email_corporativo?: string | null
}

export interface DependenciasAcesso {
    buscarUsuario(id: string): Promise<UsuarioDb | null>
    buscarColaborador(id: string): Promise<ColaboradorDb | null>
}

export interface UsuarioAutorizado {
    id: string
    email: string
    nome: string
    role: string
    colaboradorId: string | null
}

export type ResultadoAcesso =
    | { ok: true; usuario: UsuarioAutorizado }
    | { ok: false; status: 401 | 403; erro: string }

export async function avaliarAcessoReconhecimentos(
    sessao: SessaoMinima | null | undefined,
    deps: DependenciasAcesso,
): Promise<ResultadoAcesso> {
    const userId = sessao?.user?.id
    if (!userId) return { ok: false, status: 401, erro: 'Não autenticado.' }

    const usuario = await deps.buscarUsuario(userId)
    if (!usuario) return { ok: false, status: 401, erro: 'Não autenticado.' }

    const colaborador = usuario.colaborador_id ? await deps.buscarColaborador(usuario.colaborador_id) : null

    if (!podeAcessarRotaExclusivaVP(colaborador, usuario.role)) {
        return { ok: false, status: 403, erro: 'Acesso restrito à Vice Presidência.' }
    }

    return {
        ok: true,
        usuario: {
            id: usuario.id,
            email: usuario.email,
            nome: colaborador?.nome || usuario.email,
            role: usuario.role || '',
            colaboradorId: usuario.colaborador_id,
        },
    }
}
