import { NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import * as svc from '@/lib/reconhecimentos/servico'

export const dynamic = 'force-dynamic'

export async function GET() {
    return comAcessoReconhecimentos(async ({ db }) => NextResponse.json({ colaboradores: await svc.listarColaboradores(db) }))
}
