import { supabase } from '@/lib/supabase'
import { isSchemaDesatualizado, type ErroPostgrest } from '@/lib/db-compat'
import { mesDaResposta, chaveDoMes } from '@/lib/nps-period'
import { buscarTodasPaginas } from '@/lib/paginacao'

export { chaveDoMes, janelaDoMes } from '@/lib/nps-period'

// Formulários de avaliação mensal — os marcados como NPS Interno ou NPS
// Projetos (formularios.nps_interno / nps_projetos_generico). Neles, a
// resposta enviada num mês é sobre o mês anterior (ver mesReferenciaFromDate),
// e é por esse mês avaliado que Performance e PIPJ as contam; as telas de
// respostas usam o mesmo mês (ver mesDaResposta). Sem as colunas (migrações
// 20260905 e 20260912), nenhum formulário é tratado assim.
export async function formulariosDeMesAvaliado(ids: string[]): Promise<Set<string>> {
    if (ids.length === 0) return new Set()
    const { data, error } = await supabase.from('formularios').select('id, nps_interno, nps_projetos_generico').in('id', ids)
    if (error) return new Set()
    return new Set((data || []).filter((f: any) => f.nps_interno || f.nps_projetos_generico).map((f: any) => f.id as string))
}

export type MesComRespostas = { key: string; mes: number; ano: number }

// Índice leve das respostas dos formulários: só formulário, data de envio e
// alvo, em páginas — o bastante para montar os botões de mês sem baixar as
// respostas inteiras de todo o histórico. Não depende de
// formulariosDeMesAvaliado, então as duas buscas podem correr juntas; os
// meses saem de mesesDoIndice.
export type LinhaIndice = { formulario_id: string; enviado_em: string; alvo_colaborador_id?: string | null }

export async function buscarIndiceDeRespostas(ids: string[]): Promise<LinhaIndice[]> {
    if (ids.length === 0) return []
    const buscar = (colunas: string) => buscarTodasPaginas<LinhaIndice, ErroPostgrest>((de, ate) => supabase
        .from('formulario_respostas')
        .select(colunas)
        .in('formulario_id', ids)
        .order('enviado_em', { ascending: false })
        .order('id')
        .range(de, ate)
        .returns<LinhaIndice[]>())
    let res = await buscar('formulario_id, enviado_em, alvo_colaborador_id')
    // alvo_colaborador_id vem da migração 20260824.
    if (isSchemaDesatualizado(res.error)) res = await buscar('formulario_id, enviado_em')
    return res.data
}

// Meses com respostas (mais recente primeiro), pelo mês de cada resposta
// (ver mesDaResposta).
export function mesesDoIndice(linhas: LinhaIndice[], mesAvaliado: Set<string>): MesComRespostas[] {
    const meses = new Map<string, MesComRespostas>()
    for (const r of linhas) {
        const m = mesDaResposta(r.enviado_em, mesAvaliado.has(r.formulario_id))
        const key = chaveDoMes(m)
        if (!meses.has(key)) meses.set(key, { key, ...m })
    }
    return Array.from(meses.values()).sort((a, b) => b.key.localeCompare(a.key))
}
