import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import {
    codigoAtrasoValido,
    descricaoPrePontuacao,
    faseReuniao,
    mensagemErroBanco,
    tokenQrValido,
    type Reuniao,
} from '@/lib/reunioes'

// O código de atraso tem 6 dígitos — sem limite, dá para descobrir por
// tentativa. O app roda como um único processo (ver instrumentation.ts),
// então um contador em memória basta.
const MAX_TENTATIVAS_CODIGO = 5
const tentativasErradas = new Map<string, number>()

// Confirmação de presença do membro logado: `token` (lido do QR, até o
// limite de chegada) ou `codigo` (digitado depois do limite, gera
// pré-pontuação por atraso).
export async function POST(req: NextRequest) {
    const session = await auth()
    const colaboradorId = (session?.user as any)?.colaborador_id as string | undefined
    if (!colaboradorId) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await req.json()
    const reuniaoId = typeof body.reuniao_id === 'string' ? body.reuniao_id : ''
    const token = typeof body.token === 'string' ? body.token : null
    const codigo = typeof body.codigo === 'string' ? body.codigo : null
    if (!reuniaoId || (!token && !codigo)) {
        return NextResponse.json({ error: 'Leia o QR code ou informe o código.' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    const { data: reuniao, error } = await supabase.from('reunioes').select('*').eq('id', reuniaoId).maybeSingle()
    if (error) return NextResponse.json({ error: mensagemErroBanco(error, 'buscar reunião') }, { status: 500 })
    if (!reuniao) return NextResponse.json({ error: 'Reunião não encontrada.' }, { status: 404 })

    const { data: participante } = await supabase
        .from('reuniao_participantes')
        .select('colaborador_id')
        .eq('reuniao_id', reuniaoId)
        .eq('colaborador_id', colaboradorId)
        .maybeSingle()
    if (!participante) {
        return NextResponse.json({ error: 'Você não está na lista de participantes desta reunião. Fale com o organizador.' }, { status: 403 })
    }

    const { data: jaRegistrada } = await supabase
        .from('reuniao_presencas')
        .select('situacao, registrado_em')
        .eq('reuniao_id', reuniaoId)
        .eq('colaborador_id', colaboradorId)
        .maybeSingle()
    if (jaRegistrada) {
        return NextResponse.json({ ok: true, jaRegistrada: true, situacao: jaRegistrada.situacao, registrado_em: jaRegistrada.registrado_em })
    }

    const fase = faseReuniao(reuniao as Reuniao)
    if (fase === 'cancelada') {
        return NextResponse.json({ error: 'Esta reunião foi cancelada.' }, { status: 400 })
    }
    if (fase === 'encerrada') {
        return NextResponse.json({ error: 'O prazo para confirmar presença nesta reunião já terminou.', fase }, { status: 400 })
    }

    let situacao: 'presente' | 'atrasado'
    if (token) {
        if (!tokenQrValido(reuniaoId, token)) {
            return NextResponse.json({ error: 'QR code expirado ou inválido. Leia o QR code que está sendo exibido agora.' }, { status: 400 })
        }
        if (fase !== 'qr') {
            return NextResponse.json({ error: 'O horário limite de chegada já passou. Digite o código exibido pelo organizador.', fase }, { status: 400 })
        }
        situacao = 'presente'
    } else {
        if (fase === 'qr') {
            return NextResponse.json({ error: 'Ainda está dentro do horário de chegada — leia o QR code exibido na reunião.', fase }, { status: 400 })
        }
        const chave = `${reuniaoId}:${colaboradorId}`
        const erros = tentativasErradas.get(chave) || 0
        if (erros >= MAX_TENTATIVAS_CODIGO) {
            return NextResponse.json({ error: 'Muitas tentativas com código errado. Fale com o organizador para registrar sua presença.' }, { status: 429 })
        }
        if (!codigoAtrasoValido(reuniaoId, codigo!)) {
            tentativasErradas.set(chave, erros + 1)
            const restantes = MAX_TENTATIVAS_CODIGO - erros - 1
            return NextResponse.json({ error: `Código incorreto. ${restantes} tentativa(s) restante(s).` }, { status: 400 })
        }
        tentativasErradas.delete(chave)
        situacao = 'atrasado'
    }

    const registradoEm = new Date().toISOString()
    const { error: insErr } = await supabase.from('reuniao_presencas').insert({
        reuniao_id: reuniaoId,
        colaborador_id: colaboradorId,
        situacao,
        metodo: token ? 'qr' : 'codigo',
        registrado_em: registradoEm,
    })
    if (insErr) {
        // Dois envios quase simultâneos: o primeiro já registrou.
        if (insErr.code === '23505') return NextResponse.json({ ok: true, jaRegistrada: true, situacao })
        return NextResponse.json({ error: mensagemErroBanco(insErr, 'registrar presença') }, { status: 500 })
    }

    if (situacao === 'atrasado') {
        const { error: preErr } = await supabase.from('pontos_pre_pontuacao').insert({
            colaborador_id: colaboradorId,
            reuniao_id: reuniaoId,
            descricao: descricaoPrePontuacao(reuniao as Reuniao, 'atraso'),
            origem: 'auto',
            status: 'PENDENTE',
        })
        if (preErr) console.error('[reunioes] Falha ao pré-pontuar atraso', reuniaoId, colaboradorId, preErr.message)
    }

    return NextResponse.json({ ok: true, situacao, registrado_em: registradoEm })
}
