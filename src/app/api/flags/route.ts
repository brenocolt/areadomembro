import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function GET() {
    const supabase = createServerSupabaseClient()

    const { data, error } = await supabase
        .from('flags')
        .select('*, colaboradores!flags_colaborador_id_fkey(nome)')
        .order('created_at', { ascending: false })

    if (error) {
        console.error('Erro ao buscar flags:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
}

export async function DELETE(request: Request) {
    const supabase = createServerSupabaseClient()

    const { id } = await request.json()

    if (!id) {
        return NextResponse.json({ error: 'ID da flag é obrigatório' }, { status: 400 })
    }

    const { error } = await supabase
        .from('flags')
        .delete()
        .eq('id', id)

    if (error) {
        console.error('Erro ao excluir flag:', error)
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
}
