// Cliente mínimo da Web API do Slack + verificação de assinatura das
// requisições interativas. Server-only (usa segredos). Sem dependências
// externas: só fetch e crypto.
import crypto from 'crypto'

const SLACK_API = 'https://slack.com/api'

export function slackBotConfigurado(): boolean {
    return !!(process.env.SLACK_BOT_TOKEN && process.env.SLACK_CHANNEL_ID)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function slackCall(method: string, body: Record<string, unknown>): Promise<any> {
    const res = await fetch(`${SLACK_API}/${method}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
        },
        body: JSON.stringify(body),
    })
    const json = await res.json()
    if (!json.ok) throw new Error(`Slack ${method}: ${json.error}`)
    return json
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type SlackBlock = Record<string, any>

export async function postarMensagem(channel: string, text: string, blocks: SlackBlock[]): Promise<{ channel: string, ts: string }> {
    const json = await slackCall('chat.postMessage', { channel, text, blocks, unfurl_links: false })
    return { channel: json.channel, ts: json.ts }
}

export async function atualizarMensagem(channel: string, ts: string, text: string, blocks: SlackBlock[]): Promise<void> {
    await slackCall('chat.update', { channel, ts, text, blocks })
}

export async function responderNaThread(channel: string, threadTs: string, text: string): Promise<void> {
    await slackCall('chat.postMessage', { channel, thread_ts: threadTs, text, unfurl_links: false })
}

export async function abrirModal(triggerId: string, view: SlackBlock): Promise<void> {
    await slackCall('views.open', { trigger_id: triggerId, view })
}

export async function emailDoUsuarioSlack(slackUserId: string): Promise<string | null> {
    const res = await fetch(`${SLACK_API}/users.info?user=${encodeURIComponent(slackUserId)}`, {
        headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
    })
    const json = await res.json()
    return json.ok ? (json.user?.profile?.email || null) : null
}

// Confere X-Slack-Signature (HMAC-SHA256 de "v0:<timestamp>:<corpo cru>")
// e rejeita requisições com mais de 5 minutos (anti-replay).
export function assinaturaSlackValida(rawBody: string, timestamp: string | null, assinatura: string | null): boolean {
    const secret = process.env.SLACK_SIGNING_SECRET
    if (!secret || !timestamp || !assinatura) return false
    if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 60 * 5) return false
    const esperado = 'v0=' + crypto.createHmac('sha256', secret).update(`v0:${timestamp}:${rawBody}`).digest('hex')
    const a = Buffer.from(esperado)
    const b = Buffer.from(assinatura)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
}
