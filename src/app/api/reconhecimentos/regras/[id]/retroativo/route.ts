import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import * as svc from '@/lib/reconhecimentos/servico'
import { exigirUuid } from '@/lib/reconhecimentos/validacao'

export const dynamic = 'force-dynamic'

// GET: prévia do que seria gerado para registros anteriores à regra (não grava).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return comAcessoReconhecimentos(async ({ db }) => {
        const id = exigirUuid((await params).id, 'Regra inválida.')
        return NextResponse.json(await svc.previaRetroativa(db, id))
    })
}

// POST: aplica a regra a registros anteriores (idempotente).
export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return comAcessoReconhecimentos(async ({ db }) => {
        const id = exigirUuid((await params).id, 'Regra inválida.')
        return NextResponse.json(await svc.aplicarRetroativo(db, id))
    })
}
