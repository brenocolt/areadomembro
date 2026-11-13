import { NextResponse } from 'next/server'
import { syncMondayProjects } from '@/lib/monday-sync'
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

// A sincronização automática roda no processo do servidor (ver
// src/instrumentation.ts) — este endpoint continua existindo apenas para
// disparar uma sincronização manual sob demanda (ex.: testar a integração).
export async function GET() {
    const negado = await exigirAdmin()
    if (negado) return negado
    try {
        const result = await syncMondayProjects()
        if ('skipped' in result) {
            return NextResponse.json({ error: result.reason }, { status: 500 })
        }
        return NextResponse.json(result)
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
