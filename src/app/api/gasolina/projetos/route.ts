import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { exigirMembroGasolina } from '@/lib/gasolina-server'
import { listarOpcoesDropdown } from '@/lib/monday'

// Projetos que o membro pode escolher para um centro de custo do tipo
// 'projeto' — vêm da coluna do Monday configurada no centro (ex.: lista
// "Categorias Consultoria / Assessoria" do board Processos de Pagamento).
export async function GET(req: NextRequest) {
    const supabase = createServerSupabaseClient()
    const acesso = await exigirMembroGasolina(supabase)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })

    const centroId = req.nextUrl.searchParams.get('centro')
    if (!centroId) return NextResponse.json({ error: 'Informe o centro de custo.' }, { status: 400 })

    const { data: centro } = await supabase.from('gasolina_centros_custo').select('tipo, rotulo_fixo, monday_coluna_projeto').eq('id', centroId).maybeSingle()
    if (!centro) return NextResponse.json({ error: 'Centro de custo não encontrado.' }, { status: 404 })
    if (centro.tipo === 'fixo') return NextResponse.json({ projetos: [centro.rotulo_fixo] })

    try {
        return NextResponse.json({ projetos: await listarOpcoesDropdown(centro.monday_coluna_projeto) })
    } catch (err) {
        console.error('[gasolina] Falha ao buscar projetos no Monday:', err)
        // O motivo vai junto para a VP conseguir diagnosticar (token sem acesso
        // ao board, coluna errada no centro de custo...). Não contém segredo:
        // mensagens de mondayRequest/listarOpcoesDropdown não incluem o token.
        const motivo = err instanceof Error ? err.message.slice(0, 300) : String(err)
        return NextResponse.json({ error: `Não foi possível carregar a lista de projetos do Monday. Motivo: ${motivo}` }, { status: 502 })
    }
}
