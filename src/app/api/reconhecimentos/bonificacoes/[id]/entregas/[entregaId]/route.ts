import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import * as svc from '@/lib/reconhecimentos/servico'
import { exigirUuid } from '@/lib/reconhecimentos/validacao'

// PUT: muda a situação/datas de UM colaborador (solicitada → aprovada → entregue).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; entregaId: string }> }) {
    return comAcessoReconhecimentos(async ({ db, usuario }) => {
        const p = await params
        const id = exigirUuid(p.id, 'Bonificação inválida.')
        const entregaId = exigirUuid(p.entregaId, 'Entrega inválida.')
        return NextResponse.json(await svc.atualizarEntrega(db, usuario, id, entregaId, await req.json().catch(() => null)))
    })
}
