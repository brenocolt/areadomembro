// Operações da aba Reconhecimentos e Bonificações (SERVIDOR). Recebe os clientes com a service role já
// criados pelo guard, DEPOIS de validar sessão + (Vice Presidência ativa | ADMIN).
// O histórico NÃO é gravado aqui: triggers do banco registram cada alteração (autor vindo dos cabeçalhos
// x-app-usuario-*), na mesma transação da alteração.
import type { SupabaseClient } from '@supabase/supabase-js'
import { formatarData, hojeISO } from './datas'
import { ErroDeRequisicao } from './erros'
import { NUCLEOS, STATUS_ACEITA_ENTREGAS, STATUS_LABEL } from './constantes'
import {
    bonificacoesParaExpirar, calcularNovasBonificacoes, normalizarEntrega, podeCancelar, podeConcluir,
    proximoNumeroRg, resumirEntregas, type NovaBonificacao, type ReconhecimentoMotor, type RegraMotor,
} from './motor'
import {
    parseAtualizacaoEntrega, parseAtualizacaoTipo, parseCriacaoReconhecimento, parseMotivo, parseNovasEntregas,
    parseNovoTipo, parseNucleo, parseRegra, validarCamposReconhecimento, type EntradaReconhecimento, type TipoParaValidar,
} from './validacao'

/* eslint-disable @typescript-eslint/no-explicit-any */
export type Db = SupabaseClient<any, any, any>
type Linha = Record<string, any>
type EntregaLinha = Linha & { situacao: string }
export interface UsuarioServico { id: string; email: string; nome: string }

const PAGINA = 1000
const LOTE = 200

type Resposta<T> = PromiseLike<{ data: T[] | null; error: { message: string; code?: string } | null }>

// PostgREST devolve no máximo 1000 linhas por consulta: pagina até acabar.
async function buscarTudo<T = Linha>(montar: (de: number, ate: number) => Resposta<T>): Promise<T[]> {
    const todas: T[] = []
    for (let de = 0; ; de += PAGINA) {
        const { data, error } = await montar(de, de + PAGINA - 1)
        if (error) throw erroDe(error)
        if (!data || data.length === 0) break
        todas.push(...data)
        if (data.length < PAGINA) break
    }
    return todas
}

const MENSAGENS_UNICIDADE: Record<string, string> = {
    reconhecimentos_rg_unq: 'Este projeto já tem uma RG com esse número registrada.',
    reconhecimentos_individual_periodo_unq: 'Este colaborador já tem esse reconhecimento no período informado.',
    reconhecimentos_nucleo_periodo_unq: 'Este núcleo já tem esse reconhecimento no período informado.',
    entregas_unica_por_pessoa: 'Este colaborador já está nesta bonificação.',
    reconhecimento_tipos_nome_key: 'Já existe um tipo com esse nome.',
}

// Traduz erros do banco (PostgREST) em respostas claras.
export function erroDe(error: { message: string; code?: string; details?: string | null }): Error {
    if (error.code === '23505') {
        const texto = `${error.message} ${error.details ?? ''}`
        const achada = Object.keys(MENSAGENS_UNICIDADE).find(c => texto.includes(c))
        return new ErroDeRequisicao(achada ? MENSAGENS_UNICIDADE[achada] : 'Já existe um registro igual.', 409)
    }
    if (error.code === '23514') return new ErroDeRequisicao('Os dados informados violam uma regra de integridade.', 400)
    if (error.code === '42501' && /imutável/.test(error.message)) return new ErroDeRequisicao('O histórico não pode ser alterado.', 409)
    return new Error(error.message)
}

function falhou(error: { message: string; code?: string } | null | undefined) {
    if (error) throw erroDe(error)
}

function emLotes<T>(itens: T[], tamanho = LOTE): T[][] {
    const lotes: T[][] = []
    for (let i = 0; i < itens.length; i += tamanho) lotes.push(itens.slice(i, i + tamanho))
    return lotes
}

// ------------------------------------------------------------------------ leitura

export async function listarDados(db: Db) {
    const [tipos, nucleosConfig, regras, reconhecimentos, bonificacoes, entregas] = await Promise.all([
        buscarTudo((de, ate) => db.from('reconhecimento_tipos').select('*').order('ordem').order('id').range(de, ate)),
        buscarTudo((de, ate) => db.from('reconhecimento_nucleos').select('*').order('nucleo').range(de, ate)),
        buscarTudo((de, ate) => db.from('regras_bonificacao').select('*').order('created_at').order('id').range(de, ate)),
        buscarTudo((de, ate) => db.from('reconhecimentos').select('*').is('excluido_em', null)
            .order('data_reconhecimento', { ascending: false }).order('created_at', { ascending: false }).order('id').range(de, ate)),
        buscarTudo((de, ate) => db.from('bonificacoes').select('*')
            .order('liberada_em', { ascending: false }).order('created_at', { ascending: false }).order('id').range(de, ate)),
        buscarTudo((de, ate) => db.from('bonificacao_entregas').select('*').order('created_at').order('colaborador_nome').order('id').range(de, ate)),
    ])
    // A lista de núcleos vem do sistema; aqui só se aplica o que foi configurado (padrão: elegível).
    const config = new Map(nucleosConfig.map((n: Linha) => [n.nucleo, n.elegivel]))
    const nucleos = NUCLEOS.map(nucleo => ({ nucleo, elegivel: config.get(nucleo) ?? true }))
    return { tipos, nucleos, regras, reconhecimentos, bonificacoes, entregas }
}

export async function listarProjetos(db: Db) {
    const { data, error } = await db.from('projetos').select('id, nome').eq('status', 'Ativo').order('nome')
    falhou(error)
    return (data || []) as Array<{ id: string; nome: string }>
}

export async function listarColaboradores(db: Db) {
    const todos = await buscarTudo<Linha>((de, ate) => db.from('colaboradores').select('id, nome, nucleo_atual, cargo_atual, status').order('nome').range(de, ate))
    return todos.filter(c => c.status !== 'Desligado').map(c => ({ id: c.id, nome: c.nome, nucleo: c.nucleo_atual, cargo: c.cargo_atual }))
}

export async function proximoRg(db: Db, projetoId: string): Promise<number> {
    const { data, error } = await db.from('reconhecimentos').select('numero_rg').eq('projeto_id', projetoId).is('excluido_em', null).not('numero_rg', 'is', null)
    falhou(error)
    return proximoNumeroRg((data || []).map((r: Linha) => r.numero_rg))
}

export async function listarHistorico(db: Db, filtros: { reconhecimento_id?: string; bonificacao_id?: string; antes?: string; limite?: number }) {
    const limite = Math.min(Math.max(filtros.limite ?? 300, 1), 1000)
    let q = db.from('reconhecimento_historico').select('*').order('created_at', { ascending: false }).order('id').limit(limite)
    if (filtros.reconhecimento_id) q = q.eq('reconhecimento_id', filtros.reconhecimento_id)
    if (filtros.bonificacao_id) q = q.eq('bonificacao_id', filtros.bonificacao_id)
    if (filtros.antes) q = q.lt('created_at', filtros.antes)
    const { data, error } = await q
    falhou(error)
    return data || []
}

// ------------------------------------------------------------------------ apoio

async function carregarTipo(db: Db, id: string, permitirInativo = false): Promise<TipoParaValidar> {
    const { data, error } = await db.from('reconhecimento_tipos').select('*').eq('id', id).maybeSingle()
    falhou(error)
    if (!data || (!data.ativo && !permitirInativo)) throw new ErroDeRequisicao('Selecione o tipo de reconhecimento.')
    return data as TipoParaValidar
}

async function resolverAlvo(db: Db, campos: EntradaReconhecimento, atual?: Linha) {
    const alvo: { projeto_nome: string | null; colaborador_nome: string | null } = { projeto_nome: null, colaborador_nome: null }
    if (campos.projeto_id) {
        if (atual && atual.projeto_id === campos.projeto_id) alvo.projeto_nome = atual.projeto_nome
        else {
            const { data, error } = await db.from('projetos').select('id, nome').eq('id', campos.projeto_id).maybeSingle()
            falhou(error)
            if (!data) throw new ErroDeRequisicao('Projeto não encontrado.')
            alvo.projeto_nome = data.nome
        }
    }
    if (campos.colaborador_id) {
        if (atual && atual.colaborador_id === campos.colaborador_id) alvo.colaborador_nome = atual.colaborador_nome
        else {
            const { data, error } = await db.from('colaboradores').select('id, nome, status').eq('id', campos.colaborador_id).maybeSingle()
            falhou(error)
            if (!data) throw new ErroDeRequisicao('Colaborador não encontrado.')
            if (data.status === 'Desligado') throw new ErroDeRequisicao('Colaborador desligado não pode ser reconhecido.')
            alvo.colaborador_nome = data.nome
        }
    }
    if (campos.nucleo && !(atual && atual.nucleo === campos.nucleo)) {
        const { data, error } = await db.from('reconhecimento_nucleos').select('elegivel').eq('nucleo', campos.nucleo).maybeSingle()
        falhou(error)
        if (data && data.elegivel === false) throw new ErroDeRequisicao('Este núcleo não está elegível a reconhecimentos.')
    }
    return alvo
}

async function verificarRgDisponivel(db: Db, projetoId: string, numero: number, ignorarId?: string) {
    let q = db.from('reconhecimentos').select('id, data_reconhecimento').eq('projeto_id', projetoId).eq('numero_rg', numero).is('excluido_em', null)
    if (ignorarId) q = q.neq('id', ignorarId)
    const { data, error } = await q
    falhou(error)
    if (data && data.length > 0) {
        throw new ErroDeRequisicao(`Este projeto já tem a ${numero}ª RG registrada (${formatarData(data[0].data_reconhecimento)}). Use o próximo número ou edite o registro existente.`, 409)
    }
}

// ----------------------------------------------------------- geração de bonificações

export interface PreviaBonificacao { motivo: string; sujeito: string; liberada_em: string; regra: string }

/**
 * Gera (ou apenas simula) as bonificações que faltam. Idempotente: a chave única impede duplicidade, e o
 * INSERT usa ON CONFLICT DO NOTHING (duas execuções simultâneas não derrubam o lote).
 */
export async function gerarBonificacoes(
    db: Db, opcoes: { regraId?: string; ignorarVigencia?: boolean; somentePrevia?: boolean } = {},
): Promise<{ geradas: number; previa: PreviaBonificacao[] }> {
    const [regras, tipos, recs, chaves] = await Promise.all([
        buscarTudo<RegraMotor>((de, ate) => {
            let q = db.from('regras_bonificacao').select('*').eq('ativo', true)
            if (opcoes.regraId) q = q.eq('id', opcoes.regraId)
            return q.order('id').range(de, ate)
        }),
        buscarTudo<Linha>((de, ate) => db.from('reconhecimento_tipos').select('id, nome').order('id').range(de, ate)),
        buscarTudo<ReconhecimentoMotor>((de, ate) => db.from('reconhecimentos')
            .select('id, tipo_id, data_reconhecimento, projeto_id, projeto_nome, colaborador_id, colaborador_nome, nucleo, numero_rg, created_at')
            .is('excluido_em', null).order('data_reconhecimento').order('id').range(de, ate)),
        buscarTudo<Linha>((de, ate) => db.from('bonificacoes').select('chave_unica').order('id').range(de, ate)),
    ])
    const novas: NovaBonificacao[] = calcularNovasBonificacoes({
        regras,
        reconhecimentos: recs,
        nomesDosTipos: Object.fromEntries(tipos.map(t => [t.id, t.nome])),
        chavesExistentes: chaves.map(c => c.chave_unica),
        ignorarVigencia: opcoes.ignorarVigencia,
    })
    const previa = novas.slice(0, 20).map(n => ({
        motivo: n.motivo, regra: n.regra_nome, liberada_em: n.liberada_em,
        sujeito: n.projeto_nome || n.colaborador_nome || n.nucleo || '',
    }))
    if (opcoes.somentePrevia) return { geradas: novas.length, previa }

    let geradas = 0
    for (const lote of emLotes(novas)) {
        const { data, error } = await db.from('bonificacoes').upsert(lote, { onConflict: 'chave_unica', ignoreDuplicates: true }).select('id')
        falhou(error)
        geradas += data?.length ?? 0
    }
    return { geradas, previa }
}

async function expirarVencidas(dbSistema: Db, hoje: string): Promise<number> {
    const vencidas = await buscarTudo<Linha>((de, ate) => dbSistema.from('bonificacoes').select('id, status, prazo_limite')
        .eq('status', 'disponivel').lt('prazo_limite', hoje).order('id').range(de, ate))
    if (vencidas.length === 0) return 0
    const concluidas = new Set<string>()
    for (const lote of emLotes(vencidas.map(b => b.id), 100)) {
        const { data, error } = await dbSistema.from('bonificacao_entregas').select('bonificacao_id').in('bonificacao_id', lote).eq('situacao', 'entregue')
        falhou(error)
        for (const e of data || []) concluidas.add(e.bonificacao_id)
    }
    const ids = bonificacoesParaExpirar(vencidas as any, concluidas, hoje)
    let expiradas = 0
    for (const lote of emLotes(ids)) {
        // O filtro de status evita sobrescrever uma conclusão/cancelamento concorrente.
        const { data, error } = await dbSistema.from('bonificacoes').update({ status: 'expirada' }).in('id', lote).eq('status', 'disponivel').select('id')
        falhou(error)
        expiradas += data?.length ?? 0
    }
    return expiradas
}

/** Ao abrir a aba: gera o que faltar e expira o que venceu (a expiração é atribuída ao "sistema"). */
export async function sincronizar(db: Db, dbSistema: Db) {
    const { geradas } = await gerarBonificacoes(db)
    const expiradas = await expirarVencidas(dbSistema, hojeISO())
    return { geradas, expiradas }
}

async function marcarOrigemAlterada(db: Db, reconhecimentoId: string) {
    const { error } = await db.from('bonificacoes').update({ origem_alterada: true }).eq('reconhecimento_id', reconhecimentoId).eq('origem_alterada', false)
    falhou(error)
}

// ----------------------------------------------------------------- reconhecimentos

export async function criarReconhecimento(db: Db, usuario: UsuarioServico, body: unknown) {
    const { tipo_id } = parseCriacaoReconhecimento(body)
    const tipo = await carregarTipo(db, tipo_id)
    const campos = validarCamposReconhecimento(body, tipo, hojeISO())
    const alvo = await resolverAlvo(db, campos)
    if (campos.projeto_id && campos.numero_rg !== null) await verificarRgDisponivel(db, campos.projeto_id, campos.numero_rg)
    const { data, error } = await db.from('reconhecimentos')
        .insert({ tipo_id, ...campos, ...alvo, criado_por_id: usuario.id, criado_por_email: usuario.email })
        .select().single()
    falhou(error)
    const { geradas } = await gerarBonificacoes(db)
    return { reconhecimento: data as Linha, geradas }
}

const CAMPOS_COM_EFEITO_NA_ORIGEM = ['data_reconhecimento', 'projeto_id', 'colaborador_id', 'nucleo', 'numero_rg', 'periodo_referencia'] as const

export async function editarReconhecimento(db: Db, usuario: UsuarioServico, id: string, body: unknown) {
    void usuario
    const { data: atual, error } = await db.from('reconhecimentos').select('*').eq('id', id).is('excluido_em', null).maybeSingle()
    falhou(error)
    if (!atual) throw new ErroDeRequisicao('Reconhecimento não encontrado.', 404)
    const tipo = await carregarTipo(db, atual.tipo_id, true)
    const campos = validarCamposReconhecimento(body, tipo, hojeISO())
    const alvo = await resolverAlvo(db, campos, atual)
    if (campos.projeto_id && campos.numero_rg !== null && (campos.projeto_id !== atual.projeto_id || campos.numero_rg !== atual.numero_rg)) {
        await verificarRgDisponivel(db, campos.projeto_id, campos.numero_rg, id)
    }
    const novo: Linha = { ...campos, ...alvo }
    const mudou = Object.keys(novo).some(k => novo[k] !== atual[k])
    if (!mudou) return { reconhecimento: atual as Linha, alterado: false, geradas: 0 }

    const { data, error: erroUpd } = await db.from('reconhecimentos').update(novo).eq('id', id).is('excluido_em', null).select().single()
    falhou(erroUpd)
    if (CAMPOS_COM_EFEITO_NA_ORIGEM.some(k => novo[k] !== atual[k])) await marcarOrigemAlterada(db, id)
    const { geradas } = await gerarBonificacoes(db)
    return { reconhecimento: data as Linha, alterado: true, geradas }
}

export async function excluirReconhecimento(db: Db, usuario: UsuarioServico, id: string, body: unknown) {
    const motivo = parseMotivo(body, 'Informe o motivo da exclusão.')
    const { data, error } = await db.from('reconhecimentos')
        .update({ excluido_em: new Date().toISOString(), excluido_por: usuario.email, excluido_motivo: motivo })
        .eq('id', id).is('excluido_em', null).select('id')
    falhou(error)
    if (!data?.length) throw new ErroDeRequisicao('Reconhecimento não encontrado.', 404)
    await marcarOrigemAlterada(db, id)
}

// ------------------------------------------------------------------ tipos e núcleos

export async function criarTipo(db: Db, body: unknown) {
    const novo = parseNovoTipo(body)
    const { count, error } = await db.from('reconhecimento_tipos').select('id', { count: 'exact', head: true })
    falhou(error)
    const { data, error: erroIns } = await db.from('reconhecimento_tipos').insert({ ...novo, ordem: (count ?? 0) + 1 }).select().single()
    falhou(erroIns)
    return data as Linha
}

export async function editarTipo(db: Db, id: string, body: unknown) {
    const campos = parseAtualizacaoTipo(body)
    const { data, error } = await db.from('reconhecimento_tipos').update(campos).eq('id', id).select().maybeSingle()
    falhou(error)
    if (!data) throw new ErroDeRequisicao('Tipo não encontrado.', 404)
    return data as Linha
}

export async function configurarNucleo(db: Db, body: unknown) {
    const { nucleo, elegivel } = parseNucleo(body)
    const { data, error } = await db.from('reconhecimento_nucleos').upsert({ nucleo, elegivel }, { onConflict: 'nucleo' }).select().single()
    falhou(error)
    return data as Linha
}

// ----------------------------------------------------------------------- regras

async function validarRegraComTipo(db: Db, regra: { tipo_id: string; gatilho: string }) {
    const tipo = await carregarTipo(db, regra.tipo_id, true)
    if (regra.gatilho === 'marcos_de_rg' && tipo.escopo !== 'projeto') {
        throw new ErroDeRequisicao('Marcos de RG só valem para tipos de reconhecimento de projeto.')
    }
}

export async function criarRegra(db: Db, usuario: UsuarioServico, body: unknown) {
    const entrada = parseRegra(body)
    await validarRegraComTipo(db, entrada)
    const { data, error } = await db.from('regras_bonificacao')
        .insert({ ...entrada, criado_por_email: usuario.email })
        .select().single()
    falhou(error)
    const { geradas } = await gerarBonificacoes(db, { regraId: data.id })
    return { regra: data as Linha, geradas }
}

export async function editarRegra(db: Db, id: string, body: unknown) {
    const entrada = parseRegra(body)
    const { data: atual, error } = await db.from('regras_bonificacao').select('*').eq('id', id).maybeSingle()
    falhou(error)
    if (!atual) throw new ErroDeRequisicao('Regra não encontrada.', 404)
    if (atual.tipo_id !== entrada.tipo_id) throw new ErroDeRequisicao('O tipo de uma regra não pode ser alterado; crie uma nova regra.')
    await validarRegraComTipo(db, entrada)
    const { data, error: erroUpd } = await db.from('regras_bonificacao')
        .update(entrada).eq('id', id).select().single()
    falhou(erroUpd)
    // Bonificações já geradas mantêm os valores da época (cópias na própria bonificação).
    const { geradas } = await gerarBonificacoes(db, { regraId: id })
    return { regra: data as Linha, geradas }
}

export async function previaRetroativa(db: Db, regraId: string) {
    const { geradas, previa } = await gerarBonificacoes(db, { regraId, ignorarVigencia: true, somentePrevia: true })
    return { total: geradas, amostra: previa }
}

export async function aplicarRetroativo(db: Db, regraId: string) {
    const { geradas } = await gerarBonificacoes(db, { regraId, ignorarVigencia: true })
    return { geradas }
}

// ----------------------------------------------------------------- bonificações

async function carregarBonificacao(db: Db, id: string): Promise<Linha> {
    const { data, error } = await db.from('bonificacoes').select('*').eq('id', id).maybeSingle()
    falhou(error)
    if (!data) throw new ErroDeRequisicao('Bonificação não encontrada.', 404)
    return data
}

async function entregasDa(db: Db, bonificacaoId: string): Promise<EntregaLinha[]> {
    const { data, error } = await db.from('bonificacao_entregas').select('*').eq('bonificacao_id', bonificacaoId).order('created_at').order('colaborador_nome').order('id')
    falhou(error)
    return (data || []) as EntregaLinha[]
}

export async function obterBonificacao(db: Db, id: string) {
    const bonificacao = await carregarBonificacao(db, id)
    const [entregas, historico] = await Promise.all([entregasDa(db, id), listarHistorico(db, { bonificacao_id: id, limite: 200 })])
    return { bonificacao, entregas, historico }
}

// Um cartão "Entregue" volta a "Disponível" se passar a ter alguém pendente.
async function reabrirSeHouverPendencias(db: Db, bonificacao: Linha, entregas: EntregaLinha[]) {
    if (bonificacao.status === 'entregue' && resumirEntregas(entregas).pendentes > 0) {
        const { error } = await db.from('bonificacoes').update({ status: 'disponivel', concluida_em: null, concluida_por: null }).eq('id', bonificacao.id).eq('status', 'entregue')
        falhou(error)
        return true
    }
    return false
}

function normalizar(d: Parameters<typeof normalizarEntrega>[0]) {
    try { return normalizarEntrega(d, hojeISO()) } catch (e) { throw new ErroDeRequisicao((e as Error).message) }
}

export async function adicionarEntregas(db: Db, usuario: UsuarioServico, bonificacaoId: string, body: unknown) {
    const entrada = parseNovasEntregas(body)
    const bonificacao = await carregarBonificacao(db, bonificacaoId)
    if (!STATUS_ACEITA_ENTREGAS.includes(bonificacao.status)) {
        throw new ErroDeRequisicao(`Uma bonificação ${STATUS_LABEL[bonificacao.status]?.toLowerCase() ?? bonificacao.status} não aceita novas entregas.`, 409)
    }
    const { data: pessoas, error } = await db.from('colaboradores').select('id, nome, status').in('id', entrada.colaborador_ids)
    falhou(error)
    if ((pessoas?.length ?? 0) !== entrada.colaborador_ids.length) throw new ErroDeRequisicao('Colaborador não encontrado.')
    const desligados = (pessoas || []).filter((p: Linha) => p.status === 'Desligado').map((p: Linha) => p.nome)
    if (desligados.length) throw new ErroDeRequisicao(`Colaborador desligado: ${desligados.join(', ')}.`)

    const jaTem = (await entregasDa(db, bonificacaoId)).filter(e => entrada.colaborador_ids.includes(e.colaborador_id))
    if (jaTem.length) throw new ErroDeRequisicao(`Já está nesta bonificação: ${jaTem.map(e => e.colaborador_nome).join(', ')}.`, 409)

    const datas = normalizar(entrada)
    const linhas = (pessoas || []).map((p: Linha) => ({
        bonificacao_id: bonificacaoId,
        colaborador_id: p.id,
        colaborador_nome: p.nome,
        ...datas,
        aprovada_por: datas.situacao !== 'solicitada' ? usuario.email : null,
        entregue_por: datas.situacao === 'entregue' ? usuario.email : null,
        observacao: entrada.observacao,
        criado_por_email: usuario.email,
    }))
    const ins = await db.from('bonificacao_entregas').insert(linhas)
    falhou(ins.error)
    const entregas = await entregasDa(db, bonificacaoId)
    const reaberta = await reabrirSeHouverPendencias(db, bonificacao, entregas)
    return { entregas, reaberta }
}

export async function atualizarEntrega(db: Db, usuario: UsuarioServico, bonificacaoId: string, entregaId: string, body: unknown) {
    const entrada = parseAtualizacaoEntrega(body)
    const bonificacao = await carregarBonificacao(db, bonificacaoId)
    if (bonificacao.status === 'cancelada') throw new ErroDeRequisicao('Bonificação cancelada não aceita alterações nas entregas.', 409)
    const { data: atual, error } = await db.from('bonificacao_entregas').select('*').eq('id', entregaId).eq('bonificacao_id', bonificacaoId).maybeSingle()
    falhou(error)
    if (!atual) throw new ErroDeRequisicao('Entrega não encontrada.', 404)

    const datas = normalizar({
        situacao: entrada.situacao,
        solicitada_em: entrada.solicitada_em ?? atual.solicitada_em,
        aprovada_em: entrada.aprovada_em ?? atual.aprovada_em,
        entregue_em: entrada.entregue_em ?? atual.entregue_em,
    })
    const novo: Linha = {
        ...datas,
        // quem aprovou/entregou: mantém o autor original; só registra o autor ao passar pela etapa
        aprovada_por: datas.aprovada_em ? (atual.aprovada_por ?? usuario.email) : null,
        entregue_por: datas.entregue_em ? (atual.entregue_por ?? usuario.email) : null,
        observacao: entrada.observacao,
    }
    const { error: erroUpd } = await db.from('bonificacao_entregas').update(novo).eq('id', entregaId).eq('bonificacao_id', bonificacaoId)
    falhou(erroUpd)
    const entregas = await entregasDa(db, bonificacaoId)
    const reaberta = await reabrirSeHouverPendencias(db, bonificacao, entregas)
    return { entregas, reaberta }
}

export async function concluirBonificacao(db: Db, usuario: UsuarioServico, id: string) {
    const bonificacao = await carregarBonificacao(db, id)
    if (bonificacao.status !== 'disponivel') {
        throw new ErroDeRequisicao(`Só é possível concluir uma bonificação disponível (esta está ${STATUS_LABEL[bonificacao.status]?.toLowerCase() ?? bonificacao.status}).`, 409)
    }
    const pode = podeConcluir(await entregasDa(db, id))
    if (!pode.ok) throw new ErroDeRequisicao(pode.motivo, 409)
    const { data, error } = await db.from('bonificacoes')
        .update({ status: 'entregue', concluida_em: new Date().toISOString(), concluida_por: usuario.email })
        .eq('id', id).eq('status', 'disponivel').select('id')
    falhou(error)
    if (!data?.length) throw new ErroDeRequisicao('A bonificação foi alterada por outra pessoa. Atualize a página.', 409)
}

export async function cancelarBonificacao(db: Db, usuario: UsuarioServico, id: string, body: unknown) {
    const justificativa = parseMotivo({ motivo: (body as Linha)?.justificativa }, 'Informe a justificativa do cancelamento.')
    const bonificacao = await carregarBonificacao(db, id)
    if (!['disponivel', 'expirada'].includes(bonificacao.status)) {
        throw new ErroDeRequisicao(`Esta bonificação está ${STATUS_LABEL[bonificacao.status]?.toLowerCase() ?? bonificacao.status} e não pode ser cancelada.`, 409)
    }
    const pode = podeCancelar(await entregasDa(db, id))
    if (!pode.ok) throw new ErroDeRequisicao(pode.motivo, 409)
    const { data, error } = await db.from('bonificacoes')
        .update({ status: 'cancelada', cancelada_em: new Date().toISOString(), cancelada_por: usuario.email, justificativa_cancelamento: justificativa })
        .eq('id', id).in('status', ['disponivel', 'expirada']).select('id')
    falhou(error)
    if (!data?.length) throw new ErroDeRequisicao('A bonificação foi alterada por outra pessoa. Atualize a página.', 409)
}
