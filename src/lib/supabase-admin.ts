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

export function createAdminSupabaseClient() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
        throw new ConfiguracaoPendenteError(
            'Configuração do servidor pendente: defina SUPABASE_SERVICE_ROLE_KEY nas variáveis de ambiente do servidor.',
        )
    }
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })
}
