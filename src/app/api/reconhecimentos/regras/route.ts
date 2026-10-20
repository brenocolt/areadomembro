import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import * as svc from '@/lib/reconhecimentos/servico'

export async function POST(req: NextRequest) {
    return comAcessoReconhecimentos(async ({ db, usuario }) =>
        NextResponse.json(await svc.criarRegra(db, usuario, await req.json().catch(() => null)), { status: 201 }))
}
