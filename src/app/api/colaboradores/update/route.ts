import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function PUT(request: Request) {
    const supabase = createServerSupabaseClient()
    const body = await request.json()

    const { colaboradorId, updateObj, role, currentRole, auditLogs } = body

    if (!colaboradorId) {
        return NextResponse.json({ error: 'ID do colaborador é obrigatório' }, { status: 400 })
    }

    // Update colaboradores
    const { error: colabErr } = await supabase
        .from('colaboradores')
        .update(updateObj)
        .eq('id', colaboradorId)

    if (colabErr) {
        return NextResponse.json({ error: colabErr.message }, { status: 500 })
    }

    // Update user role if changed
    if (role && role !== currentRole) {
        const { error: roleErr } = await supabase
            .from('users')
            .update({ role })
            .eq('colaborador_id', colaboradorId)

        if (roleErr) {
            return NextResponse.json({ error: roleErr.message }, { status: 500 })
        }
    }

    // Insert audit logs
    if (auditLogs && auditLogs.length > 0) {
        const { error: logErr } = await supabase
            .from('audit_logs')
            .insert(auditLogs.map((log: any) => ({
                colaborador_id: colaboradorId,
                campo: log.campo,
                valor_antigo: log.valor_antigo,
                valor_novo: log.valor_novo,
                editado_por: log.editado_por,
            })))

        if (logErr) {
            console.error('Erro ao salvar audit logs:', logErr)
        }
    }

    return NextResponse.json({ success: true })
}
