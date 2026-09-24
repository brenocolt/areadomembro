import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { faseReuniao, mensagemErroBanco, type Reuniao } from '@/lib/reunioes'

const JANELA_HISTORICO_MS = 30 * 24 * 60 * 60 * 1000

// Reuniões em que o membro logado é participante (próximas e dos últimos
// 30 dias), com a situação dele em cada uma.
export async function GET() {
    const session = await auth()
    const colaboradorId = (session?.user as any)?.colaborador_id as string | undefined
    if (!colaboradorId) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()
    const desde = new Date(Date.now() - JANELA_HISTORICO_MS).toISOString()

    const { data, error } = await supabase
        .from('reuniao_participantes')
        .select('reunioes!inner(*)')
        .eq('colaborador_id', colaboradorId)
        .gte('reunioes.inicio', desde)
    if (error) {
        return NextResponse.json({ error: mensagemErroBanco(error, 'buscar suas reuniões') }, { status: 500 })
    }

    const reunioes = (data || []).map((d: any) => d.reunioes as Reuniao).filter(r => r.status !== 'cancelada')
    const ids = reunioes.map(r => r.id)

    const [{ data: presencas }, { data: pre }] = ids.length
        ? await Promise.all([
            supabase.from('reuniao_presencas').select('reuniao_id, situacao, registrado_em').eq('colaborador_id', colaboradorId).in('reuniao_id', ids),
            supabase.from('pontos_pre_pontuacao').select('reuniao_id').eq('colaborador_id', colaboradorId).in('reuniao_id', ids),
        ])
        : [{ data: [] }, { data: [] }]

    const presencaPor = new Map((presencas || []).map((p: any) => [p.reuniao_id, p]))
    const comPrePontuacao = new Set((pre || []).map((p: any) => p.reuniao_id))

    const agora = Date.now()
    const lista = reunioes
        .map(r => {
            const fase = faseReuniao(r, agora)
            const presenca = presencaPor.get(r.id)
            const situacao = presenca?.situacao
                || (fase === 'encerrada' && r.faltas_processadas_em ? (comPrePontuacao.has(r.id) ? 'falta' : 'justificado') : 'pendente')
            return {
                id: r.id,
                titulo: r.titulo,
                descricao: r.descricao,
                local: r.local,
                inicio: r.inicio,
                limite_chegada: r.limite_chegada,
                encerramento: r.encerramento,
                fase,
                situacao,
                registrado_em: presenca?.registrado_em || null,
            }
        })
        .sort((a, b) => new Date(b.inicio).getTime() - new Date(a.inicio).getTime())

    return NextResponse.json({ reunioes: lista, agora })
}
