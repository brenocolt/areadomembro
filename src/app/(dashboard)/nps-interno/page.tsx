"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"

// O NPS Interno passou a ser uma sub-aba dentro de Performance (ver
// src/app/(dashboard)/performance/page.tsx). Esta rota continua existindo só
// para não quebrar links e favoritos antigos.
export default function NPSInternoRedirect() {
    const router = useRouter()
    useEffect(() => { router.replace('/performance') }, [router])
    return <div className="p-8 text-center text-slate-400 text-sm">Redirecionando para Performance...</div>
}
