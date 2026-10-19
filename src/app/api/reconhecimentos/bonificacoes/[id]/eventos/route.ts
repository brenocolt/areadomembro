import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import { listarEventos } from '@/lib/reconhecimentos/repositorio'
import { exigirUuid } from '@/lib/reconhecimentos/validacao'

export const dynamic = 'force-dynamic'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return comAcessoReconhecimentos(async ({ db }) => {
        const id = exigirUuid((await params).id, 'Bonificação inválida')
        return NextResponse.json({ eventos: await listarEventos(db, id) })
    })
}
