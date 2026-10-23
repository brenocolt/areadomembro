import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import * as svc from '@/lib/reconhecimentos/servico'

export const dynamic = 'force-dynamic'

const corpo = (req: NextRequest) => req.json().catch(() => null)

// GET: tudo que a aba precisa para renderizar (tipos, núcleos, regras, reconhecimentos, bonificações, entregas).
export async function GET() {
    return comAcessoReconhecimentos(async ({ db }) => NextResponse.json(await svc.listarDados(db)))
}

// POST: registra um reconhecimento e gera as bonificações devidas.
export async function POST(req: NextRequest) {
    return comAcessoReconhecimentos(async ({ db, usuario }) =>
        NextResponse.json(await svc.criarReconhecimento(db, usuario, await corpo(req)), { status: 201 }))
}
