import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import { salvarRegra } from '@/lib/reconhecimentos/repositorio'
import { parseRegra } from '@/lib/reconhecimentos/validacao'

// Gatilho 4: salvar (criar) regra roda o motor.
export async function POST(req: NextRequest) {
    return comAcessoReconhecimentos(async ({ db, usuario }) => {
        const entrada = parseRegra(await req.json().catch(() => null))
        return NextResponse.json(await salvarRegra(db, usuario.email, null, entrada))
    })
}
