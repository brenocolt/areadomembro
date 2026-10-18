import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { getUsersManagementTier, isAdmin as isAdminRole } from '@/lib/access-control'

const EMAIL_UNICO_ADMIN = 'produtivajunior@gmail.com'

// O formulário de edição sempre manda todos os campos, mesmo os que
// ficaram desabilitados na tela (um input disabled ainda carrega seu valor
// atual no estado do React) — por isso a permissão é checada comparando
// com o valor que já está no banco, não só "o campo veio no corpo".
function mudou(novo: any, atual: any): boolean {
    if (novo === undefined) return false
    return String(novo ?? '') !== String(atual ?? '')
}

export async function PUT(request: Request) {
    const session = await auth()
    const editorColaboradorId = (session?.user as any)?.colaborador_id as string | undefined
    const editorRole = (session?.user as any)?.role as string | undefined

    if (!session || !editorColaboradorId) {
        return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const supabase = createServerSupabaseClient()

    const { data: editor } = await supabase
        .from('colaboradores')
        .select('cargo_atual, nucleo_atual')
        .eq('id', editorColaboradorId)
        .single()

    const tier = isAdminRole(editorRole) ? 3 : getUsersManagementTier(editor?.cargo_atual, editor?.nucleo_atual)

    if (tier === 0) {
        return NextResponse.json({ error: 'Sem permissão pra editar usuários' }, { status: 403 })
    }

    const body = await request.json()
    const { colaboradorId, updateObj, role, currentRole, auditLogs } = body

    if (!colaboradorId) {
        return NextResponse.json({ error: 'ID do colaborador é obrigatório' }, { status: 400 })
    }

    const { data: alvo } = await supabase
        .from('colaboradores')
        .select('cargo_atual, nucleo_atual, pontos_negativos, saldo_pipj, paginas_permitidas')
        .eq('id', colaboradorId)
        .single()

    if (!alvo) {
        return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 })
    }

    const { saldo_milhas, cargo_atual, nucleo_atual, pontos_negativos, saldo_pipj, paginas_permitidas, ...rest } = updateObj || {}
    const colaboradorUpdate: Record<string, any> = { ...rest }

    // Mudar cargo/núcleo exige tier 2+.
    if ((mudou(cargo_atual, alvo.cargo_atual) || mudou(nucleo_atual, alvo.nucleo_atual)) && tier < 2) {
        return NextResponse.json({ error: 'Sem permissão pra mudar cargo/núcleo' }, { status: 403 })
    }
    if (cargo_atual !== undefined) colaboradorUpdate.cargo_atual = cargo_atual
    if (nucleo_atual !== undefined) colaboradorUpdate.nucleo_atual = nucleo_atual

    // Pontos Negativos / Saldo PIPJ / Saldo de Milhas — só Estratégico/ADM
    // (tier 3), e só nesta tela (ver src/lib/access-control.ts).
    const mexeuEmCampoSensivel =
        mudou(pontos_negativos, alvo.pontos_negativos) ||
        mudou(saldo_pipj, alvo.saldo_pipj)
    if (mexeuEmCampoSensivel && tier < 3) {
        return NextResponse.json({ error: 'Sem permissão pra editar pontos negativos ou saldo PIPJ' }, { status: 403 })
    }
    if (pontos_negativos !== undefined) colaboradorUpdate.pontos_negativos = pontos_negativos
    if (saldo_pipj !== undefined) colaboradorUpdate.saldo_pipj = saldo_pipj

    // Conceder acesso (role / paginas_permitidas) — só tier 3.
    const mudandoRole = !!role && role !== currentRole
    const mudandoPaginas = paginas_permitidas !== undefined &&
        JSON.stringify(paginas_permitidas) !== JSON.stringify(alvo.paginas_permitidas ?? [])
    if ((mudandoRole || mudandoPaginas) && tier < 3) {
        return NextResponse.json({ error: 'Sem permissão pra conceder acesso' }, { status: 403 })
    }
    if (paginas_permitidas !== undefined) colaboradorUpdate.paginas_permitidas = paginas_permitidas

    // ADMIN só pode ser concedido à conta única — mesmo um editor tier 3
    // não pode promover outra pessoa a admin.
    if (mudandoRole && role === 'ADMIN') {
        const { data: targetUser } = await supabase
            .from('users')
            .select('email')
            .eq('colaborador_id', colaboradorId)
            .single()

        if ((targetUser?.email || '').trim().toLowerCase() !== EMAIL_UNICO_ADMIN) {
            return NextResponse.json({ error: `Só ${EMAIL_UNICO_ADMIN} pode ser Admin` }, { status: 403 })
        }
    }

    if (Object.keys(colaboradorUpdate).length > 0) {
        const { error: colabErr } = await supabase
            .from('colaboradores')
            .update(colaboradorUpdate)
            .eq('id', colaboradorId)

        if (colabErr) {
            return NextResponse.json({ error: colabErr.message }, { status: 500 })
        }
    }

    // Saldo de milhas vive em outra tabela — mesma regra de tier 3, checada
    // contra o valor atual em milhas_saldo.
    if (saldo_milhas !== undefined) {
        const { data: milhasData } = await supabase.from('milhas_saldo').select('*').eq('colaborador_id', colaboradorId).single()

        if (mudou(saldo_milhas, milhasData?.saldo_disponivel) && tier < 3) {
            return NextResponse.json({ error: 'Sem permissão pra editar saldo de milhas' }, { status: 403 })
        }

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
    if (mudandoRole) {
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
