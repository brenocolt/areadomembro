import { NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import * as svc from '@/lib/reconhecimentos/servico'

export const dynamic = 'force-dynamic'

// Ao abrir a aba: gera o que faltar (idempotente) e expira o que venceu (autor "sistema").
export async function POST() {
    return comAcessoReconhecimentos(async ({ db, dbSistema }) => NextResponse.json(await svc.sincronizar(db, dbSistema)))
}
