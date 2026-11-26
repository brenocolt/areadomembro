import { NextResponse } from 'next/server'
import { syncMondayProjects, syncMondayEquipes } from '@/lib/monday-sync'
import { auth } from '@/auth'
import { isAdmin } from '@/lib/access-control'

// Sincroniza AGORA (sem esperar o horário diário) o gerente e os consultores
// de cada projeto ativo do Monday — tabela projeto_equipe. Só administradores
// logados. Seguro de rodar quantas vezes quiser: não mexe nos números do PIPJ.
export async function GET() {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    if (!isAdmin((session.user as { role?: string | null } | undefined)?.role)) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    try {
        const projetos = await syncMondayProjects()
        const equipes = await syncMondayEquipes()
        if ('skipped' in equipes) return NextResponse.json({ error: equipes.reason }, { status: 500 })
        return NextResponse.json({ projetos, equipes })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
