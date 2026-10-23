import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import * as svc from '@/lib/reconhecimentos/servico'

// PUT: define se um núcleo (da lista do sistema) é elegível a reconhecimentos.
export async function PUT(req: NextRequest) {
    return comAcessoReconhecimentos(async ({ db }) => NextResponse.json({ nucleo: await svc.configurarNucleo(db, await req.json().catch(() => null)) }))
}
