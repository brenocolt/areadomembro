import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import { listarDados, registrarReconhecimento } from '@/lib/reconhecimentos/repositorio'
import { parseRegistro } from '@/lib/reconhecimentos/validacao'

export const dynamic = 'force-dynamic'

// GET: tudo que a aba precisa para renderizar (tipos, regras, reconhecimentos, bonificações, configuração).
export async function GET() {
    return comAcessoReconhecimentos(async ({ db }) => NextResponse.json(await listarDados(db)))
}

// POST: registra reconhecimento(s) e roda o motor (gatilho 2).
export async function POST(req: NextRequest) {
    return comAcessoReconhecimentos(async ({ db, usuario }) => {
        const entrada = parseRegistro(await req.json().catch(() => null))
        return NextResponse.json(await registrarReconhecimento(db, usuario.email, entrada))
    })
}
