// Recebe os cliques do Slack (botões e modal) na mensagem do canal #tático.
// Configurar em api.slack.com/apps → Interactivity & Shortcuts → Request URL:
//   https://<app>/api/slack/interactions
// A requisição é autenticada pela assinatura do Slack (SLACK_SIGNING_SECRET);
// quem clicou é mapeado para um colaborador pelo e-mail do perfil do Slack
// (= email_corporativo) e passa pelas mesmas regras do sistema.
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { isDataValida, gerarHorariosDisponiveis } from '@/lib/pdi'
import { aceitarMomento, sugerirHorarioMomento, resolverLider } from '@/lib/pdi-server'
import { assinaturaSlackValida, emailDoUsuarioSlack, abrirModal } from '@/lib/slack'

export const dynamic = 'force-dynamic'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Supabase = any

async function colaboradorDoSlack(supabase: Supabase, slackUserId: string): Promise<string | null> {
    const email = await emailDoUsuarioSlack(slackUserId)
    if (!email) return null
    const { data } = await supabase
        .from('colaboradores')
        .select('id')
        .ilike('email_corporativo', email)
        .maybeSingle()
    return data?.id || null
}

// Só o clicador enxerga o aviso (ephemeral) — erros não poluem o canal.
async function avisoPrivado(channel: string, slackUserId: string, text: string) {
    await fetch('https://slack.com/api/chat.postEphemeral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8', Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
        body: JSON.stringify({ channel, user: slackUserId, text }),
    })
}

function modalSugerir(solicitacaoId: string) {
    const hoje = new Date()
    const inicial = `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}-${String(hoje.getDate()).padStart(2, '0')}`
    return {
        type: 'modal',
        callback_id: 'pdi_sugerir_modal',
        private_metadata: solicitacaoId,
        title: { type: 'plain_text', text: 'Sugerir outro horário' },
        submit: { type: 'plain_text', text: 'Sugerir' },
        close: { type: 'plain_text', text: 'Cancelar' },
        blocks: [
            {
                type: 'input', block_id: 'data', label: { type: 'plain_text', text: 'Data (dia útil)' },
                element: { type: 'datepicker', action_id: 'v', initial_date: inicial },
            },
            {
                type: 'input', block_id: 'hora', label: { type: 'plain_text', text: 'Horário' },
                element: {
                    type: 'static_select', action_id: 'v',
                    placeholder: { type: 'plain_text', text: 'Escolha um horário' },
                    options: gerarHorariosDisponiveis().map(h => ({ text: { type: 'plain_text', text: h }, value: h })),
                },
            },
            {
                type: 'input', block_id: 'motivo', optional: true, label: { type: 'plain_text', text: 'Motivo (opcional)' },
                element: { type: 'plain_text_input', action_id: 'v', multiline: true, max_length: 300 },
            },
        ],
    }
}

export async function POST(req: NextRequest) {
    const raw = await req.text()
    if (!assinaturaSlackValida(raw, req.headers.get('x-slack-request-timestamp'), req.headers.get('x-slack-signature'))) {
        return NextResponse.json({ error: 'Assinatura inválida.' }, { status: 401 })
    }

    const payload = JSON.parse(new URLSearchParams(raw).get('payload') || '{}')
    const supabase = createServerSupabaseClient()
    const slackUserId: string = payload.user?.id

    // ----- Envio do modal "Sugerir outro horário" -----
    if (payload.type === 'view_submission' && payload.view?.callback_id === 'pdi_sugerir_modal') {
        const solicitacaoId: string = payload.view.private_metadata
        const v = payload.view.state.values
        const data: string = v.data.v.selected_date
        const hora: string = v.hora.v.selected_option?.value
        const motivo: string | null = v.motivo.v.value || null

        if (!data || !isDataValida(data, true)) {
            return NextResponse.json({ response_action: 'errors', errors: { data: 'Escolha um dia útil de hoje até 60 dias à frente.' } })
        }
        if (!hora || !gerarHorariosDisponiveis(data).includes(hora)) {
            return NextResponse.json({ response_action: 'errors', errors: { hora: 'Horário inválido ou já passou.' } })
        }

        const colaboradorId = await colaboradorDoSlack(supabase, slackUserId)
        if (!colaboradorId) {
            return NextResponse.json({ response_action: 'errors', errors: { data: 'Não encontrei seu cadastro: o e-mail do Slack precisa ser o mesmo da Área do Membro.' } })
        }
        const { data: solicitacao } = await supabase.from('pdi_solicitacoes').select('*').eq('id', solicitacaoId).single()
        if (!solicitacao) {
            return NextResponse.json({ response_action: 'errors', errors: { data: 'Solicitação não encontrada.' } })
        }
        const lider = await resolverLider(supabase, colaboradorId, solicitacao)
        if (!lider.ok) return NextResponse.json({ response_action: 'errors', errors: { data: lider.error } })

        const r = await sugerirHorarioMomento(supabase, solicitacao, colaboradorId, lider.papelId, lider.nome, { data, hora, motivo })
        if (!r.ok) return NextResponse.json({ response_action: 'errors', errors: { data: r.error } })
        return new NextResponse(null, { status: 200 }) // fecha o modal
    }

    // ----- Cliques nos botões da mensagem -----
    if (payload.type === 'block_actions') {
        const acao = payload.actions?.[0]
        const canal: string = payload.channel?.id || payload.container?.channel_id
        if (!acao || (acao.action_id !== 'pdi_aceitar' && acao.action_id !== 'pdi_sugerir')) {
            return new NextResponse(null, { status: 200 })
        }
        const solicitacaoId: string = acao.value

        const colaboradorId = await colaboradorDoSlack(supabase, slackUserId)
        if (!colaboradorId) {
            await avisoPrivado(canal, slackUserId, ':warning: Não encontrei seu cadastro na Área do Membro — o e-mail do seu Slack precisa ser o mesmo e-mail corporativo do sistema.')
            return new NextResponse(null, { status: 200 })
        }
        const { data: solicitacao } = await supabase.from('pdi_solicitacoes').select('*').eq('id', solicitacaoId).single()
        if (!solicitacao) {
            await avisoPrivado(canal, slackUserId, ':warning: Solicitação não encontrada.')
            return new NextResponse(null, { status: 200 })
        }
        const lider = await resolverLider(supabase, colaboradorId, solicitacao)
        if (!lider.ok) {
            await avisoPrivado(canal, slackUserId, `:no_entry: ${lider.error}`)
            return new NextResponse(null, { status: 200 })
        }

        if (acao.action_id === 'pdi_sugerir') {
            await abrirModal(payload.trigger_id, modalSugerir(solicitacaoId))
            return new NextResponse(null, { status: 200 })
        }

        const r = await aceitarMomento(supabase, solicitacao, colaboradorId, lider.papelId, lider.nome)
        if (!r.ok) await avisoPrivado(canal, slackUserId, `:warning: ${r.error}`)
        return new NextResponse(null, { status: 200 })
    }

    return new NextResponse(null, { status: 200 })
}
