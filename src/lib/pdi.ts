// Regras compartilhadas do módulo PDI — Momentos de Desenvolvimento.
// Usado tanto pela UI (wizard, "Meus momentos") quanto pelas rotas de API
// server-side (src/app/api/pdi/**), por isso não importa nada client-only.

export interface PdiPapel {
    id: string
    nome: string
    ordem: number
}

export interface PdiTipoMomento {
    id: string
    nome: string
    descricao: string | null
    sub_label: string
    sub_opcoes: string[]
    ativo: boolean
    ordem: number
}

export interface PdiCargoMapeamento {
    papel_id: string
    cargo_atual: string
    nucleo_atual: string | null
}

export type PdiGrupoPapel = 'Closer' | 'Gerentes' | 'Outros níveis'

// Agrupamento visual do passo 1 do wizard (§3 da especificação): Closer |
// Gerentes (os 6 ger_*) | Outros níveis (Cargo tático, Diretor).
export function grupoDoPapel(papelId: string): PdiGrupoPapel {
    if (papelId === 'closer') return 'Closer'
    if (papelId.startsWith('ger_')) return 'Gerentes'
    return 'Outros níveis'
}

// Resolve o papel de liderança de um colaborador a partir do seu
// cargo_atual/nucleo_atual, usando o mapeamento gravado em `pdi_cargos`.
// Prioriza uma linha exata (mesmo núcleo); sem isso, cai no "catch-all"
// daquele cargo_atual (nucleo_atual null). Retorna null se a pessoa não tem
// papel de liderança nenhum (ex.: cargo Operacional).
export function resolverPapelId(
    cargoAtual: string | null | undefined,
    nucleoAtual: string | null | undefined,
    mapeamentos: PdiCargoMapeamento[]
): string | null {
    if (!cargoAtual) return null
    const nucleo = nucleoAtual || null
    const exato = mapeamentos.find(m => m.cargo_atual === cargoAtual && m.nucleo_atual === nucleo)
    if (exato) return exato.papel_id
    const catchAll = mapeamentos.find(m => m.cargo_atual === cargoAtual && m.nucleo_atual === null)
    return catchAll?.papel_id ?? null
}

// Horários de 09:00 a 17:30 em blocos de 30 min, exceto 12:00–13:00 (§3).
export function gerarHorariosDisponiveis(): string[] {
    const horarios: string[] = []
    for (let h = 9; h <= 17; h++) {
        for (const m of [0, 30]) {
            if (h >= 12 && h < 13) continue
            horarios.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
        }
    }
    return horarios
}

export function isDiaUtil(date: Date): boolean {
    const dia = date.getDay()
    return dia !== 0 && dia !== 6
}

export function dataParaChave(date: Date): string {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

// Dia útil, a partir de amanhã, até 60 dias (§3).
export function isDataValida(dataStr: string): boolean {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const amanha = new Date(hoje)
    amanha.setDate(amanha.getDate() + 1)
    const limite = new Date(hoje)
    limite.setDate(limite.getDate() + 60)

    const data = new Date(dataStr + 'T00:00:00')
    if (isNaN(data.getTime())) return false
    if (data < amanha || data > limite) return false
    return isDiaUtil(data)
}

// Abre a Google Agenda no dia selecionado (ou na visão padrão, sem dia) —
// "Analisar minha agenda" (§3).
export function linkAnalisarAgenda(dataStr?: string): string {
    if (!dataStr) return 'https://calendar.google.com/calendar/r'
    const [ano, mes, dia] = dataStr.split('-')
    return `https://calendar.google.com/calendar/r/day/${ano}/${mes}/${dia}`
}

// Link para adicionar o evento na Google Agenda, 1h de duração (§9).
export function linkAdicionarAgenda(opts: { titulo: string; dataStr: string; horaStr: string; detalhes: string }): string {
    const [ano, mes, dia] = opts.dataStr.split('-').map(Number)
    const [hh, mm] = opts.horaStr.split(':').map(Number)
    const pad = (n: number) => String(n).padStart(2, '0')
    const inicio = `${ano}${pad(mes)}${pad(dia)}T${pad(hh)}${pad(mm)}00`
    const fim = `${ano}${pad(mes)}${pad(dia)}T${pad(hh + 1)}${pad(mm)}00`
    const params = new URLSearchParams({
        action: 'TEMPLATE',
        text: opts.titulo,
        dates: `${inicio}/${fim}`,
        details: opts.detalhes,
    })
    return `https://calendar.google.com/calendar/render?${params.toString()}`
}

// "A, B e C" — usado nos resumos ("Quero um momento com X e Y...").
export function formatarLista(itens: string[]): string {
    const validos = itens.filter(Boolean)
    if (validos.length === 0) return ''
    if (validos.length === 1) return validos[0]
    return `${validos.slice(0, -1).join(', ')} e ${validos[validos.length - 1]}`
}

export function nomesDosPapeis(papeis: PdiPapel[], ids: string[]): string[] {
    return ids.map(id => papeis.find(p => p.id === id)?.nome || id)
}

// "Cronograma (Estratégia, Produção) e Case (Técnico)" (§11).
export function formatarTiposComOpcoes(
    tipos: PdiTipoMomento[],
    selecionados: string[],
    detalhes: Record<string, string[]>,
    outroTexto?: string | null
): string {
    const partes = selecionados.map(tipoId => {
        if (tipoId === 'outro') return outroTexto ? `Outro (${outroTexto})` : 'Outro'
        const tipo = tipos.find(t => t.id === tipoId)
        if (!tipo) return tipoId
        const opcoes = detalhes?.[tipoId] || []
        return opcoes.length > 0 ? `${tipo.nome} (${opcoes.join(', ')})` : tipo.nome
    })
    return formatarLista(partes)
}

export const PDI_STATUS_LABEL: Record<string, string> = {
    aguardando: 'Aguardando aceite',
    agendado: 'Agendado',
    reagendado: 'Reagendado',
    concluido: 'Concluído',
    cancelado: 'Cancelado',
}

export const PDI_STATUS_BADGE_CLASS: Record<string, string> = {
    aguardando: 'bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800',
    agendado: 'bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-800',
    reagendado: 'bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800',
    concluido: 'bg-slate-500/10 text-slate-500 border-slate-200 dark:border-slate-700',
    cancelado: 'bg-rose-500/10 text-rose-500 border-rose-200 dark:border-rose-800',
}

export function formatarDataBr(dataStr: string): string {
    return new Date(dataStr + 'T12:00:00').toLocaleDateString('pt-BR')
}
