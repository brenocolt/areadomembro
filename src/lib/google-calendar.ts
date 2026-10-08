// Cliente mínimo do Google Calendar usando uma conta de serviço com
// delegação em todo o domínio do Google Workspace: o sistema "assume" a
// identidade de cada pessoa (claim `sub`) e cria o evento direto na agenda
// dela, sem convite. Sem dependências externas: só fetch e crypto. Server-only.
import crypto from 'crypto'

const SCOPE = 'https://www.googleapis.com/auth/calendar.events'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events'

function credenciais(): { email: string, chave: string } | null {
    // Preferência: JSON completo da conta de serviço em GOOGLE_SERVICE_ACCOUNT_JSON.
    // Alternativa: GOOGLE_SERVICE_ACCOUNT_EMAIL + GOOGLE_PRIVATE_KEY.
    const json = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
    if (json) {
        try {
            const c = JSON.parse(json)
            if (c.client_email && c.private_key) return { email: c.client_email, chave: c.private_key }
        } catch { /* cai para as variáveis separadas */ }
    }
    const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    const chave = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    return email && chave ? { email, chave } : null
}

export function agendaConfigurada(): boolean {
    return credenciais() !== null
}

const base64url = (v: string | Buffer) => Buffer.from(v).toString('base64url')
const tokens = new Map<string, { token: string, expira: number }>()

async function tokenDe(emailUsuario: string): Promise<string> {
    const cache = tokens.get(emailUsuario)
    if (cache && cache.expira > Date.now() + 60_000) return cache.token

    const cred = credenciais()!
    const agora = Math.floor(Date.now() / 1000)
    const corpo = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + base64url(JSON.stringify({
        iss: cred.email, sub: emailUsuario, scope: SCOPE, aud: TOKEN_URL, iat: agora, exp: agora + 3600,
    }))
    const assinatura = crypto.createSign('RSA-SHA256').update(corpo).sign(cred.chave)
    const res = await fetch(TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: `${corpo}.${base64url(assinatura)}`,
        }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(`Google token (${emailUsuario}): ${json.error} ${json.error_description || ''}`)
    tokens.set(emailUsuario, { token: json.access_token, expira: Date.now() + json.expires_in * 1000 })
    return json.access_token
}

export interface EventoAgenda {
    titulo: string
    descricao: string
    inicio: string   // 'YYYY-MM-DDTHH:mm:ss' no fuso de São Paulo
    fim: string
    solicitacaoId: string
}

function corpoDoEvento(e: EventoAgenda) {
    return {
        summary: e.titulo,
        description: e.descricao,
        start: { dateTime: e.inicio, timeZone: 'America/Sao_Paulo' },
        end: { dateTime: e.fim, timeZone: 'America/Sao_Paulo' },
        extendedProperties: { private: { pdiSolicitacaoId: e.solicitacaoId } },
    }
}

async function chamar(emailUsuario: string, url: string, method: string, corpo?: unknown) {
    return fetch(url, {
        method,
        headers: { Authorization: `Bearer ${await tokenDe(emailUsuario)}`, 'Content-Type': 'application/json' },
        body: corpo ? JSON.stringify(corpo) : undefined,
    })
}

export async function criarEvento(emailUsuario: string, e: EventoAgenda): Promise<string> {
    const res = await chamar(emailUsuario, `${API}?sendUpdates=none`, 'POST', corpoDoEvento(e))
    const json = await res.json()
    if (!res.ok) throw new Error(`Google Calendar criar (${emailUsuario}): ${res.status} ${json.error?.message}`)
    return json.id
}

// Retorna false se o evento não existe mais (apagado pela pessoa), para o
// chamador recriá-lo.
export async function atualizarEvento(emailUsuario: string, eventId: string, e: EventoAgenda): Promise<boolean> {
    const res = await chamar(emailUsuario, `${API}/${encodeURIComponent(eventId)}?sendUpdates=none`, 'PATCH', corpoDoEvento(e))
    if (res.status === 404 || res.status === 410) return false
    if (!res.ok) throw new Error(`Google Calendar atualizar (${emailUsuario}): ${res.status} ${(await res.json()).error?.message}`)
    // Evento cancelado pela própria pessoa continua existindo com status "cancelled".
    return (await res.json()).status !== 'cancelled'
}

export async function removerEvento(emailUsuario: string, eventId: string): Promise<void> {
    const res = await chamar(emailUsuario, `${API}/${encodeURIComponent(eventId)}?sendUpdates=none`, 'DELETE')
    if (!res.ok && res.status !== 404 && res.status !== 410) {
        throw new Error(`Google Calendar remover (${emailUsuario}): ${res.status}`)
    }
}
