import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { faseReuniao, mensagemErroBanco, podeGerenciarReunioes, processarReunioesEncerradas } from '@/lib/reunioes'

// Lista de reuniões para a Gestão de Reuniões.
export async function GET() {
    const session = await auth()
    const colaboradorId = (session?.user as any)?.colaborador_id as string | undefined
    const role = (session?.user as any)?.role as string | undefined
    if (!(await podeGerenciarReunioes(colaboradorId, role))) {
        return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    // Garante que as faltas de reuniões encerradas já estejam geradas
    // quando a tela abre, mesmo entre execuções do agendador.
    await processarReunioesEncerradas()

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
        .from('reunioes')
        .select('*, reuniao_participantes(count), reuniao_presencas(situacao)')
        .order('inicio', { ascending: false })
        .limit(100)

    if (error) {
        return NextResponse.json({ error: mensagemErroBanco(error, 'buscar reuniões') }, { status: 500 })
    }

    const agora = Date.now()
    const reunioes = (data || []).map((r: any) => {
        const presencas: { situacao: string }[] = r.reuniao_presencas || []
        const { reuniao_participantes, reuniao_presencas: _presencas, ...resto } = r
        return {
            ...resto,
            fase: faseReuniao(r, agora),
            total_participantes: reuniao_participantes?.[0]?.count ?? 0,
            total_presentes: presencas.filter(p => p.situacao === 'presente').length,
            total_atrasados: presencas.filter(p => p.situacao === 'atrasado').length,
        }
    })
    return NextResponse.json({ reunioes })
}

// Cria uma reunião com a lista de participantes esperados.
export async function POST(req: NextRequest) {
    const session = await auth()
    const colaboradorId = (session?.user as any)?.colaborador_id as string | undefined
    const role = (session?.user as any)?.role as string | undefined
    if (!(await podeGerenciarReunioes(colaboradorId, role))) {
        return NextResponse.json({ error: 'Sem permissão.' }, { status: 403 })
    }

    const body = await req.json()
    const titulo = typeof body.titulo === 'string' ? body.titulo.trim() : ''
    const descricao = typeof body.descricao === 'string' && body.descricao.trim() ? body.descricao.trim() : null
    const local = typeof body.local === 'string' && body.local.trim() ? body.local.trim() : null
    const participantes: string[] = Array.isArray(body.participantes)
        ? [...new Set<string>(body.participantes.filter((p: unknown) => typeof p === 'string'))]
        : []

    const inicio = new Date(body.inicio)
    const limite = new Date(body.limite_chegada)
    const encerramento = new Date(body.encerramento)

    if (!titulo || titulo.length > 120) {
        return NextResponse.json({ error: 'Informe o título da reunião (até 120 caracteres).' }, { status: 400 })
    }
    if ([inicio, limite, encerramento].some(d => isNaN(d.getTime()))) {
        return NextResponse.json({ error: 'Informe início, limite de chegada e encerramento.' }, { status: 400 })
    }
    if (limite < inicio) {
        return NextResponse.json({ error: 'O limite de chegada não pode ser antes do início.' }, { status: 400 })
    }
    if (encerramento <= limite) {
        return NextResponse.json({ error: 'O encerramento precisa ser depois do limite de chegada.' }, { status: 400 })
    }
    if (encerramento.getTime() <= Date.now()) {
        return NextResponse.json({ error: 'O encerramento precisa estar no futuro.' }, { status: 400 })
    }
    if (participantes.length === 0) {
        return NextResponse.json({ error: 'Selecione ao menos um participante.' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()
    const { data: reuniao, error } = await supabase
        .from('reunioes')
        .insert({
            titulo,
            descricao,
            local,
            inicio: inicio.toISOString(),
            limite_chegada: limite.toISOString(),
            encerramento: encerramento.toISOString(),
            criado_por: colaboradorId || null,
        })
        .select()
        .single()

    if (error || !reuniao) {
        return NextResponse.json({ error: mensagemErroBanco(error!, 'criar reunião') }, { status: 500 })
    }

    const { error: partErr } = await supabase
        .from('reuniao_participantes')
        .insert(participantes.map(id => ({ reuniao_id: reuniao.id, colaborador_id: id })))

    if (partErr) {
        // Sem participantes a reunião não serve para nada — desfaz.
        await supabase.from('reunioes').delete().eq('id', reuniao.id)
        return NextResponse.json({ error: mensagemErroBanco(partErr, 'salvar participantes') }, { status: 500 })
    }

    return NextResponse.json({ reuniao })
}
