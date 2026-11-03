import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
// Chave exclusiva do servidor (nunca vai para o navegador: sem prefixo NEXT_PUBLIC_).
// Com ela o servidor ignora RLS, o que permite fechar as regras do banco para o anon.
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

let avisouFallback = false

export function createServerSupabaseClient() {
    if (supabaseServiceKey) {
        return createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false, autoRefreshToken: false },
        })
    }
    if (!avisouFallback && process.env.NODE_ENV === 'production') {
        avisouFallback = true
        console.warn('[seguranca] SUPABASE_SERVICE_ROLE_KEY ausente: servidor usando a chave anon. Defina a variável antes de aplicar a migração 20261103_fecha_rls_tabelas_sensiveis.sql.')
    }
    return createClient(supabaseUrl, supabaseAnonKey)
}
