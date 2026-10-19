import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import { salvarRegra } from '@/lib/reconhecimentos/repositorio'
import { exigirUuid, parseRegra } from '@/lib/reconhecimentos/validacao'

// Gatilho 4: salvar (editar) regra roda o motor.
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    return comAcessoReconhecimentos(async ({ db, usuario }) => {
        const id = exigirUuid((await params).id, 'Regra inválida')
        const entrada = parseRegra(await req.json().catch(() => null))
        return NextResponse.json(await salvarRegra(db, usuario.email, id, entrada))
    })
}
