import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import { excluirReconhecimento } from '@/lib/reconhecimentos/repositorio'
import { exigirUuid } from '@/lib/reconhecimentos/validacao'

// Excluir reconhecimento: não roda o motor e mantém as bonificações já geradas.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return comAcessoReconhecimentos(async ({ db }) => {
        await excluirReconhecimento(db, exigirUuid((await params).id, 'Reconhecimento inválido'))
        return NextResponse.json({ ok: true })
    })
}
