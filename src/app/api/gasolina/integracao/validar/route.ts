import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { aplicarStatusSolicitacao, type StatusSolicitacao } from '@/lib/gasolina-server'
import { lerNumero } from '@/lib/gasolina'
import { dadosDoAviso } from '@/lib/gasolina-avisos'

// Chamado pela automação "AUTOMAÇÃO PAGAMENTO VP" (n8n) quando um card de
// gasolina chega ao board Processos de Pagamento. Substitui a leitura da
// planilha para os pedidos feitos pela Área do Membro:
//   POST { monday_item_id, valor? }  (Authorization: Bearer GASOLINA_INTEGRACAO_TOKEN)
//   -> { origem: 'planilha' }                       card não veio do app: siga o fluxo antigo
//   -> { origem: 'app', aprovado: true }            pode marcar APROVADO
//   -> { origem: 'app', aprovado: false, motivo }   marcar RECUSADO e avisar o membro
// Nas respostas de origem 'app' vão também os dados para avisar o membro, tirados do
// cadastro dele na Área do Membro (sem planilha de contatos):
//   membro: { nome, email, whatsapp }  (whatsapp só dígitos com 55, ou null se faltar/for inválido)
//   mensagem_whatsapp                   texto pronto para o Evolution

function tokenValido(req: NextRequest): boolean {
    const esperado = process.env.GASOLINA_INTEGRACAO_TOKEN || ''
    const recebido = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!esperado || !recebido) return false
    const a = Buffer.from(esperado)
    const b = Buffer.from(recebido)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
}

const esperar = (ms: number) => new Promise(r => setTimeout(r, ms))

type Solicitacao = { id: string, status: StatusSolicitacao, valor_total: number, qtd_viagens: number, motivo_recusa: string | null }

// Contato e mensagem prontos para o n8n (o mesmo texto dos avisos automáticos).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function contato(supabase: any, s: Solicitacao, status: 'Aprovado' | 'Recusado') {
    const aviso = await dadosDoAviso(supabase, s.id, status)
    return aviso ? { membro: aviso.membro, mensagem_whatsapp: aviso.mensagem_whatsapp } : {}
}

export async function POST(req: NextRequest) {
    if (!process.env.GASOLINA_INTEGRACAO_TOKEN) {
        return NextResponse.json({ error: 'GASOLINA_INTEGRACAO_TOKEN não configurado no app.' }, { status: 503 })
    }
    if (!tokenValido(req)) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 })

    const body = await req.json().catch(() => ({}))
    const itemId = String(body.monday_item_id ?? '').trim()
    if (!/^\d+$/.test(itemId)) return NextResponse.json({ error: 'Informe monday_item_id.' }, { status: 400 })
    const valorCard = body.valor == null || body.valor === '' ? null : lerNumero(body.valor)

    const supabase = createServerSupabaseClient()

    // O webhook do Monday dispara assim que o card é criado, às vezes antes de
    // o app gravar o ID do card na solicitação — tenta por alguns segundos.
    let solicitacao: Solicitacao | null = null
    for (let tentativa = 0; tentativa < 6 && !solicitacao; tentativa++) {
        if (tentativa) await esperar(1500)
        const { data } = await supabase.from('gasolina_solicitacoes')
            .select('id, status, valor_total, qtd_viagens, motivo_recusa')
            .eq('monday_item_id', itemId)
            .maybeSingle()
        solicitacao = data
    }
    if (!solicitacao) return NextResponse.json({ origem: 'planilha' })

    // Já decidido antes (o n8n pode reprocessar): responde de forma estável.
    if (solicitacao.status === 'Recusado') {
        const motivo = solicitacao.motivo_recusa || 'Solicitação recusada.'
        return NextResponse.json({ origem: 'app', aprovado: false, motivo, ...await contato(supabase, solicitacao, 'Recusado') })
    }
    if (solicitacao.status !== 'Solicitado') {
        return NextResponse.json({ origem: 'app', aprovado: true, ...await contato(supabase, solicitacao, 'Aprovado') })
    }

    const recusar = async (motivo: string) => {
        await aplicarStatusSolicitacao(supabase, solicitacao!, 'Recusado', motivo)
        return NextResponse.json({ origem: 'app', aprovado: false, motivo, ...await contato(supabase, solicitacao!, 'Recusado') })
    }

    const { data: viagens } = await supabase.from('gasolina_viagens')
        .select('valor, status').eq('solicitacao_id', solicitacao.id)
    const emSolicitacao = (viagens ?? []).filter(v => v.status === 'Em solicitação')
    const soma = Math.round(emSolicitacao.reduce((s, v) => s + Number(v.valor ?? 0), 0) * 100) / 100

    if (emSolicitacao.length !== solicitacao.qtd_viagens || Math.abs(soma - Number(solicitacao.valor_total)) > 0.01) {
        return recusar('As viagens desta solicitação mudaram depois do pedido. Abra a Área do Membro e solicite de novo.')
    }
    // Mesma tolerância da automação antiga (R$ 1,00) para o valor do card.
    if (valorCard !== null && Math.abs(valorCard - Number(solicitacao.valor_total)) > 1) {
        return recusar(`O valor do card no Monday (R$ ${valorCard.toFixed(2)}) não confere com o da solicitação (R$ ${Number(solicitacao.valor_total).toFixed(2)}).`)
    }

    // O n8n move o card para APROVADO logo em seguida; já reflete no app
    // para o membro não esperar a próxima sincronização (o sync só confirma).
    await aplicarStatusSolicitacao(supabase, solicitacao, 'Aprovado')
    return NextResponse.json({ origem: 'app', aprovado: true, ...await contato(supabase, solicitacao, 'Aprovado') })
}
