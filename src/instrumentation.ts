// Agenda a sincronização diária de projetos do Monday (ver
// src/lib/monday-sync.ts). O app roda num VPS como processo persistente
// (`next start`), não em funções serverless — por isso a sincronização é
// agendada aqui dentro do próprio processo, em vez de um Cron Job de
// plataforma (que só existiria em algo como o Vercel).
//
// `register()` é o hook oficial do Next.js para código que deve rodar uma
// vez quando o servidor sobe: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
export async function register() {
    // Evita rodar no runtime "edge" (middleware) e durante `next build` — só
    // faz sentido no processo Node.js de produção/desenvolvimento.
    if (process.env.NEXT_RUNTIME !== 'nodejs') return

    const { scheduleDailyMondaySync } = await import('./lib/monday-sync-scheduler')
    scheduleDailyMondaySync()

    const { scheduleReunioesProcessamento } = await import('./lib/reunioes-scheduler')
    scheduleReunioesProcessamento()
}
