"use client"

import { useEffect } from "react"

const TIPOS = new Set(["date", "month", "week", "time", "datetime-local"])

// Em todo o app, clicar num campo de data (ou mês) abre o calendário na hora,
// sem precisar acertar o ícone nem digitar. Navegadores sem showPicker
// continuam com o comportamento normal.
export function AbrirCalendarioAoClicar() {
    useEffect(() => {
        function aoClicar(e: MouseEvent) {
            const alvo = e.target
            if (!(alvo instanceof HTMLInputElement) || !TIPOS.has(alvo.type)) return
            if (alvo.disabled || alvo.readOnly) return
            try { alvo.showPicker?.() } catch { /* ex.: já aberto ou bloqueado pelo navegador */ }
        }
        document.addEventListener("click", aoClicar)
        return () => document.removeEventListener("click", aoClicar)
    }, [])
    return null
}
