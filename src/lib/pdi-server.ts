// Lado server-only das regras do PDI: grava eventos, resolve destinatários
// de notificação interna e posta no Slack (fase 1 — Incoming Webhook). Só
// deve ser importado por rotas de API (nunca por componentes client).
//
// Centraliza exatamente o que a especificação pede em registrarEvento(...):
// "grava o evento, cria as notificações e chama o Slack — a fase 2 só troca
// o transporte" (botões interativos do Slack, fora do escopo desta fase).
import { resolverPapelId, formatarDataBr } from '@/lib/pdi'

type TipoEvento = 'nova' | 'aceite' | 'sugestao' | 'aceite_sugestao' | 'recusa_sugestao' | 'cancelamento' | 'conclusao'

interface RegistrarEventoParams {
    solicitacaoId: string
    tipo: TipoEvento
    autorId: string
    texto: string
    colaboradorId: string
    cargos: string[]
    // Preenchido conforme o evento: quem sugeriu (para aceite_sugestao/
    // recusa_sugestao) e se o cancelamento partiu do admin (para saber se o
    // colaborador precisa ser avisado em vez de só a administração).
    liderRelevanteId?: string | null
    canceladoPeloAdmin?: boolean
    // Contexto extra só para montar a mensagem do Slack (não usado para
    // decidir destinatários da notificação interna).
    slackContexto?: {
        colaboradorNome?: string
        colaboradorNucleo?: string | null
        papeisNomes?: string[]
        tiposTexto?: string
        data?: string
        hora?: string
        descricao?: string | null
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function registrarEvento(supabase: any, params: RegistrarEventoParams) {
    await supabase.from('pdi_eventos').insert({
        solicitacao_id: params.solicitacaoId,
        tipo: params.tipo,
        autor_id: params.autorId,
        texto: params.texto,
    })

    const destinatarios = await resolverDestinatarios(supabase, params)
    destinatarios.delete(params.autorId)

    if (destinatarios.size > 0) {
        await supabase.from('pdi_notificacoes').insert(
            Array.from(destinatarios).map(membroId => ({
                membro_id: membroId,
                texto: params.texto,
                solicitacao_id: params.solicitacaoId,
            }))
        )
    }

    // Falha no Slack nunca pode impedir a operação — só loga e segue (§6).
    try {
        await postarNoSlack(params)
    } catch (err) {
        console.error('Erro ao postar evento do PDI no Slack:', err)
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolverDestinatarios(supabase: any, params: RegistrarEventoParams): Promise<Set<string>> {
    const destinatarios = new Set<string>()

    const { data: admins } = await supabase.from('users').select('colaborador_id').eq('role', 'ADMIN')
    const adminIds: string[] = (admins || []).map((a: { colaborador_id: string | null }) => a.colaborador_id).filter(Boolean)

    switch (params.tipo) {
        case 'nova': {
            adminIds.forEach(id => destinatarios.add(id))
            const { data: colaboradores } = await supabase.from('colaboradores').select('id, cargo_atual, nucleo_atual').eq('status', 'Ativo')
            for (const c of (colaboradores || []) as { id: string, cargo_atual: string | null, nucleo_atual: string | null }[]) {
                const papel = resolverPapelId(c.cargo_atual, c.nucleo_atual)
                if (papel && params.cargos.includes(papel)) destinatarios.add(c.id)
            }
            break
        }
        case 'aceite':
        case 'sugestao':
            destinatarios.add(params.colaboradorId)
            adminIds.forEach(id => destinatarios.add(id))
            break
        case 'aceite_sugestao':
        case 'recusa_sugestao':
            if (params.liderRelevanteId) destinatarios.add(params.liderRelevanteId)
            adminIds.forEach(id => destinatarios.add(id))
            break
        case 'cancelamento':
            adminIds.forEach(id => destinatarios.add(id))
            if (params.canceladoPeloAdmin) destinatarios.add(params.colaboradorId)
            const { data: aceitos } = await supabase
                .from('pdi_solicitacao_lideres')
                .select('lider_id')
                .eq('solicitacao_id', params.solicitacaoId)
                .not('lider_id', 'is', null)
            for (const a of (aceitos || []) as { lider_id: string | null }[]) {
                if (a.lider_id) destinatarios.add(a.lider_id)
            }
            break
        case 'conclusao':
            destinatarios.add(params.colaboradorId)
            adminIds.forEach(id => destinatarios.add(id))
            break
    }

    return destinatarios
}

async function postarNoSlack(params: RegistrarEventoParams): Promise<void> {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL
    if (!webhookUrl) return // Slack não configurado neste ambiente — segue sem postar.

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const link = `${appUrl}/pdi?solicitacao=${params.solicitacaoId}`
    const ctx = params.slackContexto || {}

    let texto: string
    if (params.tipo === 'nova') {
        const linhas = [
            `*Novo momento de desenvolvimento solicitado*`,
            `Tipo: ${ctx.tiposTexto || '—'}`,
            `Colaborador: ${ctx.colaboradorNome || '—'}${ctx.colaboradorNucleo ? ` (${ctx.colaboradorNucleo})` : ''}`,
            `Com quem: ${(ctx.papeisNomes || []).join(', ') || '—'}`,
            `Quando: ${ctx.data ? formatarDataBr(ctx.data) : '—'} às ${ctx.hora || '—'}`,
        ]
        if (ctx.descricao) linhas.push(`Contexto: ${ctx.descricao}`)
        linhas.push(`<${link}|Abrir na Área do Membro>`)
        texto = linhas.join('\n')
    } else {
        texto = `${params.texto}\n<${link}|Abrir na Área do Membro>`
    }

    await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'PDI Bot', text: texto }),
    })
}
