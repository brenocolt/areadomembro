import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { faseReuniao, mensagemErroBanco, podeGerenciarReunioes, type Reuniao } from '@/lib/reunioes'

async function autorizar() {
    const session = await auth()
    const colaboradorId = (session?.user as any)?.colaborador_id as string | undefined
    const role = (session?.user as any)?.role as string | undefined
    return podeGerenciarReunioes(colaboradorId, role)
}

// Detalhe da reunião com a situação de cada participante.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await autorizar())) {
        return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }
    const { id } = await params
    const supabase = createServerSupabaseClient()

    const { data: reuniao, error } = await supabase.from('reunioes').select('*').eq('id', id).single()
    if (error || !reuniao) {
        return NextResponse.json({ error: error ? mensagemErroBanco(error, 'buscar reunião') : 'Reunião não encontrada.' }, { status: 404 })
    }

    const [{ data: participantes }, { data: presencas }, { data: prePontuacoes }] = await Promise.all([
        supabase
            .from('reuniao_participantes')
            .select('colaborador_id, colaboradores(nome, cargo_atual, nucleo_atual)')
            .eq('reuniao_id', id),
        supabase.from('reuniao_presencas').select('*').eq('reuniao_id', id),
        supabase.from('pontos_pre_pontuacao').select('colaborador_id, status, descricao').eq('reuniao_id', id),
    ])

    const fase = faseReuniao(reuniao as Reuniao)
    const presencaPor = new Map((presencas || []).map((p: any) => [p.colaborador_id, p]))
    const prePor = new Map<string, any>()
    for (const p of prePontuacoes || []) prePor.set(p.colaborador_id, p)

    const lista = (participantes || [])
        .map((p: any) => {
            const presenca = presencaPor.get(p.colaborador_id)
            const pre = prePor.get(p.colaborador_id)
            // Sem presença depois do processamento: falta, ou "justificado"
            // quando o job não gerou pré-pontuação (ausência aprovada).
            const situacao: string = presenca?.situacao
                || (fase === 'encerrada' && reuniao.faltas_processadas_em ? (pre ? 'falta' : 'justificado') : 'pendente')
            return {
                colaborador_id: p.colaborador_id,
                nome: p.colaboradores?.nome || 'Desconhecido',
                cargo_atual: p.colaboradores?.cargo_atual || null,
                nucleo_atual: p.colaboradores?.nucleo_atual || null,
                situacao,
                metodo: presenca?.metodo || null,
                registrado_em: presenca?.registrado_em || null,
                pre_pontuacao_status: pre?.status || null,
            }
        })
        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))

    return NextResponse.json({ reuniao: { ...reuniao, fase }, participantes: lista })
}

// Ações do organizador: cancelar a reunião ou marcar presença manualmente
// (ex.: membro sem celular). A presença manual revoga uma falta/atraso já
// pré-pontuado para essa pessoa nesta reunião.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await autorizar())) {
        return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }
    const { id } = await params
    const body = await req.json()
    const supabase = createServerSupabaseClient()

    if (body.acao === 'cancelar') {
        const { error } = await supabase.from('reunioes').update({ status: 'cancelada' }).eq('id', id)
        if (error) return NextResponse.json({ error: mensagemErroBanco(error, 'cancelar reunião') }, { status: 500 })
        return NextResponse.json({ ok: true })
    }

    if (body.acao === 'marcar_presenca' && typeof body.colaborador_id === 'string') {
        const { data: participante } = await supabase
            .from('reuniao_participantes')
            .select('colaborador_id')
            .eq('reuniao_id', id)
            .eq('colaborador_id', body.colaborador_id)
            .maybeSingle()
        if (!participante) {
            return NextResponse.json({ error: 'Essa pessoa não está na lista da reunião.' }, { status: 400 })
        }

        const { error } = await supabase.from('reuniao_presencas').upsert({
            reuniao_id: id,
            colaborador_id: body.colaborador_id,
            situacao: 'presente',
            metodo: 'manual',
            registrado_em: new Date().toISOString(),
        })
        if (error) return NextResponse.json({ error: mensagemErroBanco(error, 'marcar presença') }, { status: 500 })

        await supabase
            .from('pontos_pre_pontuacao')
            .update({ status: 'REVOGADO' })
            .eq('reuniao_id', id)
            .eq('colaborador_id', body.colaborador_id)
            .eq('status', 'PENDENTE')

        return NextResponse.json({ ok: true })
    }

    return NextResponse.json({ error: 'Ação inválida.' }, { status: 400 })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    if (!(await autorizar())) {
        return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }
    const { id } = await params
    const supabase = createServerSupabaseClient()
    const { error } = await supabase.from('reunioes').delete().eq('id', id)
    if (error) return NextResponse.json({ error: mensagemErroBanco(error, 'excluir reunião') }, { status: 500 })
    return NextResponse.json({ ok: true })
}
