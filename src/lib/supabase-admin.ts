import { createClient } from '@supabase/supabase-js'

// Cliente com a service role: ignora RLS. SÓ pode ser usado em código de
// servidor (rotas de API / server components), depois de validar a sessão e a
// permissão do usuário. A chave não tem prefixo NEXT_PUBLIC_, então nunca vai
// para o bundle do navegador.
export class ConfiguracaoPendenteError extends Error {
    constructor(mensagem: string) {
        super(mensagem)
        this.name = 'ConfiguracaoPendenteError'
    }
}

export interface IdentidadeAuditoria {
    id?: string | null
    email: string
}

// Cabeçalhos HTTP só aceitam ASCII imprimível: qualquer outro caractere é escapado.
const ascii = (v: string) => (/^[\x20-\x7E]*$/.test(v) ? v : encodeURIComponent(v))

/**
 * @param identidade quem está agindo. É enviada ao PostgREST nos cabeçalhos x-app-usuario-*, que os triggers
 *                   de auditoria do banco leem (current_setting('request.headers')) para gravar o autor.
 */
export function createAdminSupabaseClient(identidade?: IdentidadeAuditoria) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
        throw new ConfiguracaoPendenteError(
            'Configuração do servidor pendente: defina SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente do servidor.',
        )
    }
    const headers: Record<string, string> = {}
    if (identidade) {
        headers['x-app-usuario-email'] = ascii(identidade.email)
        if (identidade.id) headers['x-app-usuario-id'] = ascii(identidade.id)
    }
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers } })
}
