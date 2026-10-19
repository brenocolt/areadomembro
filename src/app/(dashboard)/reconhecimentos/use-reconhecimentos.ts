"use client"

import { useCallback, useEffect, useState } from "react"
import { api, ErroApi } from "@/lib/reconhecimentos/cliente"
import type { DadosReconhecimentos, ResultadoSincronizacao } from "@/lib/reconhecimentos/tipos"

const VAZIO: DadosReconhecimentos = { tipos: [], regras: [], reconhecimentos: [], bonificacoes: [], config: null }

export function useReconhecimentosDados() {
    const [dados, setDados] = useState<DadosReconhecimentos>(VAZIO)
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState<ErroApi | Error | null>(null)

    const recarregar = useCallback(async () => {
        try {
            setDados(await api<DadosReconhecimentos>("/api/reconhecimentos"))
            setErro(null)
        } catch (e) {
            setErro(e instanceof Error ? e : new Error("Erro ao carregar"))
        } finally {
            setCarregando(false)
        }
    }, [])

    // Gatilho 1 do motor: abrir a aba. O erro da sincronização é ignorado (como no original).
    useEffect(() => {
        recarregar()
        api<ResultadoSincronizacao>("/api/reconhecimentos/sincronizar", "POST")
            .then((r) => { if (r.novas > 0 || r.expiradas > 0) recarregar() })
            .catch(() => undefined)
    }, [recarregar])

    return { dados, carregando, erro, recarregar }
}
