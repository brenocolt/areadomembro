import crypto from 'crypto'
import { NextRequest, NextResponse, after } from 'next/server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import {
    ANEXO_QTD_MAX, ANEXO_TAMANHO_MAX, ANEXO_TIPOS_ACEITOS, VERSAO_FORMULARIO,
    validarSolicitacao, type RespostasFormulario,
} from '@/lib/pagamentos-formulario'
import {
    BUCKET_PAGAMENTOS, MSG_NAO_CONFIGURADO, exigirMembroPagamentos, notificarN8n, registrarEvento,
} from '@/lib/pagamentos-server'

// POST multipart/form-data, enviado pelo formulário da página
// /pagamentos/solicitar:
//   dados               JSON com as respostas (ver RespostasFormulario)
//   chave_idempotencia  UUID gerado pela tela a cada preenchimento — reenviar
//                       com a mesma chave devolve a mesma solicitação (sem duplicar)
//   comprovantes        1..5 arquivos (PDF/imagem, até 10 MB cada)
//   anexos_workday      0..5 arquivos (só quando a categoria pede)
// Quem envia vem da sessão (nunca do corpo do pedido).

export const runtime = 'nodejs'

const EXTENSAO_POR_TIPO: Record<string, string> = {
    'application/pdf': 'pdf', 'image/jpeg': 'jpg', 'image/png': 'png',
    'image/webp': 'webp', 'image/heic': 'heic', 'image/heif': 'heif',
}
const TIPO_POR_EXTENSAO: Record<string, string> = {
    pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
    webp: 'image/webp', heic: 'image/heic', heif: 'image/heif',
}

// Alguns celulares mandam HEIC sem tipo: cai na extensão do nome.
function tipoDoArquivo(f: File): string | null {
    if ((ANEXO_TIPOS_ACEITOS as readonly string[]).includes(f.type)) return f.type
    const ext = (f.name.split('.').pop() || '').toLowerCase()
    return TIPO_POR_EXTENSAO[ext] ?? null
}

function arquivos(form: FormData, campo: string): File[] {
    return form.getAll(campo).filter((v): v is File => typeof v === 'object' && v !== null && 'arrayBuffer' in v && (v as File).size > 0)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(req: NextRequest) {
    const db = createAdminSupabaseClient()
    if (!db) return NextResponse.json({ error: MSG_NAO_CONFIGURADO }, { status: 503 })

    const acesso = await exigirMembroPagamentos(db)
    if (!acesso.ok) return NextResponse.json({ error: acesso.error }, { status: acesso.status })
    const { membro } = acesso

    let form: FormData
    try {
        form = await req.formData()
    } catch {
        return NextResponse.json({ error: 'Envio inválido. Recarregue a página e tente de novo.' }, { status: 400 })
    }

    const chave = String(form.get('chave_idempotencia') ?? '')
    if (!UUID.test(chave)) return NextResponse.json({ error: 'Envio inválido (chave ausente). Recarregue a página.' }, { status: 400 })

    let respostas: RespostasFormulario
    try {
        const bruto = JSON.parse(String(form.get('dados') ?? '{}'))
        if (!bruto || typeof bruto !== 'object' || Array.isArray(bruto)) throw new Error()
        respostas = Object.fromEntries(Object.entries(bruto).filter(([, v]) => typeof v === 'string')) as RespostasFormulario
    } catch {
        return NextResponse.json({ error: 'Respostas inválidas.' }, { status: 400 })
    }

    // Já recebida com esta chave? Devolve a mesma (clique duplo, rede que caiu
    // depois de gravar, etc.).
    const existente = await db.from('pagamentos_solicitacoes')
        .select('id, numero, colaborador_id').eq('chave_idempotencia', chave).maybeSingle()
    if (existente.error) {
        console.error('[pagamentos] Falha ao consultar chave de envio:', existente.error.message)
        return NextResponse.json({ error: MSG_NAO_CONFIGURADO }, { status: 503 })
    }
    if (existente.data) {
        if (existente.data.colaborador_id !== membro.colaboradorId) return NextResponse.json({ error: 'Envio inválido.' }, { status: 409 })
        return NextResponse.json({ id: existente.data.id, numero: existente.data.numero, repetido: true })
    }

    const comprovantes = arquivos(form, 'comprovantes')
    const workday = arquivos(form, 'anexos_workday')
    const validacao = validarSolicitacao(respostas, { comprovantes: comprovantes.length, workday: workday.length })
    if (!validacao.ok) return NextResponse.json({ error: 'Confira os campos destacados.', erros: validacao.erros }, { status: 400 })

    const todos = [
        ...comprovantes.map(f => ({ f, campo: 'comprovante' as const })),
        ...workday.map(f => ({ f, campo: 'workday_sdr' as const })),
    ]
    if (comprovantes.length > ANEXO_QTD_MAX || workday.length > ANEXO_QTD_MAX) {
        return NextResponse.json({ error: `Envie no máximo ${ANEXO_QTD_MAX} arquivos por campo.` }, { status: 400 })
    }
    for (const { f } of todos) {
        if (f.size > ANEXO_TAMANHO_MAX) return NextResponse.json({ error: `"${f.name}" passa de 10 MB.` }, { status: 400 })
        if (!tipoDoArquivo(f)) return NextResponse.json({ error: `"${f.name}": envie PDF ou imagem (JPG, PNG, WEBP, HEIC).` }, { status: 400 })
    }

    // 1) Arquivos no bucket privado; 2) solicitação; 3) registros dos anexos.
    // Qualquer falha desfaz o que já foi feito (sem solicitação pela metade).
    const id = crypto.randomUUID()
    const enviados: { caminho: string, campo: 'comprovante' | 'workday_sdr', nome: string, tipo: string, tamanho: number }[] = []
    const desfazerArquivos = async () => {
        if (enviados.length) await db.storage.from(BUCKET_PAGAMENTOS).remove(enviados.map(e => e.caminho))
    }

    for (const [i, { f, campo }] of todos.entries()) {
        const tipo = tipoDoArquivo(f)!
        const caminho = `${membro.colaboradorId}/${id}/${campo}-${i + 1}-${crypto.randomBytes(6).toString('hex')}.${EXTENSAO_POR_TIPO[tipo]}`
        const { error } = await db.storage.from(BUCKET_PAGAMENTOS)
            .upload(caminho, Buffer.from(await f.arrayBuffer()), { contentType: tipo, upsert: false })
        if (error) {
            console.error('[pagamentos] Falha ao enviar anexo:', error.message)
            await desfazerArquivos()
            return NextResponse.json({ error: 'Não foi possível salvar os anexos. Tente de novo.' }, { status: 500 })
        }
        enviados.push({ caminho, campo, nome: f.name.slice(0, 255), tipo, tamanho: f.size })
    }

    const { data: criada, error: erroInsert } = await db.from('pagamentos_solicitacoes').insert({
        id,
        colaborador_id: membro.colaboradorId,
        solicitante_nome: membro.nome,
        solicitante_email: membro.email,
        versao_formulario: VERSAO_FORMULARIO,
        ...validacao.dados,
        respostas,
        chave_idempotencia: chave,
    }).select('id, numero').single()

    if (erroInsert || !criada) {
        await desfazerArquivos()
        if (erroInsert?.code === '23505') {
            // Duas abas enviando ao mesmo tempo com a mesma chave: vale a primeira.
            const { data } = await db.from('pagamentos_solicitacoes').select('id, numero').eq('chave_idempotencia', chave).maybeSingle()
            if (data) return NextResponse.json({ id: data.id, numero: data.numero, repetido: true })
        }
        console.error('[pagamentos] Falha ao gravar solicitação:', erroInsert?.message)
        return NextResponse.json({ error: 'Não foi possível salvar a solicitação. Tente de novo.' }, { status: 500 })
    }

    if (enviados.length) {
        const { error } = await db.from('pagamentos_anexos').insert(enviados.map(e => ({
            solicitacao_id: id, campo: e.campo, caminho: e.caminho,
            nome_original: e.nome, tipo_mime: e.tipo, tamanho_bytes: e.tamanho,
        })))
        if (error) {
            console.error('[pagamentos] Falha ao registrar anexos:', error.message)
            await db.from('pagamentos_solicitacoes').delete().eq('id', id)
            await desfazerArquivos()
            return NextResponse.json({ error: 'Não foi possível salvar os anexos. Tente de novo.' }, { status: 500 })
        }
    }

    await registrarEvento(db, {
        solicitacao_id: id, origem: 'portal', tipo: 'solicitacao_criada', status_novo: 'recebida',
        detalhes: { anexos: enviados.length, versao_formulario: VERSAO_FORMULARIO },
    })

    // Avisa o n8n depois de responder ao membro (não deixa a tela esperando).
    after(() => notificarN8n(db, id))

    return NextResponse.json({ id: criada.id, numero: criada.numero }, { status: 201 })
}
