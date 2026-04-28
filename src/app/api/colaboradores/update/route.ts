import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function PUT(request: Request) {
    const supabase = createServerSupabaseClient()
    const body = await request.json()

    const { colaboradorId, updateObj, role, currentRole, auditLogs } = body

    if (!colaboradorId) {
        return NextResponse.json({ error: 'ID do colaborador é obrigatório' }, { status: 400 })
    }

    // Extract saldo_milhas before updating colaboradores
    const { saldo_milhas, ...colaboradorUpdate } = updateObj

    // Update colaboradores
    const { error: colabErr } = await supabase
        .from('colaboradores')
        .update(colaboradorUpdate)
        .eq('id', colaboradorId)

    if (colabErr) {
        return NextResponse.json({ error: colabErr.message }, { status: 500 })
    }

    // Update milhas_saldo if present
    if (saldo_milhas !== undefined) {
        // Find existing record
        const { data: milhasData } = await supabase.from('milhas_saldo').select('*').eq('colaborador_id', colaboradorId).single()
        
        if (milhasData) {
            const { error: milhasErr } = await supabase
                .from('milhas_saldo')
                .update({ saldo_disponivel: saldo_milhas, saldo_total: saldo_milhas }) // updating both to keep consistency for direct edits
                .eq('colaborador_id', colaboradorId)
                
            if (milhasErr) {
                console.error('Erro ao atualizar milhas_saldo:', milhasErr)
            }
        } else {
            // insert new
            await supabase.from('milhas_saldo').insert({
                colaborador_id: colaboradorId,
                saldo_disponivel: saldo_milhas,
                saldo_total: saldo_milhas,
                updated_at: new Date().toISOString()
            })
        }
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
