import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
    pages: {
        signIn: '/login',
    },
    callbacks: {
        authorized({ auth, request: { nextUrl } }) {
            const isLoggedIn = !!auth?.user;
            const publicPaths = ['/login', '/signup'];
            const isPublicPath = publicPaths.includes(nextUrl.pathname);

            if (!isPublicPath) {
                if (isLoggedIn) return true;
                return false; // Redirect unauthenticated users to login page
            } else if (isLoggedIn) {
                // If logged in and on login/signup page, redirect to home
                if (publicPaths.includes(nextUrl.pathname)) {
                    return Response.redirect(new URL('/', nextUrl));
                }
            }
            return true;
        },
        session({ session, token }) {
            if (token.sub && session.user) {
                session.user.id = token.sub;
            }
            return session;
        },
    },
    providers: [], // Configured in auth.ts
} satisfies NextAuthConfig;
