// Lado server-only dos repasses do PDI: um tático (ou o diretor) oferece um
// momento, ele é anunciado no canal do Slack (SLACK_REPASSES_CHANNEL_ID), os
// membros entram até o prazo de adesão e, depois, o tático confirma — o que
// cria o evento no Google Agenda com todos que entraram.
import { formatarDataBr, formatarDataHoraSp, type PdiRepasse } from '@/lib/pdi'
import { canalDosRepasses, postarMensagem, atualizarMensagem, responderNaThread, type SlackBlock } from '@/lib/slack'
import { agendaConfigurada, criarEventoComConvidados, removerEventoComAviso, type EventoAgenda } from '@/lib/google-calendar'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

export type ResultadoRepasse =
    | { ok: true, agenda?: 'automatica' | 'link', aviso?: string }
    | { ok: false, status: number, error: string }

const SELECT_REPASSE = '*, criador:criador_id(nome, email_corporativo), participantes:pdi_repasse_participantes(colaborador_id, entrou_em, colaborador:colaborador_id(nome, email_corporativo))'

export async function carregarRepasse(supabase: Supabase, id: string): Promise<(PdiRepasse & { criador: { nome: string, email_corporativo: string | null } | null }) | null> {
    const { data } = await supabase.from('pdi_repasses').select(SELECT_REPASSE).eq('id', id).single()
    return data ?? null
}

export function prazoEncerrado(r: Pick<PdiRepasse, 'prazo_adesao'>): boolean {
    return new Date(r.prazo_adesao).getTime() <= Date.now()
}

const hhmm = (hora: string) => String(hora).slice(0, 5)

// ---------------------------------------------------------------------------
// Mensagem do Slack
// ---------------------------------------------------------------------------

export function montarMensagemRepasse(r: PdiRepasse): { text: string, blocks: SlackBlock[] } {
    const participantes = r.participantes || []
    const nomes = participantes.map(p => p.colaborador?.nome).filter(Boolean) as string[]
    const lista = nomes.length === 0
        ? '_Ninguém entrou ainda._'
        : nomes.slice(0, 40).map(n => `• ${n}`).join('\n') + (nomes.length > 40 ? `\n… e mais ${nomes.length - 40}` : '')
    const vagas = r.vagas ? `${participantes.length}/${r.vagas}` : `${participantes.length} (sem limite)`
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || ''

    const blocks: SlackBlock[] = [
        { type: 'header', text: { type: 'plain_text', text: `Repasse de PDI: ${r.titulo}`.slice(0, 150) } },
        {
            type: 'section',
            fields: [
                { type: 'mrkdwn', text: `*Responsável*\n${r.criador?.nome || '—'}` },
                { type: 'mrkdwn', text: `*Quando*\n${formatarDataBr(r.data)} às ${hhmm(r.hora)} (${r.duracao_min} min)` },
                { type: 'mrkdwn', text: `*Entrar até*\n${formatarDataHoraSp(r.prazo_adesao)}` },
                { type: 'mrkdwn', text: `*Vagas*\n${vagas}` },
                ...(r.categoria ? [{ type: 'mrkdwn', text: `*Área*\n${r.categoria}` }] : []),
            ],
        },
    ]
    if (r.descricao) blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Sobre*\n${r.descricao}` } })
    blocks.push({ type: 'section', text: { type: 'mrkdwn', text: `*Quem vai participar*\n${lista}` } })

    const lotado = !!r.vagas && participantes.length >= r.vagas
    let status: string
    if (r.status === 'confirmado') status = ':white_check_mark: Confirmado — quem entrou recebe o evento no Google Agenda.'
    else if (r.status === 'cancelado') status = ':x: Cancelado.'
    else if (prazoEncerrado(r)) status = ':lock: Inscrições encerradas — aguardando o responsável confirmar.'
    else if (lotado) status = ':no_entry_sign: Vagas esgotadas.'
    else status = `:hourglass_flowing_sand: Inscrições abertas até ${formatarDataHoraSp(r.prazo_adesao)}.`
    blocks.push({ type: 'context', elements: [{ type: 'mrkdwn', text: status }] })

    const botoes: SlackBlock[] = []
    if (r.status === 'aberto' && !prazoEncerrado(r)) {
        if (!lotado) botoes.push({ type: 'button', style: 'primary', action_id: 'repasse_entrar', text: { type: 'plain_text', text: 'Quero participar' }, value: r.id })
        botoes.push({ type: 'button', action_id: 'repasse_sair', text: { type: 'plain_text', text: 'Sair' }, value: r.id })
    }
    if (appUrl) botoes.push({ type: 'button', action_id: 'repasse_abrir', text: { type: 'plain_text', text: 'Abrir na Área do Membro' }, url: `${appUrl}/pdi` })
    if (botoes.length > 0) blocks.push({ type: 'actions', elements: botoes })

    return { text: `Repasse de PDI: ${r.titulo} — ${formatarDataBr(r.data)} às ${hhmm(r.hora)}`, blocks }
}

// Posta a mensagem do repasse (primeira vez) ou atualiza a existente.
export async function sincronizarSlackRepasse(supabase: Supabase, id: string): Promise<{ ok: boolean, motivo?: string }> {
    const canal = canalDosRepasses()
    if (!canal) return { ok: false, motivo: 'O canal do Slack dos repasses não está configurado (SLACK_REPASSES_CHANNEL_ID).' }
    try {
        const r = await carregarRepasse(supabase, id)
        if (!r) return { ok: false, motivo: 'Repasse não encontrado.' }
        const msg = montarMensagemRepasse(r)
        if (r.slack_channel && r.slack_ts) {
            await atualizarMensagem(r.slack_channel, r.slack_ts, msg.text, msg.blocks)
        } else {
            const postada = await postarMensagem(canal, msg.text, msg.blocks)
            await supabase.from('pdi_repasses').update({ slack_channel: postada.channel, slack_ts: postada.ts }).eq('id', id)
        }
        return { ok: true }
    } catch (err) {
        console.error('Erro ao sincronizar o repasse do PDI com o Slack:', err)
        return { ok: false, motivo: err instanceof Error ? err.message : 'Erro no Slack.' }
    }
}

async function avisarNaThread(supabase: Supabase, id: string, texto: string) {
    try {
        const { data } = await supabase.from('pdi_repasses').select('slack_channel, slack_ts').eq('id', id).single()
        if (data?.slack_channel && data?.slack_ts) await responderNaThread(data.slack_channel, data.slack_ts, texto)
    } catch (err) {
        console.error('Erro ao avisar na thread do repasse:', err)
    }
}

// ---------------------------------------------------------------------------
// Entrar / sair (Slack)
// ---------------------------------------------------------------------------

export async function entrarNoRepasse(supabase: Supabase, repasseId: string, colaboradorId: string): Promise<ResultadoRepasse> {
    const r = await carregarRepasse(supabase, repasseId)
    if (!r) return { ok: false, status: 404, error: 'Repasse não encontrado.' }
    if (r.status !== 'aberto') return { ok: false, status: 400, error: r.status === 'cancelado' ? 'Este repasse foi cancelado.' : 'Este repasse já foi confirmado.' }
    if (prazoEncerrado(r)) return { ok: false, status: 400, error: 'As inscrições deste repasse já encerraram.' }
    if (r.criador_id === colaboradorId) return { ok: false, status: 400, error: 'Você é o responsável por este repasse.' }
    const participantes = r.participantes || []
    if (participantes.some(p => p.colaborador_id === colaboradorId)) return { ok: false, status: 409, error: 'Você já está inscrito neste repasse.' }
    if (r.vagas && participantes.length >= r.vagas) return { ok: false, status: 409, error: 'As vagas deste repasse acabaram.' }

    const { data: colaborador } = await supabase.from('colaboradores').select('status').eq('id', colaboradorId).single()
    if (!colaborador || colaborador.status !== 'Ativo') return { ok: false, status: 403, error: 'Só membros ativos podem participar.' }

    const { error } = await supabase.from('pdi_repasse_participantes').insert({ repasse_id: repasseId, colaborador_id: colaboradorId })
    if (error) return { ok: false, status: 500, error: 'Não consegui registrar sua entrada.' }
    await sincronizarSlackRepasse(supabase, repasseId)
    return { ok: true }
}

export async function sairDoRepasse(supabase: Supabase, repasseId: string, colaboradorId: string): Promise<ResultadoRepasse> {
    const r = await carregarRepasse(supabase, repasseId)
    if (!r) return { ok: false, status: 404, error: 'Repasse não encontrado.' }
    if (r.status !== 'aberto' || prazoEncerrado(r)) return { ok: false, status: 400, error: 'Não dá mais para sair: as inscrições já encerraram.' }
    if (!(r.participantes || []).some(p => p.colaborador_id === colaboradorId)) return { ok: false, status: 400, error: 'Você não está inscrito neste repasse.' }

    const { error } = await supabase.from('pdi_repasse_participantes').delete().eq('repasse_id', repasseId).eq('colaborador_id', colaboradorId)
    if (error) return { ok: false, status: 500, error: 'Não consegui registrar sua saída.' }
    await sincronizarSlackRepasse(supabase, repasseId)
    return { ok: true }
}

// ---------------------------------------------------------------------------
// Confirmar (cria o evento) e cancelar — só o responsável ou um administrador
// ---------------------------------------------------------------------------

async function notificar(supabase: Supabase, membros: string[], texto: string) {
    if (membros.length === 0) return
    await supabase.from('pdi_notificacoes').insert(membros.map(membro_id => ({ membro_id, texto })))
}

export async function confirmarRepasse(supabase: Supabase, repasseId: string, colaboradorId: string, isAdmin: boolean): Promise<ResultadoRepasse> {
    const r = await carregarRepasse(supabase, repasseId)
    if (!r) return { ok: false, status: 404, error: 'Repasse não encontrado.' }
    if (r.criador_id !== colaboradorId && !isAdmin) return { ok: false, status: 403, error: 'Só o responsável pelo repasse pode confirmá-lo.' }
    if (r.status !== 'aberto') return { ok: false, status: 400, error: r.status === 'cancelado' ? 'Este repasse foi cancelado.' : 'Este repasse já foi confirmado.' }

    const participantes = r.participantes || []
    if (participantes.length === 0) return { ok: false, status: 400, error: 'Ninguém entrou neste repasse ainda.' }
    const emails = participantes.map(p => p.colaborador?.email_corporativo).filter(Boolean) as string[]

    // Google Agenda: um evento na agenda do responsável, com os participantes
    // como convidados. Sem a integração (ou se ela falhar), o repasse é
    // confirmado igual e a tela entrega um link para o responsável criar o evento.
    let agenda: 'automatica' | 'link' = 'link'
    let aviso: string | undefined
    let googleEventId: string | null = null
    if (agendaConfigurada() && r.criador?.email_corporativo) {
        const hora = hhmm(r.hora)
        const [h, m] = hora.split(':').map(Number)
        const fimMin = h * 60 + m + r.duracao_min
        const pad = (n: number) => String(n).padStart(2, '0')
        const evento: EventoAgenda = {
            titulo: `Repasse de PDI: ${r.titulo}`,
            descricao: [r.descricao, `Responsável: ${r.criador.nome}`, `Participantes: ${participantes.map(p => p.colaborador?.nome).filter(Boolean).join(', ')}`].filter(Boolean).join('\n'),
            inicio: `${r.data}T${hora}:00`,
            fim: `${r.data}T${pad(Math.floor(fimMin / 60) % 24)}:${pad(fimMin % 60)}:00`,
            solicitacaoId: r.id,
        }
        try {
            googleEventId = await criarEventoComConvidados(r.criador.email_corporativo, evento, emails)
            agenda = 'automatica'
        } catch (err) {
            console.error('Erro ao criar o evento do repasse no Google Agenda:', err)
            aviso = 'Não consegui criar o evento no Google Agenda automaticamente; use o link para criá-lo.'
        }
    }

    const { error } = await supabase.from('pdi_repasses').update({
        status: 'confirmado', google_event_id: googleEventId, google_email: googleEventId ? r.criador?.email_corporativo : null,
        atualizado_em: new Date().toISOString(),
    }).eq('id', repasseId)
    if (error) return { ok: false, status: 500, error: 'Não consegui confirmar o repasse.' }

    await notificar(supabase, participantes.map(p => p.colaborador_id), `Repasse confirmado: ${r.titulo} — ${formatarDataBr(r.data)} às ${hhmm(r.hora)}.`)
    await sincronizarSlackRepasse(supabase, repasseId)
    await avisarNaThread(supabase, repasseId, `:white_check_mark: Repasse confirmado para ${formatarDataBr(r.data)} às ${hhmm(r.hora)} com ${participantes.length} participante${participantes.length > 1 ? 's' : ''}.${agenda === 'automatica' ? ' O convite já foi enviado pelo Google Agenda.' : ' O responsável vai criar o evento no Google Agenda.'}`)
    return { ok: true, agenda, aviso }
}

export async function cancelarRepasse(supabase: Supabase, repasseId: string, colaboradorId: string, isAdmin: boolean): Promise<ResultadoRepasse> {
    const r = await carregarRepasse(supabase, repasseId)
    if (!r) return { ok: false, status: 404, error: 'Repasse não encontrado.' }
    if (r.criador_id !== colaboradorId && !isAdmin) return { ok: false, status: 403, error: 'Só o responsável pelo repasse pode cancelá-lo.' }
    if (r.status === 'cancelado') return { ok: false, status: 400, error: 'Este repasse já foi cancelado.' }

    let aviso: string | undefined
    if (r.google_event_id && r.google_email && agendaConfigurada()) {
        try { await removerEventoComAviso(r.google_email, r.google_event_id) }
        catch (err) {
            console.error('Erro ao remover o evento do repasse do Google Agenda:', err)
            aviso = 'O repasse foi cancelado, mas o evento no Google Agenda precisa ser removido manualmente.'
        }
    }
    const { error } = await supabase.from('pdi_repasses').update({ status: 'cancelado', atualizado_em: new Date().toISOString() }).eq('id', repasseId)
    if (error) return { ok: false, status: 500, error: 'Não consegui cancelar o repasse.' }

    const participantes = r.participantes || []
    await notificar(supabase, participantes.map(p => p.colaborador_id), `Repasse cancelado: ${r.titulo}.`)
    await sincronizarSlackRepasse(supabase, repasseId)
    await avisarNaThread(supabase, repasseId, ':x: Este repasse foi cancelado pelo responsável.')
    return { ok: true, aviso }
}
