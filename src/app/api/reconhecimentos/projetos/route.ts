import { NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import { listarProjetos } from '@/lib/reconhecimentos/repositorio'

export const dynamic = 'force-dynamic'

export async function GET() {
    return comAcessoReconhecimentos(async ({ db }) => NextResponse.json({ projetos: await listarProjetos(db) }))
}
