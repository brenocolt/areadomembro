import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import * as svc from '@/lib/reconhecimentos/servico'
import { exigirUuid } from '@/lib/reconhecimentos/validacao'

// POST: conclui o cartão ("Entregue"). Só com ≥ 1 entrega concluída e nenhuma pendente.
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return comAcessoReconhecimentos(async ({ db, usuario }) => {
        const id = exigirUuid((await params).id, 'Bonificação inválida.')
        await svc.concluirBonificacao(db, usuario, id)
        return NextResponse.json({ ok: true })
    })
}
