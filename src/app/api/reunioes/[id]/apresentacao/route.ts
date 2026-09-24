import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { codigoAtraso, faseReuniao, mensagemErroBanco, podeGerenciarReunioes, tokenQrAtual, type Reuniao } from '@/lib/reunioes'

// Estado da tela de apresentação, consultado a cada poucos segundos pelo
// organizador: token atual do QR (rotativo), código de atraso depois do
// limite de chegada e a contagem de confirmações.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    const colaboradorId = (session?.user as any)?.colaborador_id as string | undefined
    const role = (session?.user as any)?.role as string | undefined
    if (!(await podeGerenciarReunioes(colaboradorId, role))) {
        return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const { id } = await params
    const supabase = createServerSupabaseClient()
    const { data: reuniao, error } = await supabase.from('reunioes').select('*').eq('id', id).single()
    if (error || !reuniao) {
        return NextResponse.json({ error: error ? mensagemErroBanco(error, 'buscar reunião') : 'Reunião não encontrada.' }, { status: 404 })
    }

    const [{ count: totalParticipantes }, { data: presencas }] = await Promise.all([
        supabase.from('reuniao_participantes').select('*', { count: 'exact', head: true }).eq('reuniao_id', id),
        supabase.from('reuniao_presencas').select('situacao').eq('reuniao_id', id),
    ])

    const agora = Date.now()
    const fase = faseReuniao(reuniao as Reuniao, agora)
    const qr = fase === 'qr' ? tokenQrAtual(id, agora) : null

    return NextResponse.json({
        reuniao,
        fase,
        agora,
        token: qr?.token ?? null,
        tokenExpiraEm: qr?.expiraEm ?? null,
        codigo: fase === 'codigo' ? codigoAtraso(id) : null,
        totalParticipantes: totalParticipantes ?? 0,
        totalPresentes: (presencas || []).filter((p: any) => p.situacao === 'presente').length,
        totalAtrasados: (presencas || []).filter((p: any) => p.situacao === 'atrasado').length,
    })
}
