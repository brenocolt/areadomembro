import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';
import { bloquearSemPagina } from '@/lib/server-auth'

export async function GET() {
  const bloqueio = await bloquearSemPagina('/users-management')
  if (bloqueio) return bloqueio
    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
        .from('membros_pre_cadastro')
        .select('id, nome, email_corporativo, cargo, pontos_acumulados, milhas')
        .eq('conta_criada', false)
        .order('nome', { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}
