import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import { entregarBonificacao } from '@/lib/reconhecimentos/repositorio'
import { exigirUuid, parseEntrega } from '@/lib/reconhecimentos/validacao'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return comAcessoReconhecimentos(async ({ db, usuario }) => {
        const id = exigirUuid((await params).id, 'Bonificação inválida')
        const entrega = parseEntrega(await req.json().catch(() => null))
        await entregarBonificacao(db, usuario.email, id, entrega)
        return NextResponse.json({ ok: true })
    })
}
