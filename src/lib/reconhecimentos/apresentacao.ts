// Textos da interface: como mostrar eventos do histórico, premiações e sujeitos. PURO (testável).
import { formatarData, formatarMoeda } from './datas'
import { SITUACAO_LABEL, STATUS_LABEL } from './constantes'
import type { Bonificacao, Entrega, EventoHistorico, Reconhecimento, TipoReconhecimento } from './tipos'

type Alteracoes = Record<string, { de?: unknown; para?: unknown } | unknown>

export const sujeitoDe = (x: { projeto_nome?: string | null; colaborador_nome?: string | null; nucleo?: string | null }) =>
    x.projeto_nome || x.colaborador_nome || x.nucleo || 'Sem identificação'

export function textoPremiacao(b: Pick<Bonificacao, 'descricao_premiacao' | 'valor' | 'tipo_premiacao'>): string {
    if (b.descricao_premiacao) return b.descricao_premiacao
    if (b.valor !== null && b.valor !== undefined && b.valor !== '') return formatarMoeda(Number(b.valor))
    return b.tipo_premiacao === 'simbolica' ? 'Reconhecimento simbólico' : 'Premiação a definir'
}

const CAMPOS: Record<string, string> = {
    data_reconhecimento: 'Data', projeto_id: 'Projeto', projeto_nome: 'Projeto', colaborador_id: 'Colaborador', colaborador_nome: 'Colaborador',
    nucleo: 'Núcleo', numero_rg: 'Nº da RG', periodo_referencia: 'Período de referência', observacoes: 'Observações',
    tipo_id: 'Tipo', excluido_em: 'Excluído em', excluido_por: 'Excluído por', excluido_motivo: 'Motivo da exclusão',
    status: 'Status', concluida_em: 'Concluída em', concluida_por: 'Concluída por', cancelada_em: 'Cancelada em', cancelada_por: 'Cancelada por',
    justificativa_cancelamento: 'Justificativa', origem_alterada: 'Origem alterada', situacao: 'Situação',
    solicitada_em: 'Data da solicitação', aprovada_em: 'Data de aprovação', aprovada_por: 'Aprovada por', entregue_em: 'Data da entrega',
    entregue_por: 'Entregue por', observacao: 'Observação', nome: 'Nome', ativo: 'Ativo', usa_periodo: 'Usa período', elegivel: 'Elegível',
    gatilho: 'Gatilho', a_partir_de: 'A partir de', repetir_a_cada: 'Repetir a cada', tipo_premiacao: 'Tipo de premiação', valor: 'Valor',
    descricao_premiacao: 'Descrição da premiação', prazo_dias: 'Prazo (dias)', ordem: 'Ordem', vigente_desde: 'Vigente desde',
}
// Campos que só repetem outro já exibido (ids, nomes duplicados) ou são internos.
const OCULTOS = new Set(['projeto_id', 'colaborador_id', 'tipo_id', 'bonificacao_id', 'reconhecimento_id', 'regra_id', 'id', 'chave_unica',
    'criado_por_id', 'criado_por_email', 'criado_em', 'excluido_em', 'concluida_em', 'cancelada_em', 'vigente_desde', 'criado_por'])

const ISO_DATA = /^\d{4}-\d{2}-\d{2}$/

export function formatarValorCampo(campo: string, valor: unknown): string {
    if (valor === null || valor === undefined || valor === '') return '—'
    if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não'
    if (campo === 'status') return STATUS_LABEL[String(valor)] ?? String(valor)
    if (campo === 'situacao') return SITUACAO_LABEL[String(valor)] ?? String(valor)
    if (campo === 'periodo_referencia' && typeof valor === 'string' && ISO_DATA.test(valor)) return `${valor.slice(5, 7)}/${valor.slice(0, 4)}`
    if (campo === 'valor') return formatarMoeda(Number(valor))
    if (typeof valor === 'string' && ISO_DATA.test(valor)) return formatarData(valor)
    return String(valor)
}

const ehAlteracao = (v: unknown): v is { de?: unknown; para?: unknown } => !!v && typeof v === 'object' && ('de' in (v as object) || 'para' in (v as object))

/** Linhas "Campo: de → para" de um evento de edição. */
export function linhasDeAlteracao(alteracoes: Alteracoes | null | undefined): string[] {
    if (!alteracoes) return []
    const linhas: string[] = []
    for (const [campo, v] of Object.entries(alteracoes)) {
        if (OCULTOS.has(campo) || !ehAlteracao(v)) continue
        linhas.push(`${CAMPOS[campo] ?? campo}: ${formatarValorCampo(campo, v.de)} → ${formatarValorCampo(campo, v.para)}`)
    }
    return linhas
}

export interface ContextoEvento {
    tipos: TipoReconhecimento[]
    bonificacoes: Bonificacao[]
    reconhecimentos?: Reconhecimento[]
    entregas?: Entrega[]
}

export interface EventoDescrito {
    titulo: string
    detalhes: string[]
    categoria: 'reconhecimento' | 'bonificacao' | 'entrega' | 'configuracao'
}

const snapshot = (a: EventoHistorico['alteracoes'], campo: string) => (a && typeof a === 'object' ? (a as Record<string, unknown>)[campo] : undefined)

/** Texto humano de um evento do histórico (o banco guarda ação + de→para; aqui vira frase). */
export function descreverEvento(e: EventoHistorico, ctx: ContextoEvento): EventoDescrito {
    const a = e.alteracoes
    switch (e.acao) {
        case 'criado': {
            const tipo = ctx.tipos.find(t => t.id === snapshot(a, 'tipo_id'))?.nome ?? 'Reconhecimento'
            const alvo = sujeitoDe({ projeto_nome: snapshot(a, 'projeto_nome') as string, colaborador_nome: snapshot(a, 'colaborador_nome') as string, nucleo: snapshot(a, 'nucleo') as string })
            const rg = snapshot(a, 'numero_rg')
            return { categoria: 'reconhecimento', titulo: `Reconhecimento registrado — ${tipo} · ${alvo}${rg ? ` · ${rg}ª RG` : ''}`, detalhes: [] }
        }
        case 'editado': return { categoria: 'reconhecimento', titulo: 'Reconhecimento editado', detalhes: linhasDeAlteracao(a) }
        case 'excluido': return { categoria: 'reconhecimento', titulo: 'Reconhecimento excluído', detalhes: [`Motivo: ${formatarValorCampo('motivo', (snapshot(a, 'excluido_motivo') as { para?: unknown })?.para)}`] }
        case 'gerada': {
            const motivo = snapshot(a, 'motivo') as string | undefined
            const alvo = sujeitoDe({ projeto_nome: snapshot(a, 'projeto_nome') as string, colaborador_nome: snapshot(a, 'colaborador_nome') as string, nucleo: snapshot(a, 'nucleo') as string })
            const premio = textoPremiacao({ descricao_premiacao: (snapshot(a, 'descricao_premiacao') as string) ?? '', valor: snapshot(a, 'valor') as number | null, tipo_premiacao: (snapshot(a, 'tipo_premiacao') as 'financeira') ?? 'financeira' })
            return { categoria: 'bonificacao', titulo: `Bonificação gerada — ${alvo}`, detalhes: [motivo ? `Motivo: ${motivo}` : '', `Premiação: ${premio}`].filter(Boolean) }
        }
        case 'origem_alterada': return { categoria: 'bonificacao', titulo: 'Reconhecimento de origem alterado', detalhes: ['A bonificação foi mantida; confira o histórico do reconhecimento.'] }
        case 'entrega_adicionada': {
            const sit = snapshot(a, 'situacao') as string
            return { categoria: 'entrega', titulo: `${e.detalhe ?? 'Colaborador'} adicionado(a) à bonificação`, detalhes: [`Situação: ${SITUACAO_LABEL[sit] ?? sit}`] }
        }
        case 'entrega_editada': return { categoria: 'entrega', titulo: `Entrega de ${e.detalhe ?? 'colaborador'} editada`, detalhes: linhasDeAlteracao(a) }
        case 'regra_criada': return { categoria: 'configuracao', titulo: `Regra criada — ${e.detalhe ?? ''}`, detalhes: [] }
        case 'regra_editada': return { categoria: 'configuracao', titulo: `Regra editada — ${e.detalhe ?? ''}`, detalhes: linhasDeAlteracao(a) }
        case 'tipo_criado': return { categoria: 'configuracao', titulo: `Tipo criado — ${e.detalhe ?? ''}`, detalhes: [] }
        case 'tipo_editado': return { categoria: 'configuracao', titulo: `Tipo editado — ${e.detalhe ?? ''}`, detalhes: linhasDeAlteracao(a) }
        case 'nucleo_configurado': return { categoria: 'configuracao', titulo: `Núcleo ${e.detalhe ?? ''} configurado`, detalhes: linhasDeAlteracao(a) }
        default: break
    }
    if (e.acao.startsWith('situacao_')) {
        const de = (snapshot(a, 'situacao') as { de?: string })?.de
        const para = e.acao.slice('situacao_'.length)
        return { categoria: 'entrega', titulo: `${e.detalhe ?? 'Colaborador'}: ${de ? `${SITUACAO_LABEL[de] ?? de} → ` : ''}${SITUACAO_LABEL[para] ?? para}`, detalhes: linhasDeAlteracao(a).filter(l => !l.startsWith('Situação')) }
    }
    if (e.acao.startsWith('status_')) {
        const para = e.acao.slice('status_'.length)
        const detalhes = para === 'cancelada' ? [`Justificativa: ${formatarValorCampo('justificativa', (snapshot(a, 'justificativa_cancelamento') as { para?: unknown })?.para)}`] : []
        return { categoria: 'bonificacao', titulo: `Bonificação ${STATUS_LABEL[para]?.toLowerCase() ?? para}`, detalhes }
    }
    return { categoria: 'bonificacao', titulo: e.acao.replace(/_/g, ' '), detalhes: linhasDeAlteracao(a) }
}
