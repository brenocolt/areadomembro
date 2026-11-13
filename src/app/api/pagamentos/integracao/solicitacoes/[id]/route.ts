import { NextRequest, NextResponse } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { MSG_NAO_CONFIGURADO, integracaoConfigurada, montarDadosSolicitacao, tokenIntegracaoValido } from '@/lib/pagamentos-server'

// GET (n8n) — tudo de uma solicitação: respostas, solicitante e comprovantes
// com link temporário (1 h) para validação por IA / conferência.
//   Authorization: Bearer PAGAMENTOS_INTEGRACAO_TOKEN
//   ?historico=1  inclui os eventos registrados (envios, etapas, erros)
export const runtime = 'nodejs'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!integracaoConfigurada()) return NextResponse.json({ error: 'PAGAMENTOS_INTEGRACAO_TOKEN não configurado no portal.' }, { status: 503 })
    if (!tokenIntegracaoValido(req.headers.get('authorization'))) return NextResponse.json({ error: 'Token inválido.' }, { status: 401 })
    const db = createAdminSupabaseClient()
    if (!db) return NextResponse.json({ error: MSG_NAO_CONFIGURADO }, { status: 503 })

    const { id } = await params
    if (!UUID.test(id)) return NextResponse.json({ error: 'id inválido.' }, { status: 400 })

    try {
        const dados = await montarDadosSolicitacao(db, id)
        if (!dados) return NextResponse.json({ error: 'Solicitação não encontrada.' }, { status: 404 })
        if (req.nextUrl.searchParams.get('historico') === '1') {
            const { data } = await db.from('pagamentos_eventos')
                .select('origem, tipo, status_anterior, status_novo, detalhes, erro, criado_em')
                .eq('solicitacao_id', id).order('criado_em')
            dados.historico = data ?? []
        }
        return NextResponse.json(dados)
    } catch (e) {
        console.error('[pagamentos] Consulta do n8n falhou:', e)
        return NextResponse.json({ error: 'Falha ao consultar.' }, { status: 500 })
    }
}
