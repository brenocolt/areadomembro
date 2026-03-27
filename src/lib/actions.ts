'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';

// Define schema for input validation if needed, but we do it in client too.

export async function authenticate(
    prevState: string | undefined,
    formData: FormData,
) {
    try {
        await signIn('credentials', formData);
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
}
