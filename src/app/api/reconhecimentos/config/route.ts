import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import { salvarPrazoPadrao } from '@/lib/reconhecimentos/repositorio'
import { parsePrazoPadrao } from '@/lib/reconhecimentos/validacao'

// Salvar o prazo padrão NÃO roda o motor (igual ao original).
export async function PUT(req: NextRequest) {
    return comAcessoReconhecimentos(async ({ db }) => {
        const { prazo_padrao_dias } = parsePrazoPadrao(await req.json().catch(() => null))
        await salvarPrazoPadrao(db, prazo_padrao_dias)
        return NextResponse.json({ ok: true })
    })
}
