// Alerta no Slack quando uma tarefa automática falha (ação 1.5 do plano de
// riscos). Sem isso, a falha fica só no log do servidor e ninguém vê.
//
// Configuração: no Slack, criar um "Incoming Webhook" para o canal da
// Tecnologia e cadastrar o endereço em ALERTAS_SLACK_WEBHOOK_URL no Coolify.
// Sem a variável, não faz nada.

const INTERVALO_MINIMO_MS = 60 * 60 * 1000   // no máximo 1 alerta por hora por origem
const ultimoAlerta = new Map<string, number>()

export async function alertarFalha(origem: string, erro: unknown): Promise<void> {
    const url = process.env.ALERTAS_SLACK_WEBHOOK_URL
    if (!url) return

    const agora = Date.now()
    const anterior = ultimoAlerta.get(origem)
    if (anterior && agora - anterior < INTERVALO_MINIMO_MS) return
    ultimoAlerta.set(origem, agora)

    const detalhe = erro instanceof Error ? erro.message : String(erro)
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                text: `:rotating_light: *Área do Membro*: a tarefa automática "${origem}" falhou.\n> ${detalhe.slice(0, 500)}\nVeja o log do servidor no Coolify. Novos avisos desta tarefa só daqui a 1 hora.`,
            }),
            signal: AbortSignal.timeout(10000),
        })
    } catch (err) {
        console.error('[alertas] Não foi possível avisar no Slack:', err)
    }
}
