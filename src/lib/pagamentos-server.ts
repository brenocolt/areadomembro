// Regras de servidor do formulário "Solicitar Pagamento ou Reembolso":
// quem pode enviar, autenticação do n8n, histórico de eventos, links
// temporários dos comprovantes e o aviso de nova solicitação ao n8n.
import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { auth } from '@/auth'
import { paginaPermitida } from '@/lib/access-control'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import {
    OPCOES_PADRAO, STATUS_FINAIS, opcoesDeLinhas, podeEditarOpcoesPagamentos, podeUsarFormularioProprio,
    type OpcoesFormulario, type StatusProcessamento,
} from '@/lib/pagamentos-formulario'

export const BUCKET_PAGAMENTOS = 'pagamentos-comprovantes'
export const LINK_ANEXO_SEGUNDOS = 60 * 60 // links de comprovante valem 1 hora

export const MSG_NAO_CONFIGURADO =
    'O formulário ainda não está configurado no servidor (falta SUPABASE_SERVICE_ROLE_KEY ou a migração 20261113_pagamentos_solicitacoes.sql).'

// ---------------------------------------------------------------------------
// Membro autenticado
// ---------------------------------------------------------------------------

export interface MembroPagamentos { colaboradorId: string, nome: string, email: string | null, podeEditarOpcoes: boolean }

export async function exigirMembroPagamentos(db: SupabaseClient):
    Promise<{ ok: true, membro: MembroPagamentos } | { ok: false, status: number, error: string }> {
    const session = await auth()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usuario = session?.user as any
    const colaboradorId = usuario?.colaborador_id as string | undefined
    if (!colaboradorId) return { ok: false, status: 401, error: 'Não autenticado.' }

    const { data: c } = await db.from('colaboradores')
        .select('id, nome, email_corporativo, email_pessoal, cargo_atual, nucleo_atual, status, paginas_permitidas')
        .eq('id', colaboradorId)
        .maybeSingle()
    if (!c || c.status !== 'Ativo') return { ok: false, status: 403, error: 'Acesso restrito a membros ativos.' }
    // Mesma matriz do menu/RouteGuard (página liberada a todos os membros).
    if (!paginaPermitida('/pagamentos/solicitar', c, usuario?.role)) {
        return { ok: false, status: 403, error: 'Sem acesso a esta página.' }
    }
    // Fase de testes (VP + administradores), mesma regra da página.
    if (!podeUsarFormularioProprio(c, usuario?.role, formularioLiberadoParaTodos())) {
        return { ok: false, status: 403, error: 'O formulário novo ainda está em teste com a VP. Use o formulário do Monday.' }
    }
    return {
        ok: true,
        membro: {
            colaboradorId, nome: c.nome, email: c.email_corporativo || c.email_pessoal || null,
            podeEditarOpcoes: podeEditarOpcoesPagamentos(c, usuario?.role),
        },
    }
}

export function formularioLiberadoParaTodos(): boolean {
    return process.env.PAGAMENTOS_FORMULARIO_LIBERADO === 'todos'
}

// Qual formulário a página mostra para quem está acessando agora.
export async function formularioDaPagina(): Promise<{ tipo: 'monday' | 'proprio', emTeste: boolean }> {
    if (process.env.NEXT_PUBLIC_PAGAMENTOS_FORMULARIO === 'monday') return { tipo: 'monday', emTeste: false }
    const db = createAdminSupabaseClient()
    if (!db) return { tipo: 'monday', emTeste: false }   // servidor sem a chave: envio próprio não funcionaria
    if (formularioLiberadoParaTodos()) return { tipo: 'proprio', emTeste: false }

    const session = await auth()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const usuario = session?.user as any
    let colaborador: { nucleo_atual?: string | null } | null = null
    if (usuario?.colaborador_id) {
        const { data } = await db.from('colaboradores').select('nucleo_atual').eq('id', usuario.colaborador_id).maybeSingle()
        colaborador = data
    }
    return podeUsarFormularioProprio(colaborador, usuario?.role, false)
        ? { tipo: 'proprio', emTeste: true }
        : { tipo: 'monday', emTeste: false }
}

// ---------------------------------------------------------------------------
// Listas editáveis (pagamentos_opcoes). Se o banco falhar, usa as listas do
// código para o formulário continuar funcionando.
// ---------------------------------------------------------------------------

export async function carregarOpcoes(db: SupabaseClient): Promise<OpcoesFormulario> {
    const { data, error } = await db.from('pagamentos_opcoes')
        .select('lista, valor').eq('ativo', true)
        .order('ordem').order('valor')
    if (error) {
        console.error('[pagamentos] Listas do formulário indisponíveis (usando as do código):', error.message)
        return OPCOES_PADRAO
    }
    return opcoesDeLinhas(data ?? [])
}

// ---------------------------------------------------------------------------
// Autenticação do n8n: Authorization: Bearer PAGAMENTOS_INTEGRACAO_TOKEN
// (comparação em tempo constante, como em /api/gasolina/integracao/validar)
// ---------------------------------------------------------------------------

export function integracaoConfigurada(): boolean {
    return (process.env.PAGAMENTOS_INTEGRACAO_TOKEN || '').length >= 32
}

export function tokenIntegracaoValido(cabecalho: string | null): boolean {
    const esperado = process.env.PAGAMENTOS_INTEGRACAO_TOKEN || ''
    const recebido = (cabecalho || '').replace(/^Bearer\s+/i, '')
    if (esperado.length < 32 || !recebido) return false
    const hash = (s: string) => crypto.createHash('sha256').update(s).digest()
    return crypto.timingSafeEqual(hash(esperado), hash(recebido))
}

// ---------------------------------------------------------------------------
// Histórico (pagamentos_eventos). Nunca lança erro: falha no log não pode
// derrubar o envio do membro — só vai para o log do servidor.
// ---------------------------------------------------------------------------

export interface EventoPagamento {
    solicitacao_id: string
    origem: 'portal' | 'n8n'
    tipo: string
    chave_idempotencia?: string | null
    status_anterior?: string | null
    status_novo?: string | null
    detalhes?: unknown
    erro?: string | null
}

export async function registrarEvento(db: SupabaseClient, e: EventoPagamento): Promise<{ duplicado: boolean, erro?: string }> {
    const { error } = await db.from('pagamentos_eventos').insert(e)
    if (!error) return { duplicado: false }
    if (error.code === '23505') return { duplicado: true }
    console.error(`[pagamentos] Falha ao registrar evento "${e.tipo}" da solicitação ${e.solicitacao_id}:`, error.message)
    return { duplicado: false, erro: error.message }
}

// ---------------------------------------------------------------------------
// Dados entregues ao n8n (webhook e rota de consulta)
// ---------------------------------------------------------------------------

const COLUNAS_SOLICITACAO = `id, numero, colaborador_id, solicitante_nome, solicitante_email, versao_formulario,
    tipo, forma_pagamento, dados_bancarios, descricao, fornecedor, valor, centro_custo, categoria,
    categoria_execucao, outra_categoria, chave_pix, eh_pipj, eh_retirada_milha, tipo_retirada_milha,
    evento_mej, projeto, respostas, status_processamento, decisao, motivo_decisao, decidido_por, decidido_em,
    n8n_tentativas, n8n_ultimo_envio_em, n8n_ultimo_erro, kanban_item_id, criado_em, atualizado_em`

export const COLUNAS_RESUMO = `id, numero, colaborador_id, solicitante_nome, solicitante_email, tipo, valor,
    centro_custo, categoria, projeto, status_processamento, decisao, criado_em, atualizado_em`

function urlApp(): string {
    return (process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/+$/, '')
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function montarDadosSolicitacao(db: SupabaseClient, id: string): Promise<Record<string, any> | null> {
    const { data: s, error } = await db.from('pagamentos_solicitacoes').select(COLUNAS_SOLICITACAO).eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!s) return null

    const { data: anexos } = await db.from('pagamentos_anexos')
        .select('id, campo, caminho, nome_original, tipo_mime, tamanho_bytes')
        .eq('solicitacao_id', id)
        .order('criado_em')
    const lista = anexos ?? []
    const links = new Map<string, string>()
    if (lista.length) {
        const { data: assinados } = await db.storage.from(BUCKET_PAGAMENTOS)
            .createSignedUrls(lista.map(a => a.caminho), LINK_ANEXO_SEGUNDOS)
        for (const a of assinados ?? []) if (a.path && a.signedUrl) links.set(a.path, a.signedUrl)
    }
    const expira = new Date(Date.now() + LINK_ANEXO_SEGUNDOS * 1000).toISOString()
    const base = urlApp()

    const { respostas, ...campos } = s
    return {
        solicitacao: {
            ...campos,
            valor: Number(s.valor),
            // Nome como no formulário original, para facilitar a adaptação do n8n.
            gasto_evento_mej: s.centro_custo === 'Eventos MEJ' ? s.categoria : null,
            respostas_originais: respostas,
        },
        solicitante: { colaborador_id: s.colaborador_id, nome: s.solicitante_nome, email: s.solicitante_email },
        anexos: lista.map(a => ({
            id: a.id, campo: a.campo, nome: a.nome_original, tipo_mime: a.tipo_mime,
            tamanho_bytes: Number(a.tamanho_bytes), url: links.get(a.caminho) ?? null, url_expira_em: expira,
        })),
        links: base ? {
            consultar: `${base}/api/pagamentos/integracao/solicitacoes/${id}`,
            atualizar_processamento: `${base}/api/pagamentos/integracao/solicitacoes/${id}/processamento`,
        } : null,
    }
}

// ---------------------------------------------------------------------------
// Aviso de nova solicitação ao n8n (PAGAMENTOS_N8N_WEBHOOK_URL). Nunca lança
// erro: a solicitação já está salva; se o n8n falhar, fica "erro_envio" com o
// motivo registrado, e o n8n pode buscá-la pela lista de pendentes.
// ---------------------------------------------------------------------------

export async function notificarN8n(db: SupabaseClient, id: string): Promise<void> {
    const url = process.env.PAGAMENTOS_N8N_WEBHOOK_URL
    if (!url) {
        await registrarEvento(db, { solicitacao_id: id, origem: 'portal', tipo: 'n8n_nao_configurado', detalhes: { aviso: 'PAGAMENTOS_N8N_WEBHOOK_URL vazio: o n8n precisa buscar pela lista de pendentes.' } })
        return
    }
    let erro: string | null = null
    let tentativas = 0
    try {
        const dados = await montarDadosSolicitacao(db, id)
        if (!dados) return
        tentativas = Number(dados.solicitacao.n8n_tentativas ?? 0)
        const res = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(process.env.PAGAMENTOS_INTEGRACAO_TOKEN ? { Authorization: `Bearer ${process.env.PAGAMENTOS_INTEGRACAO_TOKEN}` } : {}),
                // O n8n pode usar para ignorar o mesmo aviso repetido.
                'Idempotency-Key': `pagamento-${id}`,
            },
            body: JSON.stringify({ evento: 'solicitacao.criada', ...dados }),
            signal: AbortSignal.timeout(10000),
        })
        if (!res.ok) erro = `n8n respondeu HTTP ${res.status}: ${(await res.text().catch(() => '')).slice(0, 300)}`
    } catch (e) {
        erro = e instanceof Error ? e.message : String(e)
    }

    const agora = new Date().toISOString()
    // Só mexe no status se o n8n ainda não avançou a solicitação.
    await db.from('pagamentos_solicitacoes')
        .update({
            n8n_tentativas: tentativas + 1,
            n8n_ultimo_envio_em: agora,
            n8n_ultimo_erro: erro,
            atualizado_em: agora,
            status_processamento: erro ? 'erro_envio' : 'enviada_n8n',
        })
        .eq('id', id)
        .in('status_processamento', ['recebida', 'erro_envio'])
    if (erro) console.error(`[pagamentos] Aviso ao n8n da solicitação ${id} falhou: ${erro}`)
    await registrarEvento(db, {
        solicitacao_id: id, origem: 'portal',
        tipo: erro ? 'n8n_envio_falhou' : 'n8n_envio_ok',
        status_novo: erro ? 'erro_envio' : 'enviada_n8n',
        erro,
    })
}

export function ehStatusFinal(s: string | null | undefined): boolean {
    return (STATUS_FINAIS as readonly string[]).includes(s ?? '')
}

// Status que o n8n pode informar (os de envio são exclusivos do portal).
export const STATUS_DO_N8N: readonly StatusProcessamento[] = [
    'em_processamento', 'aguardando_aprovacao', 'erro_processamento', 'aprovada', 'recusada',
]
