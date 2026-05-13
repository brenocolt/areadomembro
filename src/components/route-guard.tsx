"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useColaborador } from "@/hooks/use-supabase"

export function RouteGuard({ children }: { children: React.ReactNode }) {
    // Role vem do mesmo hook que controla o loading — sem race condition
    const { colaborador, loading, role } = useColaborador()
    const pathname = usePathname()
    const router = useRouter()

    const isAdmin = (role ?? '').toUpperCase() === 'ADMIN'
    const allowedPages: string[] | null = colaborador?.paginas_permitidas ?? null

    // Rotas que são acessíveis implicitamente quando a rota-pai está liberada
    const ROUTE_IMPLICATIONS: Record<string, string> = {
        '/forms-responses': '/forms-management',
        '/nps-projeto':     '/forms-management',
    }
    const impliedByParent = (() => {
        const parent = ROUTE_IMPLICATIONS[pathname]
        return parent ? (allowedPages?.includes(parent) ?? false) : false
    })()

    const isAllowed =
        isAdmin ||           // admin bypass total
        !allowedPages ||     // sem restrições configuradas → libera
        impliedByParent ||   // rota implícita por outra rota permitida
        allowedPages.some(p => pathname === p || pathname.startsWith(p + '/'))

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

    // Após carregar: bloqueia se não autorizado
    if (!isAllowed) return null

    return <>{children}</>
}
