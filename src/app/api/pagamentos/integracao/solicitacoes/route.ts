import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { STATUS_PROCESSAMENTO } from '@/lib/pagamentos-formulario'
import { COLUNAS_RESUMO, MSG_NAO_CONFIGURADO, integracaoConfigurada, tokenIntegracaoValido } from '@/lib/pagamentos-server'

// GET (n8n) — lista solicitações, mais antigas primeiro.
//   Authorization: Bearer PAGAMENTOS_INTEGRACAO_TOKEN
//   ?status=recebida,erro_envio   (padrão: as duas — "ainda não processadas")
//   ?desde=2026-11-01T00:00:00Z   (opcional, por data de criação)
//   ?limite=50                    (1..200)
// Serve de rede de segurança: se o webhook falhar, o n8n busca aqui.
export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
    if (!integracaoConfigurada()) return NextResponse.json({ error: 'PAGAMENTOS_INTEGRACAO_TOKEN não configurado no portal.' }, { status: 503 })
    if (!tokenIntegracaoValido(req.headers.get('authorization'))) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 })
    const db = createAdminSupabaseClient()
    if (!db) return NextResponse.json({ error: MSG_NAO_CONFIGURADO }, { status: 503 })

    const p = req.nextUrl.searchParams
    const status = (p.get('status') || 'recebida,erro_envio').split(',').map(s => s.trim()).filter(Boolean)
    if (status.some(s => !(STATUS_PROCESSAMENTO as readonly string[]).includes(s))) {
        return NextResponse.json({ error: `status inválido. Use: ${STATUS_PROCESSAMENTO.join(', ')}` }, { status: 400 })
    }
    const limite = Math.min(Math.max(Number(p.get('limite')) || 50, 1), 200)

    let consulta = db.from('pagamentos_solicitacoes').select(COLUNAS_RESUMO)
        .in('status_processamento', status)
        .order('criado_em', { ascending: true })
        .limit(limite)
    const desde = p.get('desde')
    if (desde) {
        if (Number.isNaN(Date.parse(desde))) return NextResponse.json({ error: 'desde inválido (use data ISO).' }, { status: 400 })
        consulta = consulta.gte('criado_em', new Date(desde).toISOString())
    }
    const { data, error } = await consulta
    if (error) {
        console.error('[pagamentos] Lista para o n8n falhou:', error.message)
        return NextResponse.json({ error: 'Falha ao consultar.' }, { status: 500 })
    }
    return NextResponse.json({ solicitacoes: (data ?? []).map(s => ({ ...s, valor: Number(s.valor) })) })
}
