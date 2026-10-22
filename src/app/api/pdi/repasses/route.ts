import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirLider } from '@/lib/pdi-server'
import { sincronizarSlackRepasse } from '@/lib/pdi-repasses'
import { isDataValida, gerarHorariosRepasse, instanteSp } from '@/lib/pdi'

const DURACOES = [30, 60, 90, 120]
const SELECT = '*, criador:criador_id(nome), participantes:pdi_repasse_participantes(colaborador_id, entrou_em, colaborador:colaborador_id(nome, email_corporativo))'

// Repasses são criados e geridos por líderes (tático = gerente, ou diretor).
// GET: os repasses que o líder criou (administradores veem todos).
export async function GET() {
    const session = await auth()
    const supabase = createServerSupabaseClient()
    const acesso = await exigirLider(supabase, (session?.user as { colaborador_id?: string } | undefined)?.colaborador_id)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    let query = supabase.from('pdi_repasses').select(SELECT).order('criado_em', { ascending: false })
    if ((session?.user as { role?: string } | undefined)?.role !== 'ADMIN') query = query.eq('criador_id', acesso.colaboradorId)
    const { data, error } = await query
    if (error) return NextResponse.json({ error: 'Erro ao buscar repasses.', detalhe: error.message }, { status: 500 })
    return NextResponse.json({ repasses: data })
}

export async function POST(req: NextRequest) {
    const session = await auth()
    const supabase = createServerSupabaseClient()
    const acesso = await exigirLider(supabase, (session?.user as { colaborador_id?: string } | undefined)?.colaborador_id)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const b = await req.json()
    const texto = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    const titulo = texto(b.titulo)
    const descricao = texto(b.descricao)
    const categoria = texto(b.categoria)
    if (!titulo || titulo.length > 150) return NextResponse.json({ error: 'Informe um título (até 150 caracteres).' }, { status: 400 })
    if ((descricao?.length ?? 0) > 2000) return NextResponse.json({ error: 'Descrição muito longa (máx. 2000 caracteres).' }, { status: 400 })
    if ((categoria?.length ?? 0) > 60) return NextResponse.json({ error: 'Área muito longa.' }, { status: 400 })

    if (typeof b.data !== 'string' || !isDataValida(b.data, true)) return NextResponse.json({ error: 'Data inválida — escolha um dia útil de hoje até 60 dias à frente.' }, { status: 400 })
    if (typeof b.hora !== 'string' || !gerarHorariosRepasse().includes(b.hora)) return NextResponse.json({ error: 'Horário inválido.' }, { status: 400 })
    const duracao = Number(b.duracao_min ?? 60)
    if (!DURACOES.includes(duracao)) return NextResponse.json({ error: 'Duração inválida.' }, { status: 400 })

    if (typeof b.prazo_data !== 'string' || typeof b.prazo_hora !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(b.prazo_data) || !/^\d{2}:\d{2}$/.test(b.prazo_hora)) {
        return NextResponse.json({ error: 'Informe até quando os membros podem entrar (data e hora).' }, { status: 400 })
    }
    const prazo = instanteSp(b.prazo_data, b.prazo_hora)
    const inicio = instanteSp(b.data, b.hora)
    if (new Date(prazo).getTime() <= Date.now()) return NextResponse.json({ error: 'O prazo de adesão precisa estar no futuro.' }, { status: 400 })
    if (new Date(prazo).getTime() > new Date(inicio).getTime()) return NextResponse.json({ error: 'O prazo de adesão precisa ser antes do início do momento.' }, { status: 400 })

    let vagas: number | null = null
    if (b.vagas !== undefined && b.vagas !== null && b.vagas !== '') {
        vagas = Number(b.vagas)
        if (!Number.isInteger(vagas) || vagas < 1 || vagas > 200) return NextResponse.json({ error: 'Vagas deve ser um número entre 1 e 200 (ou deixe em branco).' }, { status: 400 })
    }

    const { data: repasse, error } = await supabase
        .from('pdi_repasses')
        .insert({ criador_id: acesso.colaboradorId, titulo, descricao, categoria, data: b.data, hora: b.hora, duracao_min: duracao, prazo_adesao: prazo, vagas })
        .select('id')
        .single()
    if (error || !repasse) return NextResponse.json({ error: 'Erro ao criar o repasse.', detalhe: error?.message }, { status: 500 })

    // Anuncia no Slack. Se falhar, o repasse continua criado e a tela avisa o motivo.
    const slack = await sincronizarSlackRepasse(supabase, repasse.id)
    return NextResponse.json({ id: repasse.id, slack })
}
