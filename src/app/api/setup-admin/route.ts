import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export async function POST() {
    const supabase = createServerSupabaseClient();

    const adminEmail = 'admin@produtiva.com';
    const adminPassword = 'admin123';

    // Check if admin already exists
    const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('email', adminEmail)
        .single();

    if (existing) {
        // Update role to ADMIN
        await supabase.from('users').update({ role: 'ADMIN' }).eq('email', adminEmail);
        return NextResponse.json({ message: 'Admin already exists, role updated to ADMIN.' });
    }

    const hashedPassword = await bcrypt.hash(adminPassword, 10);

    // Create colaborador first
    const { data: col, error: colErr } = await supabase.from('colaboradores').insert({
        nome: 'Administrador',
        email_corporativo: adminEmail,
        matricula: 'ADM-001',
        cargo_atual: 'Administrador',
        nucleo_atual: 'Gestão',
        pontos_acumulados: 0,
        milhas: 0,
        nivel_consultor: 'Admin',
        saldo_pipj: 0,
        projetos: 0,
        paginas_permitidas: null, // null = full access
    }).select('id').single();

    if (colErr) {
        return NextResponse.json({ error: 'Error creating colaborador: ' + colErr.message }, { status: 500 });
    }

    // Create user with same id & ADMIN role
    const { error: userErr } = await supabase.from('users').insert({
        id: col.id,
        email: adminEmail,
        senha: hashedPassword,
        role: 'ADMIN',
        colaborador_id: col.id,
    });

    if (userErr) {
        return NextResponse.json({ error: 'Error creating user: ' + userErr.message }, { status: 500 });
    }

    return NextResponse.json({
        message: 'Admin account created!',
        email: adminEmail,
        password: adminPassword,
    });
}
