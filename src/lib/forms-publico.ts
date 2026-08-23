// Público de um formulário — "quem responde" (quem vê/pode preencher o
// formulário) e "quem recebe" (sobre quem as respostas são, gerando uma aba
// de preenchimento por alvo). Ver supabase/migrations/20260824_formularios_publico.sql
// e a aba "Público" em CreateFormDialog.
//
// Cada um é uma lista de pares (cargo, núcleo) — ver src/lib/cargos.ts e
// src/lib/nucleos.ts. Lista vazia em "quem responde" = Todos (comportamento
// padrão de hoje: todo mundo vê o formulário). Lista vazia em "quem recebe"
// = Ninguém (formulário comum, sem direcionamento: cada resposta é sobre o
// próprio respondente). Essa é a formatação básica de todo formulário já
// existente, que não tem nenhuma linha salva nessas tabelas.
import { supabase } from '@/lib/supabase'

export interface PublicoPar {
    cargo: string
    nucleo: string
}

export interface FormularioPublico {
    quemResponde: PublicoPar[]
    quemRecebe: PublicoPar[]
}

export async function loadFormularioPublico(formularioId: string): Promise<FormularioPublico> {
    const [{ data: responde }, { data: recebe }] = await Promise.all([
        supabase.from('formulario_publico_responde').select('cargo, nucleo').eq('formulario_id', formularioId),
        supabase.from('formulario_publico_recebe').select('cargo, nucleo').eq('formulario_id', formularioId),
    ])
    return { quemResponde: responde || [], quemRecebe: recebe || [] }
}

// Substitui integralmente os pares salvos de um formulário (apaga tudo e
// insere de novo) — o volume é sempre pequeno, então não vale a pena um
// diff fino entre o que já existia e o que mudou.
export async function saveFormularioPublico(formularioId: string, publico: FormularioPublico): Promise<void> {
    await Promise.all([
        supabase.from('formulario_publico_responde').delete().eq('formulario_id', formularioId),
        supabase.from('formulario_publico_recebe').delete().eq('formulario_id', formularioId),
    ])
    const inserts: PromiseLike<unknown>[] = []
    if (publico.quemResponde.length > 0) {
        inserts.push(supabase.from('formulario_publico_responde').insert(
            publico.quemResponde.map(p => ({ formulario_id: formularioId, cargo: p.cargo, nucleo: p.nucleo }))
        ))
    }
    if (publico.quemRecebe.length > 0) {
        inserts.push(supabase.from('formulario_publico_recebe').insert(
            publico.quemRecebe.map(p => ({ formulario_id: formularioId, cargo: p.cargo, nucleo: p.nucleo }))
        ))
    }
    await Promise.all(inserts)
}

// Um colaborador "bate" com uma lista de pares se (cargo_atual, nucleo_atual)
// dele for idêntico a algum par da lista — ou se a lista estiver vazia
// (Todos, no caso de "quem responde"; nunca chamado com lista vazia de
// "quem recebe", que já significa "não é um formulário direcionado").
export function colaboradorNoPublico(
    colaborador: { cargo_atual?: string | null, nucleo_atual?: string | null } | null | undefined,
    pares: PublicoPar[]
): boolean {
    if (pares.length === 0) return true
    const cargo = colaborador?.cargo_atual || ''
    const nucleo = colaborador?.nucleo_atual || ''
    return pares.some(p => p.cargo === cargo && p.nucleo === nucleo)
}

// Alvos de um formulário direcionado: colaboradores cujo (cargo, núcleo)
// bate com algum par de "quem recebe", excluindo sempre quem está
// respondendo — ninguém vê uma aba de preenchimento sobre si mesmo.
export function resolveAlvos<T extends { id: string, cargo_atual?: string | null, nucleo_atual?: string | null }>(
    colaboradores: T[], quemRecebe: PublicoPar[], selfId: string | null | undefined
): T[] {
    if (quemRecebe.length === 0) return []
    return colaboradores.filter(c => c.id !== selfId && colaboradorNoPublico(c, quemRecebe))
}
