import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import * as svc from '@/lib/reconhecimentos/servico'
import { exigirUuid } from '@/lib/reconhecimentos/validacao'

// POST: exclusão lógica (exige motivo); o registro e o histórico permanecem.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return comAcessoReconhecimentos(async ({ db, usuario }) => {
        const id = exigirUuid((await params).id, 'Reconhecimento inválido.')
        await svc.excluirReconhecimento(db, usuario, id, await req.json().catch(() => null))
        return NextResponse.json({ ok: true })
    })
}
