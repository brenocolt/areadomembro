import { createServerSupabaseClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

export async function GET() {
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
