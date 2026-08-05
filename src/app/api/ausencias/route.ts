import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
    const session = await auth()
    const colaboradorId = (session?.user as any)?.colaborador_id as string | undefined

    if (!colaboradorId) {
        return NextResponse.json({ error: 'Não autenticado.' }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
        .from('ausencias')
        .select('*')
        .eq('colaborador_id', colaboradorId)
        .order('data_ida', { ascending: true })

    if (error) {
        return NextResponse.json({ error: 'Erro ao buscar ausências.' }, { status: 500 })
    }

    return NextResponse.json({ ausencias: data })
}
