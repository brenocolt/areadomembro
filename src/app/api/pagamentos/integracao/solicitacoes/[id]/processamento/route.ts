import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import {
    MSG_NAO_CONFIGURADO, STATUS_DO_N8N, ehStatusFinal, integracaoConfigurada, registrarEvento, tokenIntegracaoValido,
} from '@/lib/pagamentos-server'

// POST (n8n) — registra o andamento das automações e a decisão final.
//   Authorization: Bearer PAGAMENTOS_INTEGRACAO_TOKEN
//   {
//     "chave_idempotencia": "exec-123-no-slack",   // obrigatório e único por ação
//     "etapa": "google_agenda",                     // opcional: nome da verificação
//     "status_processamento": "em_processamento",   // opcional (ver STATUS_DO_N8N)
//     "decisao": "aprovada" | "recusada",           // opcional; recusa exige motivo
//     "motivo": "...", "decidido_por": "Fulano (Slack)",
//     "detalhes": { ... },                          // opcional: resultado da etapa (até 20 KB)
//     "erro": "..."                                 // opcional: falha na etapa
//   }
// Repetir a mesma chave_idempotencia não registra de novo: devolve o estado
// atual com "repetido": true. Depois de aprovada/recusada, a decisão não
// muda por aqui (409).
export const runtime = 'nodejs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ESTADO = 'id, numero, status_processamento, decisao, motivo_decisao, decidido_por, decidido_em, atualizado_em'

const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!integracaoConfigurada()) return NextResponse.json({ error: 'PAGAMENTOS_INTEGRACAO_TOKEN não configurado no portal.' }, { status: 503 })
    if (!tokenIntegracaoValido(req.headers.get('authorization'))) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 })
    const db = createAdminSupabaseClient()
    if (!db) return NextResponse.json({ error: MSG_NAO_CONFIGURADO }, { status: 503 })

    const { id } = await params
    if (!UUID.test(id)) return NextResponse.json({ error: 'id inválido.' }, { status: 400 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body: any = await req.json().catch(() => null)
    if (!body || typeof body !== 'object') return NextResponse.json({ error: 'Envie um JSON.' }, { status: 400 })

    const chave = texto(body.chave_idempotencia, 200)
    if (!chave) return NextResponse.json({ error: 'Informe chave_idempotencia (única por ação).' }, { status: 400 })

    const decisao = body.decisao == null ? null : body.decisao
    if (decisao !== null && decisao !== 'aprovada' && decisao !== 'recusada') {
        return NextResponse.json({ error: 'decisao deve ser "aprovada" ou "recusada".' }, { status: 400 })
    }
    let status = body.status_processamento == null ? null : body.status_processamento
    if (status !== null && !(STATUS_DO_N8N as readonly string[]).includes(status)) {
        return NextResponse.json({ error: `status_processamento inválido. Use: ${STATUS_DO_N8N.join(', ')}` }, { status: 400 })
    }
    if (decisao && status && status !== decisao) return NextResponse.json({ error: 'status_processamento e decisao não conferem.' }, { status: 400 })
    if (decisao) status = decisao
    const decisaoFinal: 'aprovada' | 'recusada' | null = decisao ?? (ehStatusFinal(status) ? status : null)
    const motivo = texto(body.motivo, 2000)
    if (decisaoFinal === 'recusada' && !motivo) return NextResponse.json({ error: 'Informe o motivo da recusa.' }, { status: 400 })

    const detalhes = body.detalhes ?? null
    if (detalhes !== null && JSON.stringify(detalhes).length > 20_000) return NextResponse.json({ error: 'detalhes passa de 20 KB.' }, { status: 413 })
    const etapa = texto(body.etapa, 100)
    const erro = texto(body.erro, 2000)
    const decididoPor = texto(body.decidido_por, 200)

    const { data: atual, error: erroLeitura } = await db.from('pagamentos_solicitacoes').select(ESTADO).eq('id', id).maybeSingle()
    if (erroLeitura) return NextResponse.json({ error: 'Falha ao consultar.' }, { status: 500 })
    if (!atual) return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })

    // Mesma ação já registrada antes?
    const { data: anterior } = await db.from('pagamentos_eventos')
        .select('solicitacao_id').eq('chave_idempotencia', chave).maybeSingle()
    if (anterior) {
        if (anterior.solicitacao_id !== id) return NextResponse.json({ error: 'chave_idempotencia já usada em outra solicitação.' }, { status: 409 })
        return NextResponse.json({ repetido: true, solicitacao: atual })
    }

    if (ehStatusFinal(atual.status_processamento) && status && status !== atual.status_processamento) {
        return NextResponse.json({ error: `Solicitação já ${atual.status_processamento}; a decisão não pode ser alterada por aqui.`, solicitacao: atual }, { status: 409 })
    }

    // Registra o evento primeiro: a chave única impede que duas execuções
    // simultâneas do n8n apliquem a mesma ação duas vezes.
    const registro = await registrarEvento(db, {
        solicitacao_id: id, origem: 'n8n',
        tipo: decisaoFinal ? `decisao_${decisaoFinal}` : (erro ? 'etapa_erro' : (etapa ? 'etapa' : 'atualizacao')),
        chave_idempotencia: chave,
        status_anterior: atual.status_processamento,
        status_novo: status ?? atual.status_processamento,
        detalhes: { etapa, detalhes, motivo, decidido_por: decididoPor },
        erro,
    })
    if (registro.duplicado) {
        const { data } = await db.from('pagamentos_solicitacoes').select(ESTADO).eq('id', id).maybeSingle()
        return NextResponse.json({ repetido: true, solicitacao: data })
    }
    if (registro.erro) return NextResponse.json({ error: 'Falha ao registrar.' }, { status: 500 })

    const mudancas: Record<string, unknown> = { atualizado_em: new Date().toISOString() }
    if (status && status !== atual.status_processamento) mudancas.status_processamento = status
    if (decisaoFinal && !atual.decisao) {
        mudancas.decisao = decisaoFinal
        mudancas.motivo_decisao = motivo
        mudancas.decidido_por = decididoPor
        mudancas.decidido_em = new Date().toISOString()
    }
    let consulta = db.from('pagamentos_solicitacoes').update(mudancas).eq('id', id)
    // Corrida com outra decisão: só aplica se continuar sem decisão final.
    if (mudancas.status_processamento) consulta = consulta.not('status_processamento', 'in', '(aprovada,recusada)')
    const { data: atualizada, error: erroUpdate } = await consulta.select(ESTADO).maybeSingle()
    if (erroUpdate) {
        console.error('[pagamentos] Falha ao atualizar processamento:', erroUpdate.message)
        // Libera a chave para o n8n poder tentar de novo.
        await db.from('pagamentos_eventos').delete().eq('chave_idempotencia', chave)
        return NextResponse.json({ error: 'Falha ao atualizar.' }, { status: 500 })
    }
    if (!atualizada) {
        await db.from('pagamentos_eventos').delete().eq('chave_idempotencia', chave)
        const { data } = await db.from('pagamentos_solicitacoes').select(ESTADO).eq('id', id).maybeSingle()
        return NextResponse.json({ error: 'A solicitação foi decidida por outra execução.', solicitacao: data }, { status: 409 })
    }
    return NextResponse.json({ repetido: false, solicitacao: atualizada })
}
