import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import { criarTipo } from '@/lib/reconhecimentos/repositorio'
import { parseTipo } from '@/lib/reconhecimentos/validacao'

export async function POST(req: NextRequest) {
    return comAcessoReconhecimentos(async ({ db }) => {
        const { nome } = parseTipo(await req.json().catch(() => null))
        await criarTipo(db, nome)
        return NextResponse.json({ ok: true })
    })
}
