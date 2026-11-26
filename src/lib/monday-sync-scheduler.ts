// Agendador da sincronização diária com o Monday — sem dependência externa
// de cron, só setTimeout/setInterval alinhados ao horário de relógio (em vez
// de "a cada 24h a partir de quando o processo subiu", que iria desviar do
// horário pretendido a cada deploy/restart).
import { syncMondayAlocacoes, syncMondayProjects } from './monday-sync'
import { alertarFalha } from './alertas'

const HORA_UTC = 9    // 9h UTC = ~6h em Brasília (sem horário de verão), antes do expediente
const MINUTO_UTC = 0
const UM_DIA_MS = 24 * 60 * 60 * 1000

let agendado = false

function msAteProximoHorario(horaUtc: number, minutoUtc: number): number {
    const agora = new Date()
    const proximo = new Date(Date.UTC(
        agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(),
        horaUtc, minutoUtc, 0, 0
    ))
    if (proximo.getTime() <= agora.getTime()) {
        proximo.setUTCDate(proximo.getUTCDate() + 1)
    }
    return proximo.getTime() - agora.getTime()
}

async function rodarSincronizacao() {
    try {
        // Projetos de cada membro (colaboradores.projetos e
        // projetos_ativos_detalhe — o card "Projetos" da tela inicial e a
        // base do PIPJ). Já roda syncMondayProjects antes, então também
        // atualiza a tabela `projetos`.
        const resultado = await syncMondayAlocacoes({ dryRun: false })
        if ('skipped' in resultado) {
            console.warn('[monday-sync] Alocações não sincronizadas:', resultado.reason)
            void alertarFalha('Sincronização de projetos por membro do Monday', new Error(resultado.reason))
        } else {
            console.log('[monday-sync] Sincronização automática concluída:', {
                itensAtivos: resultado.totalItensAtivos,
                membrosAlterados: resultado.alterados.length,
                emailsNaoEncontrados: resultado.emailsNaoEncontrados.length,
            })
        }
    } catch (err) {
        // Nunca derruba o servidor por causa de uma falha de sincronização —
        // só registra e tenta de novo no próximo horário agendado.
        console.error('[monday-sync] Falha na sincronização automática:', err)
        void alertarFalha('Sincronização de projetos do Monday', err)
        // Se a parte por membro falhou, ao menos tenta manter a lista geral.
        try { await syncMondayProjects() } catch { /* já alertado acima */ }
    }
}

// `register()` do Next.js pode ser chamado mais de uma vez no mesmo
// processo (ex.: hot reload em desenvolvimento) — esse guard evita agendar
// o mesmo job duas vezes.
export function scheduleDailyMondaySync() {
    if (agendado) return
    agendado = true

    // Roda uma vez assim que o servidor sobe — sem isso, um deploy feito
    // fora do horário agendado só refletiria os projetos do Monday no dia
    // seguinte, o que parece (e na prática é) o app "não ter atualizado".
    rodarSincronizacao()

    const delay = msAteProximoHorario(HORA_UTC, MINUTO_UTC)
    setTimeout(function agendarProximo() {
        rodarSincronizacao()
        setInterval(rodarSincronizacao, UM_DIA_MS)
    }, delay)

    console.log(`[monday-sync] Sincronização inicial disparada. Próxima agendada em ${Math.round(delay / 60000)} min.`)
}
