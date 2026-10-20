import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import * as svc from '@/lib/reconhecimentos/servico'
import { exigirUuid } from '@/lib/reconhecimentos/validacao'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return comAcessoReconhecimentos(async ({ db }) => {
        const id = exigirUuid((await params).id, 'Tipo inválido.')
        return NextResponse.json({ tipo: await svc.editarTipo(db, id, await req.json().catch(() => null)) })
    })
}
