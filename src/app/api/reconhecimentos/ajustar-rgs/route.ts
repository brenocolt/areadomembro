import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import { ajustarRgsAnteriores } from '@/lib/reconhecimentos/repositorio'
import { parseAjuste } from '@/lib/reconhecimentos/validacao'

// Gatilho 3: ajuste das RGs anteriores ao sistema.
export async function POST(req: NextRequest) {
    return comAcessoReconhecimentos(async ({ db, usuario }) => {
        const { projeto_id, quantidade } = parseAjuste(await req.json().catch(() => null))
        return NextResponse.json(await ajustarRgsAnteriores(db, usuario.email, projeto_id, quantidade))
    })
}
