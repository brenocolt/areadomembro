import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isDataValida, gerarHorariosDisponiveis, formatarTiposComOpcoes } from '@/lib/pdi'
import { registrarEvento } from '@/lib/pdi-server'

export async function GET() {
    const session = await auth()
    const colaboradorId = (session?.user as any)?.colaborador_id as string | undefined
    if (!colaboradorId) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
        .from('pdi_solicitacoes')
        .select('*, pdi_solicitacao_lideres(papel_id, lider_id, aceito_em, lider:lider_id(nome))')
        .eq('colaborador_id', colaboradorId)
        .order('criado_em', { ascending: false })

    if (error) {
        return NextResponse.json({ error: 'Erro ao buscar solicitações.' }, { status: 500 })
    }

    return NextResponse.json({ solicitacoes: data })
}

export async function POST(req: NextRequest) {
    const session = await auth()
    const colaboradorId = (session?.user as any)?.colaborador_id as string | undefined
    if (!colaboradorId) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const body = await req.json()
    const { cargos, tipos, detalhes, outro_texto, data, hora, descricao } = body

    if (!Array.isArray(cargos) || cargos.length === 0) {
        return NextResponse.json({ error: 'Selecione ao menos um papel de liderança.' }, { status: 400 })
    }
    if (!Array.isArray(tipos) || tipos.length === 0) {
        return NextResponse.json({ error: 'Selecione ao menos um tipo de momento.' }, { status: 400 })
    }
    if (!data || !isDataValida(data)) {
        return NextResponse.json({ error: 'Data inválida — escolha um dia útil a partir de amanhã, em até 60 dias.' }, { status: 400 })
    }
    if (!hora || !gerarHorariosDisponiveis().includes(hora)) {
        return NextResponse.json({ error: 'Horário inválido.' }, { status: 400 })
    }

    const supabase = createServerSupabaseClient()

    const { data: papeisValidos } = await supabase.from('pdi_papeis').select('id, nome')
    const idsValidos = new Set((papeisValidos || []).map((p: any) => p.id))
    if (!cargos.every((c: string) => idsValidos.has(c))) {
        return NextResponse.json({ error: 'Papel de liderança inválido.' }, { status: 400 })
    }

    const { data: tiposValidos } = await supabase.from('pdi_tipos_momento').select('*').eq('ativo', true)
    const tiposIdsValidos = new Set((tiposValidos || []).map((t: any) => t.id))
    for (const tipoId of tipos) {
        if (!tiposIdsValidos.has(tipoId)) {
            return NextResponse.json({ error: 'Tipo de momento inválido.' }, { status: 400 })
        }
        if (tipoId === 'outro') {
            if (!outro_texto || !outro_texto.trim() || outro_texto.length > 60) {
                return NextResponse.json({ error: 'Descreva o "Outro" tipo de momento (até 60 caracteres).' }, { status: 400 })
            }
        } else {
            const opcoesEscolhidas = detalhes?.[tipoId]
            if (!Array.isArray(opcoesEscolhidas) || opcoesEscolhidas.length === 0) {
                return NextResponse.json({ error: 'Escolha ao menos uma opção para cada tipo de momento selecionado.' }, { status: 400 })
            }
        }
    }

    // Bloqueia horários em que já exista solicitação ativa para algum dos
    // papéis escolhidos (§3).
    const { data: conflitos } = await supabase
        .from('pdi_solicitacoes')
        .select('id, cargos')
        .eq('data', data)
        .eq('hora', hora)
        .in('status', ['aguardando', 'agendado', 'reagendado'])
    const temConflito = (conflitos || []).some((c: any) => (c.cargos || []).some((cg: string) => cargos.includes(cg)))
    if (temConflito) {
        return NextResponse.json({ error: 'Já existe uma solicitação ativa nesse horário para um dos papéis escolhidos.' }, { status: 409 })
    }

    const { data: solicitacao, error: insertError } = await supabase
        .from('pdi_solicitacoes')
        .insert({
            colaborador_id: colaboradorId,
            cargos,
            tipos,
            detalhes: detalhes || {},
            outro_texto: outro_texto || null,
            data,
            hora,
            descricao: descricao || null,
        })
        .select()
        .single()

    if (insertError || !solicitacao) {
        return NextResponse.json({ error: 'Erro ao criar solicitação.' }, { status: 500 })
    }

    await supabase.from('pdi_solicitacao_lideres').insert(
        cargos.map((papel_id: string) => ({ solicitacao_id: solicitacao.id, papel_id }))
    )

    const { data: colaborador } = await supabase.from('colaboradores').select('nome, nucleo_atual').eq('id', colaboradorId).single()
    const papeisNomes = cargos.map((c: string) => (papeisValidos || []).find((p: any) => p.id === c)?.nome || c)
    const tiposTexto = formatarTiposComOpcoes((tiposValidos || []) as any, tipos, detalhes || {}, outro_texto)

    await registrarEvento(supabase, {
        solicitacaoId: solicitacao.id,
        tipo: 'nova',
        autorId: colaboradorId,
        texto: `Nova solicitação de ${colaborador?.nome || 'um colaborador'} para ${data} às ${hora}.`,
        colaboradorId,
        cargos,
        slackContexto: {
            colaboradorNome: colaborador?.nome,
            colaboradorNucleo: colaborador?.nucleo_atual,
            papeisNomes,
            tiposTexto,
            data,
            hora,
            descricao,
        },
    })

    return NextResponse.json({ solicitacao })
}
