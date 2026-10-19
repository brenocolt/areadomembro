import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import { cancelarBonificacao } from '@/lib/reconhecimentos/repositorio'
import { exigirUuid, parseCancelamento } from '@/lib/reconhecimentos/validacao'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return comAcessoReconhecimentos(async ({ db, usuario }) => {
        const id = exigirUuid((await params).id, 'Bonificação inválida')
        const { justificativa } = parseCancelamento(await req.json().catch(() => null))
        await cancelarBonificacao(db, usuario.email, id, justificativa)
        return NextResponse.json({ ok: true })
    })
}
