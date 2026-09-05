"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// NPS Projetos passou a ser um formulário genérico como qualquer outro (ver
// "NPS Projetos (Novo)" em Gestão de Formulários) — respondido dentro de
// /formularios, não mais nesta página dedicada. Esta rota continua
// existindo só para não quebrar links e favoritos antigos.
export default function NPSProjetoRedirect() {
    const router = useRouter()
    useEffect(() => { router.replace('/formularios') }, [router])
    return <div className="p-8 text-center text-slate-400 text-sm">Redirecionando para Formulários...</div>
}
