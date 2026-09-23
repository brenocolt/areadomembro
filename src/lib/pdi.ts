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

// Resolve o papel de liderança de um colaborador direto do cargo_atual/
// nucleo_atual dele — sem passar por uma tabela de mapeamento mantida à
// parte (o antigo `pdi_cargos`, removido: ficava desatualizado sempre que
// alguém trocava de núcleo, ou quando a grafia do núcleo divergia entre a
// tabela e o cadastro real). Estratégico sempre resolve para "diretor";
// Tático resolve para o próprio texto do núcleo (mesmo valor que já existe
// em colaboradores.nucleo_atual — ver construirPapeisPorNucleo). Retorna
// null se a pessoa não tem papel de liderança nenhum (ex.: cargo
// Operacional).
export function resolverPapelId(
    cargoAtual: string | null | undefined,
    nucleoAtual: string | null | undefined
): string | null {
    if (cargoAtual === 'Estratégico') return 'diretor'
    if (cargoAtual === 'Tático' && nucleoAtual) return nucleoAtual
    return null
}

// Monta a lista de papéis selecionáveis no passo 1 do wizard: "Diretor" +
// um item por núcleo que tenha hoje pelo menos um Tático ativo (a lista de
// núcleos vem de quem realmente ocupa esse cargo agora, não de um
// catálogo fixo — por isso não fica desatualizada quando alguém muda de
// núcleo ou de cargo).
export function construirPapeisPorNucleo(nucleosDeTaticosAtivos: (string | null)[]): PdiPapel[] {
    const unicos = Array.from(new Set(nucleosDeTaticosAtivos.filter((n): n is string => !!n)))
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    return [
        { id: 'diretor', nome: 'Diretor', ordem: 0 },
        ...unicos.map((nucleo, i) => ({ id: nucleo, nome: nucleo, ordem: i + 1 })),
    ]
}

// Horários de 09:00 a 17:30 em blocos de 30 min, exceto 12:00–13:00 (§3).
// Quando `dataStr` é o dia de hoje, horários já passados ficam de fora —
// usado pela sugestão de horário do líder, que agora pode ser no mesmo dia.
export function gerarHorariosDisponiveis(dataStr?: string): string[] {
    const horarios: string[] = []
    const agora = new Date()
    const ehHoje = !!dataStr && dataStr === dataParaChave(agora)
    for (let h = 9; h <= 17; h++) {
        for (const m of [0, 30]) {
            if (h >= 12 && h < 13) continue
            if (ehHoje && (h < agora.getHours() || (h === agora.getHours() && m <= agora.getMinutes()))) continue
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

// Dia útil, até 60 dias. Por padrão só a partir de amanhã (§3, solicitação
// original) — `permitirHoje` libera o dia de hoje também, usado pela
// sugestão de horário do líder.
export function isDataValida(dataStr: string, permitirHoje: boolean = false): boolean {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    const minimo = new Date(hoje)
    if (!permitirHoje) minimo.setDate(minimo.getDate() + 1)
    const limite = new Date(hoje)
    limite.setDate(limite.getDate() + 60)

    const data = new Date(dataStr + 'T00:00:00')
    if (isNaN(data.getTime())) return false
    if (data < minimo || data > limite) return false
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
