"use client"

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { buscarProjetosComEquipe, type ProjetoComEquipe } from '@/lib/projetos-equipe'

export const chaveProjeto = (nome: string | null | undefined) => String(nome || '').toLowerCase().trim()

// Equipe (gerente + consultores) de cada projeto ativo, indexada pelo NOME do
// projeto — é como as telas antigas (colaboradores.projetos_ativos_detalhe)
// guardam a referência. `disponivel` = false enquanto a migração
// 20261126_projeto_equipe.sql não foi aplicada: as telas simplesmente não
// mostram a equipe.
export function useEquipesProjetos() {
    const [equipes, setEquipes] = useState<Map<string, ProjetoComEquipe>>(new Map())
    const [disponivel, setDisponivel] = useState(false)
    useEffect(() => {
        let cancelado = false
        buscarProjetosComEquipe(supabase).then(({ projetos, equipeDisponivel }) => {
            if (cancelado) return
            setEquipes(new Map(projetos.map(p => [chaveProjeto(p.nome), p])))
            setDisponivel(equipeDisponivel)
        })
        return () => { cancelado = true }
    }, [])
    return { equipes, disponivel }
}
