import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import * as svc from '@/lib/reconhecimentos/servico'
import { exigirUuid } from '@/lib/reconhecimentos/validacao'

// PUT: edita (data, projeto/colaborador/núcleo, nº da RG, observações). O histórico registra de → para e o autor.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return comAcessoReconhecimentos(async ({ db, usuario }) => {
        const id = exigirUuid((await params).id, 'Reconhecimento inválido.')
        return NextResponse.json(await svc.editarReconhecimento(db, usuario, id, await req.json().catch(() => null)))
    })
}
