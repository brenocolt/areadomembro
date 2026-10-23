"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { useColaborador } from "@/hooks/use-supabase"
import { paginaPermitida, isRotaExclusivaVP } from "@/lib/access-control"

export function RouteGuard({ children }: { children: React.ReactNode }) {
    // Role vem do mesmo hook que controla o loading — sem race condition
    const { colaborador, loading, role } = useColaborador()
    const pathname = usePathname()
    const router = useRouter()

    // Rotas que são acessíveis implicitamente quando a rota-pai está liberada
    const ROUTE_IMPLICATIONS: Record<string, string> = {
        '/forms-responses': '/forms-management',
        '/nps-projeto':     '/forms-management',
        // O NPS Interno virou sub-aba de Performance: quem já tinha acesso à
        // página antiga continua enxergando o mesmo conteúdo no novo lugar.
        '/performance':     '/nps-interno',
    }
    const impliedByParent = (() => {
        const parent = ROUTE_IMPLICATIONS[pathname]
        return parent ? paginaPermitida(parent, colaborador, role) : false
    })()

    // Rotas exclusivas da VP só dependem de paginaPermitida: nem rota-pai
    // implícita nem exceção manual (paginas_permitidas) as liberam.
    const isAllowed = isRotaExclusivaVP(pathname)
        ? paginaPermitida(pathname, colaborador, role)
        : paginaPermitida(pathname, colaborador, role) ||
        impliedByParent ||     // rota implícita por outra rota permitida
        (colaborador?.paginas_permitidas ?? []).some((p: string) => pathname.startsWith(p + '/'))

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
