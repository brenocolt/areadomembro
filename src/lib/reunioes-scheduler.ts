// Gera as faltas das reuniões encerradas sem depender de alguém abrir a
// tela de gestão — mesmo modelo do agendador do Monday (processo
// persistente no VPS, ver src/instrumentation.ts).
import { processarReunioesEncerradas } from './reunioes'

const INTERVALO_MS = 5 * 60 * 1000

let agendado = false

async function rodar() {
    try {
        const geradas = await processarReunioesEncerradas()
        if (geradas > 0) console.log(`[reunioes] ${geradas} falta(s) pré-pontuada(s).`)
    } catch (err) {
        console.error('[reunioes] Falha ao processar reuniões encerradas:', err)
    }
}

export function scheduleReunioesProcessamento() {
    if (agendado) return
    agendado = true
    rodar()
    setInterval(rodar, INTERVALO_MS)
}
