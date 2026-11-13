// Cliente Supabase com a chave service_role — SÓ PARA O SERVIDOR.
// Nunca importe este arquivo em componente "use client": a chave daria
// acesso total ao banco. Ela fica só no Coolify (SUPABASE_SERVICE_ROLE_KEY),
// sem o prefixo NEXT_PUBLIC_, então o Next nunca a envia ao navegador.
//
// Hoje só as rotas /api/pagamentos/* usam este cliente (as tabelas
// pagamentos_* têm RLS sem políticas e não aceitam a chave anon).
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let cache: SupabaseClient | null = null

export function createAdminSupabaseClient(): SupabaseClient | null {
    if (typeof window !== 'undefined') throw new Error('supabase-admin não pode rodar no navegador.')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const chave = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !chave) return null
    if (!cache) cache = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } })
    return cache
}
