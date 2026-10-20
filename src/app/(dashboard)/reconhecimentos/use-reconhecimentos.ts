"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { api, ErroApi } from "@/lib/reconhecimentos/cliente"
import type { DadosReconhecimentos, ResultadoSincronizacao } from "@/lib/reconhecimentos/tipos"

export interface ProjetoOpcao { id: string; nome: string }
export interface ColaboradorOpcao { id: string; nome: string; nucleo: string | null; cargo: string | null }

// Carrega os dados da aba pelo servidor e, em seguida, sincroniza (gera bonificações pendentes e expira as vencidas).
export function useReconhecimentos() {
    const [dados, setDados] = useState<DadosReconhecimentos | null>(null)
    const [projetos, setProjetos] = useState<ProjetoOpcao[]>([])
    const [colaboradores, setColaboradores] = useState<ColaboradorOpcao[]>([])
    const [carregando, setCarregando] = useState(true)
    const [erro, setErro] = useState<ErroApi | Error | null>(null)
    const ativo = useRef(true)

    const recarregar = useCallback(async () => {
        try {
            const novos = await api<DadosReconhecimentos>("/api/reconhecimentos")
            if (ativo.current) { setDados(novos); setErro(null) }
        } catch (e) {
            if (ativo.current) setErro(e as Error)
        }
    }, [])

    useEffect(() => {
        ativo.current = true
        void (async () => {
            await recarregar()
            try {
                const r = await api<ResultadoSincronizacao>("/api/reconhecimentos/sincronizar", "POST")
                if (r.geradas > 0 || r.expiradas > 0) await recarregar()
            } catch { /* a sincronização é complementar: a falha não impede o uso da aba */ }
            try {
                const [p, c] = await Promise.all([
                    api<{ projetos: ProjetoOpcao[] }>("/api/reconhecimentos/projetos"),
                    api<{ colaboradores: ColaboradorOpcao[] }>("/api/reconhecimentos/colaboradores"),
                ])
                if (ativo.current) { setProjetos(p.projetos); setColaboradores(c.colaboradores) }
            } catch { /* listas de apoio: os formulários mostram vazio */ }
            if (ativo.current) setCarregando(false)
        })()
        return () => { ativo.current = false }
    }, [recarregar])

    return { dados, projetos, colaboradores, carregando, erro, recarregar }
}
