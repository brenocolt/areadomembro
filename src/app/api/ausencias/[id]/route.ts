import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const session = await auth()
    const colaboradorId = (session?.user as any)?.colaborador_id as string | undefined

    if (!colaboradorId) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const { id } = await params
    const body = await req.json()
    const supabase = createServerSupabaseClient()

    const { data: ausencia, error: fetchError } = await supabase
        .from('ausencias')
        .select('*')
        .eq('id', id)
        .single()

    if (fetchError || !ausencia) {
        return NextResponse.json({ error: 'Ausência não encontrada.' }, { status: 404 })
    }

    // Cada colaborador só pode editar as ausências que ele mesmo registrou.
    if (ausencia.colaborador_id !== colaboradorId) {
        return NextResponse.json({ error: 'Você não tem permissão para editar esta ausência.' }, { status: 403 })
    }

    const now = new Date()
    const dataIdaAtual = new Date(ausencia.data_ida + 'T00:00:00')
    const dataVoltaAtual = new Date(ausencia.data_volta + 'T23:59:59')
    const jaIniciou = now >= dataIdaAtual
    const jaConcluiu = now > dataVoltaAtual

    // Passado o período (ida e volta já ocorreram), a ausência vira histórico
    // e não pode mais ser alterada.
    if (jaConcluiu) {
        return NextResponse.json({ error: 'Esta ausência já foi concluída e não pode mais ser editada.' }, { status: 403 })
    }

    if (jaIniciou && body.data_ida !== undefined && body.data_ida !== ausencia.data_ida) {
        return NextResponse.json({ error: 'Não é possível alterar a data de início de uma ausência que já começou.' }, { status: 403 })
    }

    const updates: Record<string, any> = {}
    if (!jaIniciou && body.data_ida !== undefined) updates.data_ida = body.data_ida
    if (body.data_volta !== undefined) updates.data_volta = body.data_volta
    if (body.localizacao !== undefined) updates.localizacao = body.localizacao
    if (body.justificativa !== undefined) updates.justificativa = body.justificativa

    if (Object.keys(updates).length === 0) {
        return NextResponse.json({ error: 'Nenhuma alteração informada.' }, { status: 400 })
    }

    const finalDataIda = updates.data_ida ?? ausencia.data_ida
    const finalDataVolta = updates.data_volta ?? ausencia.data_volta

    if (new Date(finalDataVolta + 'T12:00:00') < new Date(finalDataIda + 'T12:00:00')) {
        return NextResponse.json({ error: 'A data de volta não pode ser anterior à data de ida.' }, { status: 400 })
    }

    if (!jaIniciou) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        if (new Date(finalDataIda + 'T00:00:00') < today) {
            return NextResponse.json({ error: 'A data de início não pode ser no passado.' }, { status: 400 })
        }
    }

    const { data: updated, error: updateError } = await supabase
        .from('ausencias')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

    if (updateError) {
        return NextResponse.json({ error: 'Erro ao atualizar ausência.' }, { status: 500 })
    }

    return NextResponse.json({ ausencia: updated })
}
