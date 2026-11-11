// Avisos ao membro (e-mail + WhatsApp) a cada mudança de status de uma
// solicitação de reembolso de gasolina. O app monta as mensagens e "toca" um
// webhook do n8n (automação "AVISOS REEMBOLSO GASOLINA"), que envia pelo
// Gmail e pelo Evolution. Sem GASOLINA_AVISOS_WEBHOOK_URL configurada, nada
// é enviado (e nada quebra).
import { formatarReais } from './gasolina'

export type StatusAviso = 'Solicitado' | 'Aprovado' | 'Lançado' | 'Pago' | 'Recusado'

// Telefone do cadastro -> formato do Evolution (55 + DDD + número). null se não der.
export function numeroWhatsapp(telefone: unknown): string | null {
    let n = String(telefone ?? '').replace(/\D/g, '')
    if (n.length === 10 || n.length === 11) n = '55' + n
    return n.length >= 12 && n.length <= 13 && n.startsWith('55') ? n : null
}

const escapar = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

export interface DadosAviso {
    status: StatusAviso
    membro: { nome: string, email: string | null, whatsapp: string | null }
    projeto: string
    valor: string
    assunto_email: string
    mensagem_email: string      // HTML
    mensagem_whatsapp: string
}

const ACOMPANHE = 'Acompanhe na Área do Membro → Reembolso de Gasolina → aba Solicitações.'

export function montarAviso(status: StatusAviso, d: { nome: string, email: string | null, telefone: unknown, projeto: string, valorTotal: number, motivo?: string | null }): DadosAviso {
    const primeiro = d.nome.trim().split(' ')[0] || d.nome.trim()
    const valor = formatarReais(Number(d.valorTotal))
    const motivo = (d.motivo || 'Não informado.').trim()

    const textos: Record<StatusAviso, { titulo: string, assunto: string, corpo: string }> = {
        Solicitado: {
            titulo: 'Reembolso de gasolina solicitado 📨',
            assunto: '📨 Recebemos seu pedido de reembolso de gasolina',
            corpo: `Recebemos o seu pedido e ele já está em análise. Você vai receber uma mensagem a cada mudança de status.\n\n${ACOMPANHE}`,
        },
        Aprovado: {
            titulo: 'Reembolso de gasolina aprovado ✅',
            assunto: '✅ Reembolso de gasolina aprovado',
            corpo: `Sua solicitação foi aprovada. Agora ela segue para o pagamento: primeiro é lançada no banco e depois o Pix cai na sua conta.\n\n${ACOMPANHE}`,
        },
        Lançado: {
            titulo: 'Reembolso de gasolina lançado no banco 🏦',
            assunto: '🏦 Reembolso de gasolina lançado no banco',
            corpo: `O pagamento do seu reembolso foi lançado no banco. Falta só o Pix cair na sua conta.\n\n${ACOMPANHE}`,
        },
        Pago: {
            titulo: 'Reembolso de gasolina pago 💸',
            assunto: '💸 Reembolso de gasolina pago',
            corpo: `O Pix do seu reembolso foi pago na chave cadastrada na Área do Membro. As viagens agora aparecem como Reembolsado.`,
        },
        Recusado: {
            titulo: 'Reembolso de gasolina recusado ❌',
            assunto: '❌ Reembolso de gasolina recusado',
            corpo: `❌ Motivo: ${motivo}\n\n💡 O que fazer: na Área do Membro → Reembolso de Gasolina, as viagens aparecem como Recusada. Clique em Retomar viagens, corrija o que for preciso e solicite de novo.`,
        },
    }
    const t = textos[status]

    const whatsapp = `⛽ *${t.titulo}*\n\nOi *${primeiro}*!\n\n📝 *Sua solicitação:*\n- Projeto: ${d.projeto}\n- Valor: ${valor}\n\n${t.corpo}\n\n— VP Produtiva ⛽`
    const html = [
        `<p>Oi, ${escapar(primeiro)}!</p>`,
        `<p><b>${escapar(t.titulo)}</b></p>`,
        `<p>Projeto: <b>${escapar(d.projeto)}</b><br>Valor: <b>${escapar(valor)}</b></p>`,
        ...t.corpo.split('\n\n').map(p => `<p>${escapar(p)}</p>`),
        '<p>— VP Produtiva</p>',
    ].join('')

    return {
        status,
        membro: { nome: d.nome.trim(), email: d.email, whatsapp: numeroWhatsapp(d.telefone) },
        projeto: d.projeto,
        valor,
        assunto_email: t.assunto,
        mensagem_email: html,
        mensagem_whatsapp: whatsapp,
    }
}

// Busca os dados da solicitação e do membro e monta o aviso.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function dadosDoAviso(supabase: any, solicitacaoId: string, status: StatusAviso): Promise<DadosAviso | null> {
    const { data: s } = await supabase.from('gasolina_solicitacoes')
        .select('projeto, valor_total, motivo_recusa, colaborador:colaborador_id(nome, email_corporativo, email_pessoal, telefone)')
        .eq('id', solicitacaoId).maybeSingle()
    if (!s) return null
    const c = s.colaborador ?? {}
    return montarAviso(status, {
        nome: c.nome ?? '',
        email: c.email_corporativo || c.email_pessoal || null,
        telefone: c.telefone,
        projeto: s.projeto,
        valorTotal: Number(s.valor_total),
        motivo: s.motivo_recusa,
    })
}

// Envia o aviso para o n8n. Nunca lança erro: um aviso que falha não pode
// impedir a mudança de status (só fica registrado no log do servidor).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function avisarMembro(supabase: any, solicitacaoId: string, status: StatusAviso): Promise<void> {
    const url = process.env.GASOLINA_AVISOS_WEBHOOK_URL
    if (!url) return
    try {
        const aviso = await dadosDoAviso(supabase, solicitacaoId, status)
        if (!aviso) return
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(process.env.GASOLINA_INTEGRACAO_TOKEN ? { Authorization: `Bearer ${process.env.GASOLINA_INTEGRACAO_TOKEN}` } : {}),
            },
            body: JSON.stringify({ solicitacao_id: solicitacaoId, ...aviso }),
            signal: AbortSignal.timeout(8000),
        })
        if (!res.ok) console.error(`[gasolina] Aviso "${status}" da solicitação ${solicitacaoId}: n8n respondeu ${res.status}`)
    } catch (err) {
        console.error(`[gasolina] Aviso "${status}" da solicitação ${solicitacaoId} não enviado:`, err)
    }
}
