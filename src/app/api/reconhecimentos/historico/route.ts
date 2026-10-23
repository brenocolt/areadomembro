import { NextRequest, NextResponse } from 'next/server'
import { comAcessoReconhecimentos } from '@/lib/reconhecimentos/guard'
import * as svc from '@/lib/reconhecimentos/servico'
import { exigirUuid } from '@/lib/reconhecimentos/validacao'
import { ErroDeRequisicao } from '@/lib/reconhecimentos/erros'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
    return comAcessoReconhecimentos(async ({ db }) => {
        const p = req.nextUrl.searchParams
        const opcional = (nome: string, msg: string) => (p.get(nome) ? exigirUuid(p.get(nome), msg) : undefined)
        const antes = p.get('antes') ?? undefined
        if (antes && Number.isNaN(Date.parse(antes))) throw new ErroDeRequisicao('Parâmetro "antes" inválido.')
        const limite = p.get('limite') ? Number(p.get('limite')) : undefined
        if (limite !== undefined && !Number.isInteger(limite)) throw new ErroDeRequisicao('Parâmetro "limite" inválido.')
        return NextResponse.json({
            eventos: await svc.listarHistorico(db, {
                reconhecimento_id: opcional('reconhecimento_id', 'Reconhecimento inválido.'),
                bonificacao_id: opcional('bonificacao_id', 'Bonificação inválida.'),
                antes, limite,
            }),
        })
    })
}
