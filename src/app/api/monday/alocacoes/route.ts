import { exigirLogin, respostaErro } from '@/lib/require-auth'
import { NextRequest, NextResponse } from 'next/server'
import { syncMondayAlocacoes } from '@/lib/monday-sync'

// Sincroniza colaboradores.projetos com as colunas de "Gerente"/"Consultores"
// do Monday. Por segurança, roda em modo dry-run por padrão (não grava nada,
// só mostra o que mudaria) — passe ?dryRun=false para aplicar de verdade.
// Não está plugada no agendamento automático ainda; disparo manual apenas,
// até ser validada.
export async function GET(req: NextRequest) {
    const login = await exigirLogin()
  if ('erro' in login) return respostaErro(login)

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
