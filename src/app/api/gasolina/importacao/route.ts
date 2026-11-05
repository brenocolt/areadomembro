import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirGestorGasolina } from '@/lib/gasolina-server'
import { processarImportacao } from '@/lib/gasolina-importacao'
import type { PlanilhaGasolina } from '@/lib/gasolina-planilha'

// Importação da planilha antiga (fase 4), só para a gestão da gasolina.
//   POST ?modo=simular  { planilha }                -> relatório, não grava nada
//   POST ?modo=gravar   { planilha, mapeamento }    -> grava e devolve o mesmo relatório
// mapeamento: { [nome da aba]: colaborador_id | null } — o que a VP confirmou na tela.
export async function POST(req: NextRequest) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirGestorGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const gravar = req.nextUrl.searchParams.get('modo') === 'gravar'
    const body = await req.json().catch(() => null)
    const planilha = body?.planilha as PlanilhaGasolina | undefined
    if (!planilha || !Array.isArray(planilha.abas) || !Array.isArray(planilha.precos)) {
        return NextResponse.json({ error: 'Arquivo da planilha inválido.' }, { status: 400 })
    }
    const mapeamento = body?.mapeamento && typeof body.mapeamento === 'object' ? body.mapeamento as Record<string, string | null> : undefined
    if (gravar && !mapeamento) return NextResponse.json({ error: 'Confirme os membros antes de importar.' }, { status: 400 })

    try {
        const relatorio = await processarImportacao(supabase, planilha, { gravar, mapeamento })
        if (gravar) console.log(`[gasolina] Importação da planilha por ${acesso.colaboradorId}:`, relatorio.totais)
        return NextResponse.json(relatorio)
    } catch (err) {
        console.error('[gasolina] Falha na importação da planilha:', err)
        return NextResponse.json({ error: err instanceof Error ? err.message : 'Erro na importação.' }, { status: 500 })
    }
}
