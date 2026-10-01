// Lado server-only das regras do PDI: grava eventos, resolve destinatários
// de notificação interna e posta no Slack. Só deve ser importado por rotas
// de API (nunca por componentes client).
//
// Centraliza exatamente o que a especificação pede em registrarEvento(...):
// "grava o evento, cria as notificações e chama o Slack".
//
// Slack, dois modos (escolhido pelas variáveis de ambiente):
//  - Bot interativo (SLACK_BOT_TOKEN + SLACK_CHANNEL_ID): posta o pedido no
//    canal #tático com botões Aceitar / Sugerir outro horário (tratados em
//    /api/slack/interactions) e mantém a mensagem atualizada.
//  - Incoming Webhook (SLACK_WEBHOOK_URL): só avisa, sem botões.
import { resolverPapelId, formatarDataBr, formatarTiposComOpcoes } from '@/lib/pdi'
import {
    slackBotConfigurado, postarMensagem, atualizarMensagem, responderNaThread, type SlackBlock,
} from '@/lib/slack'

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
        if (slackBotConfigurado()) await sincronizarSlack(supabase, params)
        else await postarNoWebhook(params)
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

async function postarNoWebhook(params: RegistrarEventoParams): Promise<void> {
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

// ---------------------------------------------------------------------------
// Ações de líder compartilhadas entre o sistema (PATCH /api/pdi/solicitacoes/
// [id]) e o Slack (/api/slack/interactions) — uma única implementação das
// regras de aceitar / sugerir horário.
// ---------------------------------------------------------------------------

export type ResultadoAcao = { ok: true } | { ok: false, status: number, error: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Solicitacao = Record<string, any>

// Descobre o papel de liderança de quem está agindo e confirma que é um dos
// pedidos na solicitação — nunca confiar em papel enviado pelo cliente.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function resolverLider(supabase: any, colaboradorId: string, solicitacao: Solicitacao):
    Promise<{ ok: true, papelId: string, nome: string } | { ok: false, status: number, error: string }> {
    const { data: colaborador } = await supabase
        .from('colaboradores')
        .select('nome, cargo_atual, nucleo_atual, status')
        .eq('id', colaboradorId)
        .single()
    const papelId = resolverPapelId(colaborador?.cargo_atual, colaborador?.nucleo_atual)
    if (!papelId || colaborador?.status !== 'Ativo' || !(solicitacao.cargos || []).includes(papelId)) {
        return { ok: false, status: 403, error: 'Você não tem o papel de liderança pedido nesta solicitação.' }
    }
    return { ok: true, papelId, nome: colaborador?.nome || 'Um líder' }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function aceitarMomento(supabase: any, solicitacao: Solicitacao, colaboradorId: string, papelId: string, nome: string): Promise<ResultadoAcao> {
    if (solicitacao.status === 'cancelado' || solicitacao.status === 'concluido') {
        return { ok: false, status: 400, error: 'Esta solicitação já foi encerrada.' }
    }
    const { data: linha } = await supabase
        .from('pdi_solicitacao_lideres')
        .select('*')
        .eq('solicitacao_id', solicitacao.id)
        .eq('papel_id', papelId)
        .single()
    if (!linha || linha.lider_id) {
        return { ok: false, status: 409, error: 'Este papel já foi aceito por outra pessoa.' }
    }

    await supabase.from('pdi_solicitacao_lideres')
        .update({ lider_id: colaboradorId, aceito_em: new Date().toISOString() })
        .eq('solicitacao_id', solicitacao.id)
        .eq('papel_id', papelId)

    // Uma solicitação com mais de um papel continua "aberta" para os
    // papéis que ainda não têm ninguém — só a linha desse papel muda.
    if (solicitacao.status === 'aguardando') {
        await supabase.from('pdi_solicitacoes').update({
            status: 'agendado', atualizado_em: new Date().toISOString(),
        }).eq('id', solicitacao.id)
    }

    await registrarEvento(supabase, {
        solicitacaoId: solicitacao.id,
        tipo: 'aceite',
        autorId: colaboradorId,
        texto: `${nome} aceitou o momento (${formatarDataBr(solicitacao.data)} às ${solicitacao.hora}).`,
        colaboradorId: solicitacao.colaborador_id,
        cargos: solicitacao.cargos || [],
    })
    return { ok: true }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sugerirHorarioMomento(supabase: any, solicitacao: Solicitacao, colaboradorId: string, papelId: string, nome: string, sugestao: { data: string, hora: string, motivo?: string | null }): Promise<ResultadoAcao> {
    if (solicitacao.status === 'cancelado' || solicitacao.status === 'concluido') {
        return { ok: false, status: 400, error: 'Esta solicitação já foi encerrada.' }
    }
    const { data, hora, motivo } = sugestao

    await supabase.from('pdi_solicitacoes').update({
        status: 'reagendado',
        sugestao: { data, hora, motivo: motivo || null, lider_id: colaboradorId, papel_id: papelId },
        atualizado_em: new Date().toISOString(),
    }).eq('id', solicitacao.id)

    await registrarEvento(supabase, {
        solicitacaoId: solicitacao.id,
        tipo: 'sugestao',
        autorId: colaboradorId,
        texto: `${nome} sugeriu novo horário: ${formatarDataBr(data)} às ${hora}.`,
        colaboradorId: solicitacao.colaborador_id,
        cargos: solicitacao.cargos || [],
    })
    return { ok: true }
}

// ---------------------------------------------------------------------------
// Mensagem interativa no canal #tático
// ---------------------------------------------------------------------------

const EMOJI_STATUS: Record<string, string> = {
    aguardando: ':hourglass_flowing_sand: Aguardando aceite',
    agendado: ':white_check_mark: Agendado',
    reagendado: ':arrows_counterclockwise: Novo horário sugerido — aguardando resposta do membro',
    concluido: ':checkered_flag: Concluído',
    cancelado: ':x: Cancelado',
}

// Monta a mensagem a partir do estado atual no banco (fonte única da
// verdade) — assim, qualquer origem da mudança (sistema ou Slack) gera o
// mesmo resultado.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function montarMensagemSlack(supabase: any, solicitacaoId: string): Promise<{ text: string, blocks: SlackBlock[], solicitacao: Solicitacao } | null> {
    const { data: s } = await supabase
        .from('pdi_solicitacoes')
        .select('*, pdi_solicitacao_lideres(papel_id, lider_id, lider:lider_id(nome)), colaborador:colaborador_id(nome, nucleo_atual)')
        .eq('id', solicitacaoId)
        .single()
    if (!s) return null
    const { data: tipos } = await supabase.from('pdi_tipos_momento').select('*')

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''
    const link = `${appUrl}/pdi?solicitacao=${s.id}`
    const tiposTexto = formatarTiposComOpcoes(tipos || [], s.tipos || [], s.detalhes || {}, s.outro_texto)
    const nomePapel = (id: string) => (id === 'diretor' ? 'Diretor' : id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lideres: any[] = s.pdi_solicitacao_lideres || []
    const papeisTexto = lideres
        .map(l => `${nomePapel(l.papel_id)}: ${l.lider?.nome ? `:white_check_mark: ${l.lider.nome}` : ':hourglass_flowing_sand: aguardando'}`)
        .join('\n')
    const temPapelAberto = lideres.some(l => !l.lider_id)

    const blocks: SlackBlock[] = [
        { type: 'header', text: { type: 'plain_text', text: 'Novo momento de desenvolvimento' } },
        {
            type: 'section',
            fields: [
                { type: 'mrkdwn', text: `*Membro*\n${s.colaborador?.nome || '—'}${s.colaborador?.nucleo_atual ? ` (${s.colaborador.nucleo_atual})` : ''}` },
                { type: 'mrkdwn', text: `*Tipo*\n${tiposTexto || '—'}` },
                { type: 'mrkdwn', text: `*Quando*\n${formatarDataBr(s.data)} às ${String(s.hora).slice(0, 5)}` },
                { type: 'mrkdwn', text: `*Com quem*\n${papeisTexto || '—'}` },
            ],
        },
    ]
    if (s.descricao) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Contexto*\n${s.descricao}` } })

    let statusTexto = EMOJI_STATUS[s.status] || s.status
    if (s.status === 'reagendado' && s.sugestao) {
        statusTexto += `\nSugestão: *${formatarDataBr(s.sugestao.data)} às ${s.sugestao.hora}*${s.sugestao.motivo ? ` — “${s.sugestao.motivo}”` : ''}`
    }
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: statusTexto }] })

    // Botões só enquanto houver algo a decidir: pedido em aberto (ou com
    // papel ainda sem ninguém). Com sugestão pendente a bola está com o
    // membro, e concluído/cancelado está encerrado.
    const aberto = (s.status === 'aguardando' || s.status === 'agendado') && temPapelAberto
    const elementos: SlackBlock[] = []
    if (aberto) {
        elementos.push(
            { type: 'button', style: 'primary', action_id: 'pdi_aceitar', text: { type: 'plain_text', text: 'Aceitar' }, value: s.id },
            { type: 'button', action_id: 'pdi_sugerir', text: { type: 'plain_text', text: 'Sugerir outro horário' }, value: s.id },
        )
    }
    if (appUrl) {
        elementos.push({ type: 'button', action_id: 'pdi_abrir', text: { type: 'plain_text', text: 'Abrir na Área do Membro' }, url: link })
    }
    if (elementos.length > 0) blocks.push({ type: 'actions', elements: elementos })

    const text = `Novo momento de desenvolvimento de ${s.colaborador?.nome || 'um membro'} — ${formatarDataBr(s.data)} às ${String(s.hora).slice(0, 5)}`
    return { text, blocks, solicitacao: s }
}

// Posta a mensagem (evento "nova") ou atualiza a existente + registra o
// que aconteceu na thread (demais eventos).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function sincronizarSlack(supabase: any, params: { solicitacaoId: string, tipo: TipoEvento, texto: string }) {
    const msg = await montarMensagemSlack(supabase, params.solicitacaoId)
    if (!msg) return
    const { solicitacao } = msg

    if (!solicitacao.slack_ts || !solicitacao.slack_channel) {
        const canal = process.env.SLACK_CHANNEL_ID!
        const postada = await postarMensagem(canal, msg.text, msg.blocks)
        await supabase.from('pdi_solicitacoes')
            .update({ slack_channel: postada.channel, slack_ts: postada.ts })
            .eq('id', params.solicitacaoId)
        return
    }

    await atualizarMensagem(solicitacao.slack_channel, solicitacao.slack_ts, msg.text, msg.blocks)
    if (params.tipo !== 'nova') {
        await responderNaThread(solicitacao.slack_channel, solicitacao.slack_ts, params.texto)
    }
}
