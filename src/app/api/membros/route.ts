import { exigirLogin, respostaErro } from '@/lib/require-auth'
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
    const login = await exigirLogin()
    if ('erro' in login) return respostaErro(login)

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
