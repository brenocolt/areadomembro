import { NextRequest, NextResponse } from 'next/server'
import { syncMondayAlocacoes } from '@/lib/monday-sync'
import { auth } from '@/auth'
import { isAdmin } from '@/lib/access-control'

// Só administradores logados podem disparar a sincronização manual. A
// automática (src/instrumentation.ts) roda dentro do servidor e não passa por aqui.
async function exigirAdmin(): Promise<NextResponse | null> {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if (!isAdmin((session.user as { role?: string | null } | undefined)?.role)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    return null
}

// Sincroniza colaboradores.projetos com as colunas de "Gerente"/"Consultores"
// do Monday. Por segurança, roda em modo dry-run por padrão (não grava nada,
// só mostra o que mudaria) — passe ?dryRun=false para aplicar de verdade.
// Não está plugada no agendamento automático ainda; disparo manual apenas,
// até ser validada.
export async function GET(req: NextRequest) {
    const negado = await exigirAdmin()
    if (negado) return negado
    try {
        const dryRunParam = req.nextUrl.searchParams.get('dryRun')
        const dryRun = dryRunParam !== 'false'

        const result = await syncMondayAlocacoes({ dryRun })
        if ('skipped' in result) {
            return NextResponse.json({ error: result.reason }, { status: 500 })
        }
        return NextResponse.json(result)
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
