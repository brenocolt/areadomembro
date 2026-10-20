// Validação e normalização dos corpos de requisição da aba (PURA, sem I/O).
// Toda validação de negócio acontece também no servidor; a interface só repete para dar retorno rápido.
import { ErroDeRequisicao } from './erros'
import { dataISOValida } from './datas'
import { GATILHOS, NUCLEOS, PREMIACOES, SITUACOES_ENTREGA, type Escopo } from './constantes'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function objeto(body: unknown): Record<string, unknown> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ErroDeRequisicao('Corpo da requisição inválido.')
    return body as Record<string, unknown>
}

export function exigirUuid(valor: unknown, mensagem: string): string {
    if (typeof valor !== 'string' || !UUID_RE.test(valor)) throw new ErroDeRequisicao(mensagem)
    return valor
}

function texto(valor: unknown, max: number, campo: string): string {
    if (valor === undefined || valor === null) return ''
    if (typeof valor !== 'string') throw new ErroDeRequisicao(`${campo} inválido.`)
    if (valor.length > max) throw new ErroDeRequisicao(`${campo} muito longo (máx. ${max} caracteres).`)
    return valor
}

function vazio(v: unknown) { return v === undefined || v === null || v === '' }

function inteiroOpcional(v: unknown, minimo: number, maximo: number, campo: string): number | null {
    if (vazio(v)) return null
    const n = Number(v)
    if (!Number.isInteger(n) || n < minimo || n > maximo) throw new ErroDeRequisicao(`${campo} inválido (use um número inteiro entre ${minimo} e ${maximo}).`)
    return n
}

function dataOpcional(v: unknown, campo: string): string | null {
    if (vazio(v)) return null
    if (!dataISOValida(v)) throw new ErroDeRequisicao(`${campo} inválida.`)
    return v
}

/** Aceita "AAAA-MM" ou "AAAA-MM-DD" e devolve sempre o 1º dia do mês ("AAAA-MM-01"). */
export function normalizarPeriodo(v: unknown): string | null {
    if (vazio(v)) return null
    if (typeof v !== 'string') throw new ErroDeRequisicao('Período de referência inválido.')
    const m = /^(\d{4})-(\d{2})(?:-\d{2})?$/.exec(v)
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) throw new ErroDeRequisicao('Período de referência inválido (use mês e ano).')
    return `${m[1]}-${m[2]}-01`
}

// -------------------------------------------------------------- reconhecimentos

export interface TipoParaValidar {
    id: string
    nome: string
    escopo: Escopo
    usa_periodo: boolean
    ativo: boolean
}

export interface EntradaReconhecimento {
    data_reconhecimento: string
    projeto_id: string | null
    colaborador_id: string | null
    nucleo: string | null
    numero_rg: number | null
    periodo_referencia: string | null
    observacoes: string | null
}

/** Campos editáveis de um reconhecimento, conforme o escopo do tipo. O tipo em si não é editável. */
export function validarCamposReconhecimento(body: unknown, tipo: TipoParaValidar, hoje: string): EntradaReconhecimento {
    const b = objeto(body)
    if (!dataISOValida(b.data_reconhecimento)) throw new ErroDeRequisicao('Informe a data do reconhecimento.')
    if (b.data_reconhecimento > hoje) throw new ErroDeRequisicao('A data do reconhecimento não pode ser futura.')
    const base: EntradaReconhecimento = {
        data_reconhecimento: b.data_reconhecimento,
        projeto_id: null, colaborador_id: null, nucleo: null, numero_rg: null,
        periodo_referencia: tipo.usa_periodo ? normalizarPeriodo(b.periodo_referencia) : null,
        observacoes: texto(b.observacoes, 2000, 'Observações').trim() || null,
    }
    if (tipo.escopo === 'projeto') {
        base.projeto_id = exigirUuid(b.projeto_id, 'Selecione o projeto.')
        const numero = inteiroOpcional(b.numero_rg, 1, 9999, 'Número da RG')
        if (numero === null) throw new ErroDeRequisicao('Informe o número da RG.')
        base.numero_rg = numero
    } else if (tipo.escopo === 'colaborador') {
        base.colaborador_id = exigirUuid(b.colaborador_id, 'Selecione o colaborador.')
    } else {
        const nucleo = typeof b.nucleo === 'string' ? b.nucleo : ''
        if (!nucleo) throw new ErroDeRequisicao('Selecione o núcleo.')
        if (!(NUCLEOS as readonly string[]).includes(nucleo)) throw new ErroDeRequisicao('Núcleo inválido.')
        base.nucleo = nucleo
    }
    return base
}

export function parseCriacaoReconhecimento(body: unknown): { tipo_id: string } {
    const b = objeto(body)
    return { tipo_id: exigirUuid(b.tipo_id, 'Selecione o tipo de reconhecimento.') }
}

export function parseMotivo(body: unknown, mensagem: string): string {
    const motivo = texto(objeto(body).motivo, 500, 'Motivo').trim()
    if (motivo.length < 3) throw new ErroDeRequisicao(mensagem)
    return motivo
}

// ------------------------------------------------------------------ tipos e núcleos

export function parseNovoTipo(body: unknown) {
    const b = objeto(body)
    const nome = texto(b.nome, 120, 'Nome do tipo').trim()
    if (!nome) throw new ErroDeRequisicao('Informe o nome do tipo.')
    // Tipos novos são sempre de colaborador (os 3 escopos existem nos tipos iniciais).
    return { nome, escopo: 'colaborador' as const, usa_periodo: b.usa_periodo === true }
}

export function parseAtualizacaoTipo(body: unknown) {
    const b = objeto(body)
    const out: { nome?: string; ativo?: boolean; usa_periodo?: boolean } = {}
    if (b.nome !== undefined) {
        out.nome = texto(b.nome, 120, 'Nome do tipo').trim()
        if (!out.nome) throw new ErroDeRequisicao('Informe o nome do tipo.')
    }
    if (b.ativo !== undefined) out.ativo = b.ativo === true
    if (b.usa_periodo !== undefined) out.usa_periodo = b.usa_periodo === true
    if (Object.keys(out).length === 0) throw new ErroDeRequisicao('Nada para atualizar.')
    return out
}

export function parseNucleo(body: unknown): { nucleo: string; elegivel: boolean } {
    const b = objeto(body)
    const nucleo = typeof b.nucleo === 'string' ? b.nucleo : ''
    if (!(NUCLEOS as readonly string[]).includes(nucleo)) throw new ErroDeRequisicao('Núcleo inválido.')
    if (typeof b.elegivel !== 'boolean') throw new ErroDeRequisicao('Informe se o núcleo é elegível.')
    return { nucleo, elegivel: b.elegivel }
}

// ------------------------------------------------------------------------- regras

export interface EntradaRegra {
    nome: string
    tipo_id: string
    gatilho: 'cada_reconhecimento' | 'marcos_de_rg'
    a_partir_de: number | null
    repetir_a_cada: number | null
    tipo_premiacao: 'financeira' | 'item' | 'simbolica'
    valor: number | null
    descricao_premiacao: string
    prazo_dias: number | null
    ativo: boolean
}

export function parseRegra(body: unknown): EntradaRegra {
    const b = objeto(body)
    const nome = texto(b.nome, 200, 'Nome da regra').trim()
    if (!nome) throw new ErroDeRequisicao('Informe o nome da regra.')
    const tipo_id = exigirUuid(b.tipo_id, 'Selecione o tipo de reconhecimento.')
    const gatilho = String(b.gatilho ?? '')
    if (!GATILHOS.some(g => g.value === gatilho)) throw new ErroDeRequisicao('Selecione quando a bonificação é gerada.')
    const tipo_premiacao = String(b.tipo_premiacao ?? '')
    if (!PREMIACOES.some(p => p.value === tipo_premiacao)) throw new ErroDeRequisicao('Selecione o tipo de premiação.')
    let valor: number | null = null
    if (!vazio(b.valor)) {
        valor = Number(b.valor)
        if (!Number.isFinite(valor) || valor < 0 || valor > 1_000_000) throw new ErroDeRequisicao('Valor inválido.')
    }
    const marcos = gatilho === 'marcos_de_rg'
    const a_partir_de = marcos ? inteiroOpcional(b.a_partir_de, 1, 9999, 'Quantidade necessária') : null
    if (marcos && a_partir_de === null) throw new ErroDeRequisicao('Informe a partir de qual RG a bonificação é gerada.')
    return {
        nome, tipo_id,
        gatilho: gatilho as EntradaRegra['gatilho'],
        a_partir_de,
        repetir_a_cada: marcos ? inteiroOpcional(b.repetir_a_cada, 1, 9999, 'Repetir a cada') : null,
        tipo_premiacao: tipo_premiacao as EntradaRegra['tipo_premiacao'],
        valor,
        descricao_premiacao: texto(b.descricao_premiacao, 200, 'Descrição da premiação').trim(),
        prazo_dias: inteiroOpcional(b.prazo_dias, 1, 3650, 'Prazo'),
        ativo: b.ativo === undefined ? true : b.ativo === true,
    }
}

// ---------------------------------------------------------------------- entregas

export interface EntradaEntregas {
    colaborador_ids: string[]
    situacao: 'solicitada' | 'aprovada' | 'entregue'
    solicitada_em: string | null
    aprovada_em: string | null
    entregue_em: string | null
    observacao: string | null
}

function situacao(v: unknown): 'solicitada' | 'aprovada' | 'entregue' {
    const s = typeof v === 'string' ? v : 'solicitada'
    if (!(SITUACOES_ENTREGA as readonly string[]).includes(s)) throw new ErroDeRequisicao('Situação inválida.')
    return s as 'solicitada' | 'aprovada' | 'entregue'
}

export function parseNovasEntregas(body: unknown): EntradaEntregas {
    const b = objeto(body)
    const brutos = Array.isArray(b.colaborador_ids) ? b.colaborador_ids : []
    if (brutos.length === 0) throw new ErroDeRequisicao('Selecione ao menos um colaborador.')
    if (brutos.length > 50) throw new ErroDeRequisicao('Selecione no máximo 50 colaboradores por vez.')
    const ids = [...new Set(brutos.map(id => exigirUuid(id, 'Colaborador inválido.')))]
    return {
        colaborador_ids: ids,
        situacao: situacao(b.situacao),
        solicitada_em: dataOpcional(b.solicitada_em, 'Data da solicitação'),
        aprovada_em: dataOpcional(b.aprovada_em, 'Data de aprovação'),
        entregue_em: dataOpcional(b.entregue_em, 'Data da entrega'),
        observacao: texto(b.observacao, 1000, 'Observação').trim() || null,
    }
}

export function parseAtualizacaoEntrega(body: unknown): Omit<EntradaEntregas, 'colaborador_ids'> {
    const b = objeto(body)
    return {
        situacao: situacao(b.situacao),
        solicitada_em: dataOpcional(b.solicitada_em, 'Data da solicitação'),
        aprovada_em: dataOpcional(b.aprovada_em, 'Data de aprovação'),
        entregue_em: dataOpcional(b.entregue_em, 'Data da entrega'),
        observacao: texto(b.observacao, 1000, 'Observação').trim() || null,
    }
}
