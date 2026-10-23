import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import * as svc from '@/lib/reconhecimentos/servico'
import { exigirUuid } from '@/lib/reconhecimentos/validacao'

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return comAcessoReconhecimentos(async ({ db }) => {
        const id = exigirUuid((await params).id, 'Regra inválida.')
        return NextResponse.json(await svc.editarRegra(db, id, await req.json().catch(() => null)))
    })
}
