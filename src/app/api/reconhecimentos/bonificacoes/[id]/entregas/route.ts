import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import * as svc from '@/lib/reconhecimentos/servico'
import { exigirUuid } from '@/lib/reconhecimentos/validacao'

// POST: adiciona um ou vários colaboradores (solicitada/aprovada/entregue), sem duplicar ninguém.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return comAcessoReconhecimentos(async ({ db, usuario }) => {
        const id = exigirUuid((await params).id, 'Bonificação inválida.')
        return NextResponse.json(await svc.adicionarEntregas(db, usuario, id, await req.json().catch(() => null)), { status: 201 })
    })
}
