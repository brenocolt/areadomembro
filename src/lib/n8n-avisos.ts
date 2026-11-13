// Avisos do portal para o n8n (milhas, troca de milhas, punição, saque do PIPJ).
//
// Sempre saem do servidor: o endereço e a senha nunca chegam ao navegador.
// Os endereços padrão abaixo são os antigos, que estão no histórico público
// do GitHub. Plano de troca (ação 1.3 do plano de riscos):
//   1. No n8n, criar um Webhook novo para cada tipo, com "Header Auth"
//      exigindo  Authorization: Bearer <N8N_AVISOS_TOKEN>.
//   2. No Coolify, cadastrar N8N_AVISOS_TOKEN e as N8N_WEBHOOK_* abaixo com
//      os endereços novos, e publicar.
//   3. Testar um aviso de cada tipo e desativar os webhooks antigos no n8n.

export type TipoAviso = 'milhas' | 'troca' | 'punicao' | 'saque_pipj'

const PADRAO: Record<TipoAviso, string> = {
    milhas: 'https://n8n.produtivajunior.com.br/webhook/30f97f7d-b1f3-43c7-8bbe-6c570ae977c3',
    troca: 'https://n8n.produtivajunior.com.br/webhook/troca',
    punicao: 'https://n8n.produtivajunior.com.br/webhook/puni',
    saque_pipj: 'https://n8n.produtivajunior.com.br/webhook/f7415c53-7aa2-4254-a910-3298ae6931d0',
}

const VARIAVEL: Record<TipoAviso, string> = {
    milhas: 'N8N_WEBHOOK_MILHAS',
    troca: 'N8N_WEBHOOK_TROCA',
    punicao: 'N8N_WEBHOOK_PUNICAO',
    saque_pipj: 'N8N_WEBHOOK_SAQUE_PIPJ',
}

export function urlDoAviso(tipo: TipoAviso): string | null {
    const url = process.env[VARIAVEL[tipo]] || PADRAO[tipo]
    return url === '-' ? null : url   // "-" desliga o aviso
}

// Nunca lança erro: falha no aviso não pode desfazer a aprovação já gravada.
export async function avisarN8n(tipo: TipoAviso, payload: Record<string, unknown>): Promise<{ ok: boolean, status?: number }> {
    const url = urlDoAviso(tipo)
    if (!url) return { ok: true }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    const token = process.env.N8N_AVISOS_TOKEN
    if (token) headers.Authorization = `Bearer ${token}`
    try {
        const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload), signal: AbortSignal.timeout(15000) })
        if (!res.ok) console.error(`[n8n] Aviso "${tipo}" recusado: HTTP ${res.status}`)
        return { ok: res.ok, status: res.status }
    } catch (err) {
        console.error(`[n8n] Falha ao enviar aviso "${tipo}":`, err)
        return { ok: false }
    }
}
