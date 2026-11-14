import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { MSG_NAO_CONFIGURADO, exigirMembroPagamentos } from '@/lib/pagamentos-server'

// PATCH (VP/admin) — muda uma opção da lista:
//   { valor: "novo texto" }      renomeia (solicitações antigas guardam o texto da época)
//   { ativo: false | true }      oculta / mostra de novo no formulário
//   { mover: "cima" | "baixo" }  troca de lugar com a vizinha
export const runtime = 'nodejs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const COLUNAS = 'id, lista, valor, ordem, ativo'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const db = createAdminSupabaseClient()
    if (!db) return NextResponse.json({ error: MSG_NAO_CONFIGURADO }, { status: 503 })
    const acesso = await exigirMembroPagamentos(db)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })
    if (!acesso.membro.podeEditarOpcoes) return NextResponse.json({ error: 'Apenas a Vice Presidência pode editar as listas.' }, { status: 403 })

    const { id } = await params
    if (!UUID.test(id)) return NextResponse.json({ error: 'id inválido.' }, { status: 400 })
    const { data: atual } = await db.from('pagamentos_opcoes').select(COLUNAS).eq('id', id).maybeSingle()
    if (!atual) return NextResponse.json({ error: 'Opção não encontrada.' }, { status: 404 })

    const body = await req.json().catch(() => ({}))
    const quem = { atualizado_por: acesso.membro.colaboradorId, atualizado_em: new Date().toISOString() }

    if (body.mover === 'cima' || body.mover === 'baixo') {
        const { data: irmas } = await db.from('pagamentos_opcoes').select(COLUNAS).eq('lista', atual.lista)
            .order('ordem').order('valor')
        const lista = irmas ?? []
        const i = lista.findIndex(l => l.id === id)
        const j = body.mover === 'cima' ? i - 1 : i + 1
        if (i < 0 || j < 0 || j >= lista.length) return NextResponse.json({ linha: atual })
        // Renumera a lista inteira com a troca (resolve ordens repetidas).
        const nova = [...lista]
        ;[nova[i], nova[j]] = [nova[j], nova[i]]
        for (const [k, l] of nova.entries()) {
            if (l.ordem !== k + 1) await db.from('pagamentos_opcoes').update({ ordem: k + 1, ...quem }).eq('id', l.id)
        }
        return NextResponse.json({ linha: { ...atual, ordem: j + 1 } })
    }

    const mudancas: Record<string, unknown> = { ...quem }
    if (typeof body.ativo === 'boolean') mudancas.ativo = body.ativo
    if (body.valor !== undefined) {
        const valor = String(body.valor).replace(/\s+/g, ' ').trim()
        if (!valor || valor.length > 120) return NextResponse.json({ error: 'Escreva a opção (até 120 caracteres).' }, { status: 400 })
        mudancas.valor = valor
    }
    if (Object.keys(mudancas).length === 2) return NextResponse.json({ error: 'Nada para mudar.' }, { status: 400 })

    const { data, error } = await db.from('pagamentos_opcoes').update(mudancas).eq('id', id).select(COLUNAS).single()
    if (error) {
        if (error.code === '23505') return NextResponse.json({ error: 'Já existe uma opção com esse nome nesta lista.' }, { status: 409 })
        console.error('[pagamentos] Falha ao editar opção:', error.message)
        return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 })
    }
    return NextResponse.json({ linha: data })
}
