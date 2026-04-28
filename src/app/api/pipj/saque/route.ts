import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { auth } from '@/auth'

export async function POST(request: Request) {
    try {
        const session = await auth()

        if (!session) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        const userRole = (session.user as any).role;
        // In some systems role is uppercase 'ADMIN', in others 'admin'. We check both just in case.
        if (userRole !== 'ADMIN' && userRole !== 'admin') {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        const supabase = await createServerSupabaseClient()


        const { id, action } = await request.json()

        if (!id || !action) {
            return NextResponse.json({ error: 'Dados inválidos' }, { status: 400 })
        }

        const status = action === 'APROVAR' ? 'APROVADO' : 'REJEITADO'

        // Get the request details
        const { data: saqueReq, error: reqError } = await supabase
            .from('solicitacoes_saque')
            .select('*, colaboradores(nome, email_corporativo, telefone)')
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
            const { data: colab, error: colabError } = await supabase
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
            const { error: updateError } = await supabase
                .from('colaboradores')
                .update({ saldo_pipj: currentBalance - requestValue })
                .eq('id', saqueReq.colaborador_id)

            if (updateError) {
                return NextResponse.json({ error: 'Erro ao atualizar saldo do colaborador' }, { status: 500 })
            }

            // Record the transaction
            const { error: txError } = await supabase
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

        // Webhook notification
        let dados: any = {}
        let descricaoLimpa = ''
        try {
            const parts = saqueReq.descricao?.split(' | ') || []
            descricaoLimpa = parts[0] || ''
            if (parts[1]) dados = JSON.parse(parts[1])
        } catch {}

        const webhookPayload = {
            nome: (saqueReq.colaboradores as any)?.nome || 'Desconhecido',
            chave_pix: dados.chave_pix || dados.conta || 'Não informada',
            email: (saqueReq.colaboradores as any)?.email_corporativo || 'Não informado',
            telefone: (saqueReq.colaboradores as any)?.telefone || 'Não informado',
            valor: Number(saqueReq.valor),
            tipo_gasto: dados.tipo_gasto || 'Não informado',
            comprovante_url: saqueReq.comprovante_url || 'Sem comprovante',
            descricao: descricaoLimpa,
            decisao: status // APROVADO ou REJEITADO
        }

        try {
            console.log("Enviando para N8N:", webhookPayload)
            const n8nRes = await fetch('https://n8n.produtivajunior.com.br/webhook/f7415c53-7aa2-4254-a910-3298ae6931d0', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(webhookPayload)
            })
            const resText = await n8nRes.text()
            console.log("Resposta N8N:", n8nRes.status, resText)
        } catch (err) {
            console.error("Erro ao enviar webhook n8n", err)
        }


        // Update the request status
        const { error: updateReqError } = await supabase
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
