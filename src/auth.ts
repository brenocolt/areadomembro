import NextAuth from 'next-auth';
import { authConfig } from './auth.config';
import Credentials from 'next-auth/providers/credentials';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { createServerSupabaseClient } from '@/lib/supabase-server';

export const { auth, signIn, signOut, handlers } = NextAuth({
    ...authConfig,
    session: { strategy: 'jwt' },
    callbacks: {
        ...authConfig.callbacks,
        async jwt({ token, user }) {
            if (user) {
                token.id = user.id;
                token.role = (user as any).role;
                token.colaborador_id = (user as any).colaborador_id;
            }
            return token;
        },
        async session({ session, token }) {
            if (session.user) {
                session.user.id = token.id as string;
                (session.user as any).role = token.role;
                (session.user as any).colaborador_id = token.colaborador_id;
            }
            return session;
        },
    },
    providers: [
        Credentials({
            async authorize(credentials) {
                const parsedCredentials = z
                    .object({ email: z.string().email(), password: z.string().min(1) })
                    .safeParse(credentials);

                if (!parsedCredentials.success) {
                    console.log('Invalid credentials format');
                    return null;
                }

                const { email, password } = parsedCredentials.data;
                console.log('Searching for user in Supabase:', email);

                const supabase = createServerSupabaseClient();

                // Buscar usuário na tabela users do Supabase
                const { data: user, error } = await supabase
                    .from('users')
                    .select('id, email, senha, role, colaborador_id')
                    .eq('email', email)
                    .single();

                if (error || !user) {
                    console.log('User not found in Supabase:', error?.message);
                    return null;
                }

                console.log('User found:', { id: user.id, email: user.email, role: user.role });

                // Comparar senha com bcrypt
                const passwordsMatch = await bcrypt.compare(password, user.senha);
                console.log('Password comparison result:', passwordsMatch);

                if (!passwordsMatch) {
                    console.log('Password does not match');
                    return null;
                }

                // Retornar dados do usuário para o token JWT
                return {
                    id: user.id,
                    email: user.email,
                    role: user.role,
                    colaborador_id: user.colaborador_id,
                };
            },
        }),
    ],
});
