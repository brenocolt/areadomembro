"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { useColaborador } from "@/hooks/use-supabase"

export function RouteGuard({ children }: { children: React.ReactNode }) {
    const { colaborador, loading } = useColaborador()
    const { data: session } = useSession()
    const pathname = usePathname()
    const router = useRouter()

    const isAdmin = (session?.user as any)?.role === 'ADMIN'
    const allowedPages: string[] | null = colaborador?.paginas_permitidas ?? null

    const isAllowed = isAdmin || !allowedPages
        || allowedPages.some(p => pathname === p || pathname.startsWith(p + '/'))

    useEffect(() => {
        if (loading) return
        if (!isAllowed) router.replace('/')
    }, [loading, isAllowed, router])

    // Enquanto carrega: spinner (evita flash de conteúdo restrito)
    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[50vh]">
                <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
        )
    }

    // Após carregar: bloqueia se não autorizado (sem flash)
    if (!isAllowed) return null

    return <>{children}</>
}
