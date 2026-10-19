// Validação e normalização dos corpos de requisição da aba. Pura (sem I/O).
// As mensagens reproduzem as da interface original.
import { ErroDeRequisicao } from './erros'
import { dataISOValida } from './datas'
import {
    CRITERIOS, JUSTIFICATIVAS_CANCELAMENTO, NUCLEOS_IMPACTO, PREMIACOES,
} from './constantes'

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const MAX_RGS_ANTERIORES = 500

function objeto(body: unknown): Record<string, unknown> {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw new ErroDeRequisicao('Corpo da requisição inválido.')
    }
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

function inteiro(valor: unknown, padrao: number, minimo: number, campo: string): number {
    const n = Number(valor) || padrao
    if (!Number.isInteger(n) || n < minimo) throw new ErroDeRequisicao(`${campo} inválido.`)
    return n
}

export interface EntradaRegistro {
    tipo_id: string
    data: string
    projeto_id: string | null
    pessoa_nome: string
    nucleo: string
    adiantado: boolean
    rgs_anteriores: number
    observacao: string | null
}

export function parseRegistro(body: unknown): EntradaRegistro {
    const b = objeto(body)
    const tipo_id = exigirUuid(b.tipo_id, 'Selecione o tipo de reconhecimento')
    if (!dataISOValida(b.data)) throw new ErroDeRequisicao('Informe uma data válida')
    const projeto = b.projeto_id === undefined || b.projeto_id === null || b.projeto_id === ''
        ? null
        : exigirUuid(b.projeto_id, 'Selecione o projeto')
    const rgs = Math.max(0, Math.floor(Number(b.rgs_anteriores) || 0))
    if (rgs > MAX_RGS_ANTERIORES) throw new ErroDeRequisicao(`Quantidade de RGs anteriores inválida (máx. ${MAX_RGS_ANTERIORES}).`)
    return {
        tipo_id,
        data: b.data,
        projeto_id: projeto,
        pessoa_nome: texto(b.pessoa_nome, 200, 'Nome da pessoa').trim(),
        nucleo: texto(b.nucleo, 60, 'Núcleo'),
        adiantado: b.adiantado === true,
        rgs_anteriores: rgs,
        observacao: texto(b.observacao, 2000, 'Observação') || null,
    }
}

export function validarNucleo(nucleo: string): string {
    if (!nucleo) throw new ErroDeRequisicao('Selecione o núcleo')
    if (!(NUCLEOS_IMPACTO as readonly string[]).includes(nucleo)) throw new ErroDeRequisicao('Núcleo inválido')
    return nucleo
}

export function parseAjuste(body: unknown): { projeto_id: string; quantidade: number } {
    const b = objeto(body)
    const projeto_id = exigirUuid(b.projeto_id, 'Selecione o projeto')
    const quantidade = Math.max(0, Math.floor(Number(b.quantidade) || 0))
    if (quantidade > 10000) throw new ErroDeRequisicao('Quantidade inválida.')
    return { projeto_id, quantidade }
}

export interface EntradaRegra {
    nome: string
    tipo_id: string
    criterio: string
    quantidade_necessaria: number
    ciclo: number
    requer_rg_adiantada: boolean
    requer_projeto_adiantado: false
    tipo_premiacao: string
    valor: number
    descricao_premiacao: string
    prazo_dias: number | null
    ativo: boolean
}

export function parseRegra(body: unknown): EntradaRegra {
    const b = objeto(body)
    const nome = texto(b.nome, 200, 'Nome da regra').trim()
    if (!nome) throw new ErroDeRequisicao('Informe o nome da regra')
    const tipo_id = exigirUuid(b.tipo_id, 'Selecione o tipo de reconhecimento')
    const criterio = String(b.criterio ?? '')
    if (!CRITERIOS.some(c => c.value === criterio)) throw new ErroDeRequisicao('Critério inválido.')
    const tipo_premiacao = String(b.tipo_premiacao ?? '')
    if (!PREMIACOES.some(p => p.value === tipo_premiacao)) throw new ErroDeRequisicao('Tipo de premiação inválido.')
    const valor = Number(b.valor) || 0
    if (!Number.isFinite(valor) || valor < 0 || valor > 1_000_000) throw new ErroDeRequisicao('Valor inválido.')
    let prazo: number | null = null
    if (b.prazo_dias !== undefined && b.prazo_dias !== null && b.prazo_dias !== '') {
        prazo = Number(b.prazo_dias)
        if (!Number.isInteger(prazo) || prazo < 0 || prazo > 3650) throw new ErroDeRequisicao('Prazo inválido.')
    }
    return {
        nome,
        tipo_id,
        criterio,
        quantidade_necessaria: inteiro(b.quantidade_necessaria, 1, 1, 'Quantidade necessária'),
        ciclo: inteiro(b.ciclo, 0, 0, 'Ciclo'),
        // A UI grava o switch "Depende de reconhecimento adiantado" aqui; a coluna legada fica sempre false.
        requer_rg_adiantada: !!(b.requer_rg_adiantada || b.requer_projeto_adiantado),
        requer_projeto_adiantado: false,
        tipo_premiacao,
        valor,
        descricao_premiacao: texto(b.descricao_premiacao, 200, 'Descrição da premiação'),
        prazo_dias: prazo,
        ativo: b.ativo === undefined ? true : !!b.ativo,
    }
}

export function parseTipo(body: unknown): { nome: string } {
    const b = objeto(body)
    const nome = texto(b.nome, 120, 'Nome do tipo').trim()
    if (!nome) throw new ErroDeRequisicao('Informe o nome do tipo')
    return { nome }
}

export function parsePrazoPadrao(body: unknown): { prazo_padrao_dias: number | null } {
    const b = objeto(body)
    const v = b.prazo_padrao_dias
    if (v === undefined || v === null || v === '') return { prazo_padrao_dias: null }
    const n = Number(v)
    if (!Number.isInteger(n) || n < 0 || n > 3650) throw new ErroDeRequisicao('Prazo padrão inválido.')
    return { prazo_padrao_dias: n }
}

export function parseEntrega(body: unknown): { entregue_para: string | null; observacao: string | null } {
    const b = objeto(body)
    const bruto = b.nomes === undefined || b.nomes === null ? [] : b.nomes
    if (!Array.isArray(bruto) || bruto.length > 50) throw new ErroDeRequisicao('Lista de nomes inválida.')
    const nomes: string[] = []
    for (const item of bruto) {
        const n = texto(item, 120, 'Nome').trim()
        if (n && !nomes.some(x => x.toLowerCase() === n.toLowerCase())) nomes.push(n)
    }
    return {
        entregue_para: nomes.length > 0 ? nomes.join('; ') : null,
        observacao: texto(b.observacao, 1000, 'Observação') || null,
    }
}

export function parseCancelamento(body: unknown): { justificativa: string } {
    const b = objeto(body)
    const motivo = typeof b.motivo === 'string' ? b.motivo : ''
    if (!(JUSTIFICATIVAS_CANCELAMENTO as readonly string[]).includes(motivo)) {
        throw new ErroDeRequisicao('Selecione a justificativa')
    }
    const detalhe = texto(b.detalhe, 1000, 'Detalhes').trim()
    if (motivo === 'Outro' && !detalhe) throw new ErroDeRequisicao('Descreva a justificativa')
    return { justificativa: motivo === 'Outro' ? detalhe : `${motivo}${detalhe ? ` — ${detalhe}` : ''}` }
}
