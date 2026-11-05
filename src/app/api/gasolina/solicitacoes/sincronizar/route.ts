import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirMembroGasolina } from '@/lib/gasolina-server'
import { sincronizarSolicitacoes } from '@/lib/gasolina-scheduler'

// Botão "Atualizar" da aba Solicitações: confere agora no Monday o status
// dos cards em aberto (do membro; da VP com ?todos=1), sem esperar o job.
// Trava simples por usuário para não martelar a API do Monday.
const ultimaVez = new Map<string, number>()
const INTERVALO_MS = 30 * 1000

export async function POST(req: NextRequest) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const todos = req.nextUrl.searchParams.get('todos') === '1'
    if (todos && !acesso.gestor) {
        return NextResponse.json({ error: 'Apenas a Vice Presidência pode atualizar as solicitações de todos.' }, { status: 403 })
    }

    const agora = Date.now()
    if (agora - (ultimaVez.get(acesso.colaboradorId) ?? 0) < INTERVALO_MS) {
        return NextResponse.json({ atualizadas: 0, aguarde: true })
    }
    ultimaVez.set(acesso.colaboradorId, agora)

    try {
        const atualizadas = await sincronizarSolicitacoes(todos ? {} : { colaboradorId: acesso.colaboradorId })
        return NextResponse.json({ atualizadas })
    } catch (err) {
        console.error('[gasolina] Falha ao atualizar solicitações sob demanda:', err)
        return NextResponse.json({ error: 'Não foi possível consultar o Monday agora. Tente de novo em instantes.' }, { status: 502 })
    }
}
