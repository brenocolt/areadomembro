import { NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import { sincronizarBonificacoes } from '@/lib/reconhecimentos/repositorio'

export const dynamic = 'force-dynamic'

// Gatilho 1: abertura da aba.
export async function POST() {
    return comAcessoReconhecimentos(async ({ db, usuario }) => NextResponse.json(await sincronizarBonificacoes(db, usuario.email)))
}
