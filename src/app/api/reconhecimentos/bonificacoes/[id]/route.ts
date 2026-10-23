import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import * as svc from '@/lib/reconhecimentos/servico'
import { exigirUuid } from '@/lib/reconhecimentos/validacao'

export const dynamic = 'force-dynamic'

// GET: bonificação + entregas individuais + histórico.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return comAcessoReconhecimentos(async ({ db }) => {
        const id = exigirUuid((await params).id, 'Bonificação inválida.')
        return NextResponse.json(await svc.obterBonificacao(db, id))
    })
}
