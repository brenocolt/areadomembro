import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import * as svc from '@/lib/reconhecimentos/servico'
import { exigirUuid } from '@/lib/reconhecimentos/validacao'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return comAcessoReconhecimentos(async ({ db, usuario }) => {
        const id = exigirUuid((await params).id, 'Bonificação inválida.')
        await svc.cancelarBonificacao(db, usuario, id, await req.json().catch(() => null))
        return NextResponse.json({ ok: true })
    })
}
