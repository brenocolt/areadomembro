import { NextRequest, NextResponse } from 'next/server'
import { sincronizarSolicitacoes } from '@/lib/gasolina-scheduler'

// Webhook do Monday ("quando o status mudar, enviar um webhook") no board
// Processos de Pagamento: deixa Lançado/Pago/Recusado instantâneos no app (e
// os avisos ao membro). O Monday não manda senha nesse tipo de webhook, então
// o corpo só serve para saber QUAL card mudou: o status em si é lido de novo
// na API do Monday, e cards que não são solicitações do app são ignorados.
// A sincronização a cada minuto continua como reserva.
export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => ({}))

    // Verificação do Monday ao cadastrar o webhook: devolver o mesmo desafio.
    if (typeof body?.challenge === 'string') return NextResponse.json({ challenge: body.challenge })

    const itemId = String(body?.event?.pulseId ?? '').trim()
    if (!/^\d{1,20}$/.test(itemId)) return NextResponse.json({ ok: true })

    try {
        const alteradas = await sincronizarSolicitacoes({ mondayItemId: itemId })
        return NextResponse.json({ ok: true, alteradas })
    } catch (err) {
        console.error(`[gasolina] Webhook do Monday (card ${itemId}):`, err)
        return NextResponse.json({ ok: false }, { status: 500 })
    }
}
