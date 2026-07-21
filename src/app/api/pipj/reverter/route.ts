import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const lancamentoId: string | undefined = body.lancamentoId

    if (!lancamentoId) {
      return NextResponse.json({ error: 'lancamentoId é obrigatório.' }, { status: 400 })
    }

    const supabaseAdmin = createServerSupabaseClient()

    const { data: lancamento, error: lancamentoError } = await supabaseAdmin
      .from('lancamentos_pipj')
      .select('id, mes, ano, revertido_em')
      .eq('id', lancamentoId)
      .single()

    if (lancamentoError || !lancamento) {
      return NextResponse.json({ error: 'Lançamento não encontrado.' }, { status: 404 })
    }

    if (lancamento.revertido_em) {
      return NextResponse.json({ error: 'Este lançamento já foi revertido.' }, { status: 400 })
    }

    // Reverte com base nas transações realmente creditadas por este
    // lançamento (fonte de verdade dos saldos), não no JSON de detalhes.
    const { data: transacoes, error: transacoesError } = await supabaseAdmin
      .from('transacoes_pipj')
      .select('id, colaborador_id, valor')
      .eq('lancamento_id', lancamentoId)
      .eq('tipo', 'ENTRADA')
      .eq('status', 'CREDITADO')

    if (transacoesError) {
      return NextResponse.json({ error: 'Erro ao buscar transações do lançamento.' }, { status: 500 })
    }

    if (!transacoes || transacoes.length === 0) {
      return NextResponse.json({ error: 'Nenhuma transação encontrada para este lançamento — pode ser um lançamento antigo, anterior ao suporte a reversão.' }, { status: 400 })
    }

    const periodo = `${String(lancamento.mes).padStart(2, '0')}/${lancamento.ano}`
    let totalRevertido = 0

    for (const t of transacoes) {
      const { data: colab } = await supabaseAdmin
        .from('colaboradores')
        .select('saldo_pipj')
        .eq('id', t.colaborador_id)
        .single()

      const valor = Number(t.valor || 0)
      const novoSaldo = Number(colab?.saldo_pipj || 0) - valor

      await supabaseAdmin
        .from('colaboradores')
        .update({ saldo_pipj: novoSaldo })
        .eq('id', t.colaborador_id)

      await supabaseAdmin.from('transacoes_pipj').insert({
        colaborador_id: t.colaborador_id,
        tipo: 'SAIDA',
        valor,
        periodo,
        status: 'CREDITADO',
        descricao: `Reversão do lançamento de PIPJ ${periodo}`,
        lancamento_id: lancamentoId,
      })

      totalRevertido += valor
    }

    await supabaseAdmin
      .from('lancamentos_pipj')
      .update({ revertido_em: new Date().toISOString() })
      .eq('id', lancamentoId)

    return NextResponse.json({
      success: true,
      total_revertido: totalRevertido,
      total_colaboradores: transacoes.length,
    })
  } catch (error: any) {
    console.error('PIPJ revert error:', error)
    return NextResponse.json({ error: error.message || 'Erro interno.' }, { status: 500 })
  }
}
