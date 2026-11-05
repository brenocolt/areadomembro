import type { MondayColunaValor } from '@/lib/gasolina'

const ID_COLUNA = /^[a-z0-9_]{2,60}$/

// Valida o corpo de criação/edição de um centro de custo.
export function lerCentroCusto(body: Record<string, unknown>):
    { ok: true, centro: Record<string, unknown> } | { ok: false, error: string } {
    const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    const nome = texto(body.nome)
    const tipo = body.tipo === 'projeto' || body.tipo === 'fixo' ? body.tipo : null
    const rotuloFixo = texto(body.rotulo_fixo)
    const centroMonday = texto(body.monday_centro_custo)
    const colunaProjeto = texto(body.monday_coluna_projeto)

    if (!nome || nome.length > 80) return { ok: false, error: 'Informe o nome (até 80 caracteres).' }
    if (!tipo) return { ok: false, error: 'Escolha o tipo.' }
    if (tipo === 'fixo' && (!rotuloFixo || rotuloFixo.length > 80)) {
        return { ok: false, error: 'Informe o rótulo fixo que aparece como projeto (ex.: PROSPECÇÃO).' }
    }
    if (!centroMonday || centroMonday.length > 80) return { ok: false, error: 'Informe o rótulo do Centro de Custo no Monday.' }
    if (tipo === 'projeto' && (!colunaProjeto || !ID_COLUNA.test(colunaProjeto))) {
        return { ok: false, error: 'Informe o ID da coluna do Monday com a lista de projetos (ex.: dropdown_mkxcfwdz).' }
    }

    const colunas: MondayColunaValor[] = []
    const brutas = Array.isArray(body.monday_colunas) ? body.monday_colunas : []
    for (const c of brutas) {
        const coluna = texto((c as Record<string, unknown>)?.coluna)
        const valor = texto((c as Record<string, unknown>)?.valor)
        if (!coluna && !valor) continue
        if (!coluna || !ID_COLUNA.test(coluna) || !valor || valor.length > 80) {
            return { ok: false, error: 'Cada coluna extra do Monday precisa de um ID válido e de um valor.' }
        }
        colunas.push({ coluna, valor })
    }

    const ordem = Number.isInteger(body.ordem) ? body.ordem : 0
    return {
        ok: true,
        centro: {
            nome,
            tipo,
            rotulo_fixo: tipo === 'fixo' ? rotuloFixo : null,
            monday_centro_custo: centroMonday,
            monday_coluna_projeto: tipo === 'projeto' ? colunaProjeto : null,
            monday_colunas: colunas,
            ativo: body.ativo !== false,
            ordem,
        },
    }
}
