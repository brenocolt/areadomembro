import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export async function POST(request: Request) {
    try {
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        )

        const supabase = await createServerSupabaseClient()
        const { data: { session } } = await supabase.auth.getSession()

        if (!session) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        const { data: adminCheck } = await supabaseAdmin
            .from('colaboradores')
            .select('role')
            .eq('user_id', session.user.id)
            .single()

        if (adminCheck?.role !== 'admin') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        const { id, action } = await request.json()

        if (!id || !action) {
            return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
        }

        const status = action === 'APROVAR' ? 'APROVADO' : 'REJEITADO'

        // Get the request details
        const { data: saqueReq, error: reqError } = await supabaseAdmin
            .from('solicitacoes_saque')
            .select('*')
            .eq('id', id)
            .single()

        if (reqError || !saqueReq) {
            return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 })
        }

        if (saqueReq.status !== 'PENDENTE') {
            return NextResponse.json({ error: 'Solicitação já processada' }, { status: 400 })
        }

        if (action === 'APROVAR') {
            // Get the user's current balance
            const { data: colab, error: colabError } = await supabaseAdmin
                .from('colaboradores')
                .select('saldo_pipj')
                .eq('id', saqueReq.colaborador_id)
                .single()

            if (colabError || !colab) {
                return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 })
            }

            const currentBalance = Number(colab.saldo_pipj || 0)
            const requestValue = Number(saqueReq.valor)

            if (currentBalance < requestValue) {
                return NextResponse.json({ error: 'Saldo insuficiente para aprovar este saque' }, { status: 400 })
            }

            // Deduct the balance
            const { error: updateError } = await supabaseAdmin
                .from('colaboradores')
                .update({ saldo_pipj: currentBalance - requestValue })
                .eq('id', saqueReq.colaborador_id)

            if (updateError) {
                return NextResponse.json({ error: 'Erro ao atualizar saldo do colaborador' }, { status: 500 })
            }

            // Record the transaction
            const { error: txError } = await supabaseAdmin
                .from('transacoes_pipj')
                .insert({
                    colaborador_id: saqueReq.colaborador_id,
                    valor: requestValue,
                    tipo: 'SAIDA',
                    descricao: 'Saque Aprovado',
                    data: new Date().toISOString()
                })

            if (txError) {
                console.error("Erro ao registrar transação PIPJ", txError)
            }
        }

        // Update the request status
        const { error: updateReqError } = await supabaseAdmin
            .from('solicitacoes_saque')
            .update({ status })
            .eq('id', id)

        if (updateReqError) {
            return NextResponse.json({ error: 'Erro ao atualizar status da solicitação' }, { status: 500 })
        }

        return NextResponse.json({ success: true, status })

    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 })
    }
}
