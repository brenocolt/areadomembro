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

// colaboradores.nucleo_atual só virou dropdown depois que muita gente já
// estava cadastrada, então o valor gravado pode divergir do rótulo da lista
// fixa por acento, hífen, caixa ou espaço ("Vice-Presidência" x "Vice
// Presidência", "marketing " x "Marketing"). Comparar a forma normalizada
// evita que uma diferença puramente cosmética faça o público não casar com
// ninguém — que é como um formulário direcionado deixaria de gerar abas.
function normalizar(valor?: string | null): string {
    return (valor || '')
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
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
//
// Lança em qualquer falha: se o público não for gravado, o formulário passa
// a se comportar como um formulário comum (sem abas por pessoa) sem nenhum
// aviso — exatamente o tipo de erro silencioso que precisa aparecer para
// quem está criando o formulário.
export async function saveFormularioPublico(formularioId: string, publico: FormularioPublico): Promise<void> {
    const deletes = await Promise.all([
        supabase.from('formulario_publico_responde').delete().eq('formulario_id', formularioId),
        supabase.from('formulario_publico_recebe').delete().eq('formulario_id', formularioId),
    ])
    for (const { error } of deletes) {
        if (error) throw new Error(`Erro ao limpar o público anterior do formulário: ${error.message}`)
    }

    const inserts: PromiseLike<{ error: { message: string } | null }>[] = []
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
    for (const { error } of await Promise.all(inserts)) {
        if (error) throw new Error(`Erro ao salvar o público do formulário: ${error.message}`)
    }
}

// Um colaborador "bate" com uma lista de pares se (cargo_atual, nucleo_atual)
// dele corresponder a algum par da lista — ou se a lista estiver vazia
// (Todos, no caso de "quem responde"; nunca chamado com lista vazia de
// "quem recebe", que já significa "não é um formulário direcionado").
export function colaboradorNoPublico(
    colaborador: { cargo_atual?: string | null, nucleo_atual?: string | null } | null | undefined,
    pares: PublicoPar[]
): boolean {
    if (pares.length === 0) return true
    const cargo = normalizar(colaborador?.cargo_atual)
    const nucleo = normalizar(colaborador?.nucleo_atual)
    if (!cargo && !nucleo) return false
    return pares.some(p => normalizar(p.cargo) === cargo && normalizar(p.nucleo) === nucleo)
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

// Todo mundo que bate com uma lista de pares, sem excluir ninguém — usado na
// prévia da aba "Público" para mostrar a quantas pessoas cada grupo
// corresponde de fato (um grupo que casa com 0 pessoas é o motivo mais comum
// de um formulário direcionado não gerar nenhuma aba).
export function contarNoPublico<T extends { cargo_atual?: string | null, nucleo_atual?: string | null }>(
    colaboradores: T[], pares: PublicoPar[]
): T[] {
    if (pares.length === 0) return []
    return colaboradores.filter(c => colaboradorNoPublico(c, pares))
}
