'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import { createServerSupabaseClient } from '@/lib/supabase-server';

// Define schema for input validation if needed, but we do it in client too.

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', {
            email: formData.get('email'),
            password: formData.get('password'),
            redirect: false,
        });
    } catch (error) {
        if (error instanceof AuthError) {
            switch (error.type) {
                case 'CredentialsSignin':
                    return 'Credenciais inválidas.';
                default:
                    return 'Algo deu errado. Tente novamente.';
            }
        }
        throw error;
    }
    redirect('/');
}

export async function resetPasswordLocal(email: string, dataNascimento: string, cpf: string) {
    const supabase = createServerSupabaseClient();
    
    // 1. Fetch colleague from colaboradores
    const { data: colab, error: colabErr } = await supabase
        .from('colaboradores')
        .select('id, cpf, data_nascimento')
        .eq('email_corporativo', email)
        .single();
        
    if (colabErr || !colab) {
        return { success: false, message: 'Usuário não encontrado no banco de dados.' };
    }
    
    // 2. Format and compare CPF
    const rawCpfDb = colab.cpf ? String(colab.cpf).replace(/\D/g, '') : '';
    const rawCpfInput = cpf ? String(cpf).replace(/\D/g, '') : '';
    if (rawCpfDb !== rawCpfInput) {
        return { success: false, message: 'O CPF informado não confere com o cadastro.' };
    }
    
    // 3. Format and compare data de nascimento
    // Form input comes as DD/MM/YYYY, DB is typically YYYY-MM-DD
    let dbDateString = '';
    if (colab.data_nascimento) {
        // e.g. "2000-12-31" to "31122000"
        const [y, m, d] = colab.data_nascimento.split('-');
        if (y && m && d) dbDateString = `${d}${m}${y}`;
    }
    const rawDateInput = dataNascimento ? String(dataNascimento).replace(/\D/g, '') : '';
    if (dbDateString !== rawDateInput && colab.data_nascimento !== rawDateInput) {
        return { success: false, message: 'A data de nascimento não confere com o cadastro.' };
    }

    const { data: user, error } = await supabase
        .from('users')
        .select('id')
        .eq('colaborador_id', colab.id)
        .single();
        
    if (error || !user) {
        return { success: false, message: 'Acesso de usuário não encontrado para este colaborador.' };
    }
    
    // Generating a random temporary password
    const tempPassword = Math.random().toString(36).slice(-6) + 'Px!';
    const hashedPassword = await bcrypt.hash(tempPassword, 10);
    
    const { error: updateError } = await supabase
        .from('users')
        .update({ senha: hashedPassword })
        .eq('id', user.id);
        
    if (updateError) {
        return { success: false, message: 'Erro ao salvar a nova senha no banco de dados.' };
    }
    
    return { success: true, tempPassword };
}

export async function changePasswordLocal(colaboradorId: string, novaSenha: string) {
    const supabase = createServerSupabaseClient();
    
    const hashedPassword = await bcrypt.hash(novaSenha, 10);
    
    // Precisamos achar o usuario de id
    const { error: updateError } = await supabase
        .from('users')
        .update({ senha: hashedPassword })
        .eq('colaborador_id', colaboradorId);
        
    if (updateError) {
        return { success: false, message: 'Erro ao trocar a senha no banco de dados.' };
    }
    
    return { success: true };
}

