import { NextRequest, NextResponse } from 'next/server'
import { bloquearSemPagina } from '@/lib/server-auth'
import { avisarN8n, type TipoAviso } from '@/lib/n8n-avisos'

// As telas de gestão de milhas e de pontos pedem aqui o aviso ao membro, em
// vez de chamar o n8n direto do navegador (o que expunha o endereço e
// deixava qualquer pessoa disparar mensagens). Só quem abre a tela pode usar.
const PAGINA: Partial<Record<TipoAviso, string>> = {
    milhas: '/miles-management',
    troca: '/miles-management',
    punicao: '/points-management',
}

export async function POST(req: NextRequest) {
    const body = await req.json().catch(() => null) as Record<string, unknown> | null
    const tipo = body?.tipo as TipoAviso | undefined
    const pagina = tipo ? PAGINA[tipo] : undefined
    if (!pagina) return NextResponse.json({ error: 'Tipo de aviso inválido' }, { status: 400 })

    const bloqueio = await bloquearSemPagina(pagina)
    if (bloqueio) return bloqueio

    const status = body?.status
    if (status !== 'Aceito' && status !== 'Reprovado') {
        return NextResponse.json({ error: 'Status inválido' }, { status: 400 })
    }
    const texto = (v: unknown) => (typeof v === 'string' ? v.slice(0, 500) : v == null ? '' : String(v).slice(0, 500))
    const resultado = await avisarN8n(tipo!, {
        nome: texto(body?.nome),
        motivo: texto(body?.motivo),
        quantidade: Number(body?.quantidade) || 0,
        status,
        telefone: texto(body?.telefone),
    })
    return NextResponse.json({ ok: resultado.ok })
}
