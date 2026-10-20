import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import * as svc from '@/lib/reconhecimentos/servico'
import { exigirUuid } from '@/lib/reconhecimentos/validacao'

export const dynamic = 'force-dynamic'

// Sugestão do próximo número de RG do projeto (maior número registrado + 1).
export async function GET(req: NextRequest) {
    return comAcessoReconhecimentos(async ({ db }) => {
        const projetoId = exigirUuid(req.nextUrl.searchParams.get('projeto_id'), 'Selecione o projeto.')
        return NextResponse.json({ proximo: await svc.proximoRg(db, projetoId) })
    })
}
