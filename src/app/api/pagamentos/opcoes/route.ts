import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { LISTAS_EDITAVEIS, listaEditavelValida } from '@/lib/pagamentos-formulario'
import { MSG_NAO_CONFIGURADO, carregarOpcoes, exigirMembroPagamentos } from '@/lib/pagamentos-server'

// Listas do formulário "Solicitar Pagamento ou Reembolso" (categorias por
// centro de custo, eventos MEJ e projetos de consultoria).
//   GET                -> listas ativas (quem pode usar o formulário)
//   GET ?gerenciar=1   -> todas as linhas, com id e ativo (VP/admin)
//   POST { lista, valor } -> adiciona no fim da lista (VP/admin)
export const runtime = 'nodejs'

const VALOR_MAX = 120

export async function GET(req: NextRequest) {
    const db = createAdminSupabaseClient()
    if (!db) return NextResponse.json({ error: MSG_NAO_CONFIGURADO }, { status: 503 })
    const acesso = await exigirMembroPagamentos(db)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })
    const { podeEditarOpcoes } = acesso.membro

    if (req.nextUrl.searchParams.get('gerenciar') === '1') {
        if (!podeEditarOpcoes) return NextResponse.json({ error: 'Apenas a Vice Presidência pode editar as listas.' }, { status: 403 })
        const { data, error } = await db.from('pagamentos_opcoes')
            .select('id, lista, valor, ordem, ativo').order('lista').order('ordem').order('valor')
        if (error) return NextResponse.json({ error: 'Listas indisponíveis. A migração 20261114_pagamentos_opcoes.sql já foi aplicada?' }, { status: 503 })
        return NextResponse.json({ listas: LISTAS_EDITAVEIS, linhas: data ?? [] })
    }
    return NextResponse.json({ opcoes: await carregarOpcoes(db), podeEditar: podeEditarOpcoes })
}

export async function POST(req: NextRequest) {
    const db = createAdminSupabaseClient()
    if (!db) return NextResponse.json({ error: MSG_NAO_CONFIGURADO }, { status: 503 })
    const acesso = await exigirMembroPagamentos(db)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })
    if (!acesso.membro.podeEditarOpcoes) return NextResponse.json({ error: 'Apenas a Vice Presidência pode editar as listas.' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const lista = String(body.lista ?? '')
    const valor = String(body.valor ?? '').replace(/\s+/g, ' ').trim()
    if (!listaEditavelValida(lista)) return NextResponse.json({ error: 'Lista inválida.' }, { status: 400 })
    if (!valor || valor.length > VALOR_MAX) return NextResponse.json({ error: `Escreva a opção (até ${VALOR_MAX} caracteres).` }, { status: 400 })

    const { data: existente } = await db.from('pagamentos_opcoes').select('id, ativo').eq('lista', lista).eq('valor', valor).maybeSingle()
    const agora = new Date().toISOString()
    if (existente) {
        if (existente.ativo) return NextResponse.json({ error: 'Essa opção já existe nesta lista.' }, { status: 409 })
        // Estava oculta: volta a aparecer.
        const { data, error } = await db.from('pagamentos_opcoes')
            .update({ ativo: true, atualizado_por: acesso.membro.colaboradorId, atualizado_em: agora })
            .eq('id', existente.id).select('id, lista, valor, ordem, ativo').single()
        if (error) return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 })
        return NextResponse.json({ linha: data, reativada: true })
    }

    const { data: ultima } = await db.from('pagamentos_opcoes').select('ordem').eq('lista', lista)
        .order('ordem', { ascending: false }).limit(1).maybeSingle()
    const { data, error } = await db.from('pagamentos_opcoes').insert({
        lista, valor, ordem: (ultima?.ordem ?? 0) + 1, atualizado_por: acesso.membro.colaboradorId,
    }).select('id, lista, valor, ordem, ativo').single()
    if (error) {
        if (error.code === '23505') return NextResponse.json({ error: 'Essa opção já existe nesta lista.' }, { status: 409 })
        console.error('[pagamentos] Falha ao adicionar opção:', error.message)
        return NextResponse.json({ error: 'Não foi possível salvar.' }, { status: 500 })
    }
    return NextResponse.json({ linha: data }, { status: 201 })
}
