// Sincroniza a tabela `projetos` e a alocação de projetos por colaborador
// (colaboradores.projetos) com o board do Monday.com configurado em
// MONDAY_BOARD_ID. Extraído de src/app/api/monday/projects/route.ts para ser
// chamado tanto pela rota (sincronização manual/sob demanda) quanto pelo job
// agendado em src/instrumentation.ts (sincronização automática, já que o app
// roda num VPS como processo persistente — não há Cron Jobs de plataforma
// como no Vercel).
import { createClient } from '@supabase/supabase-js'
import { CARGO_FANTASMA } from './cargos'

const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN || ''
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

async function mondayRequest(query: string, variables?: Record<string, any>): Promise<any> {
    const res: Response = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': MONDAY_API_TOKEN,
            'API-Version': '2024-10',
        },
        body: JSON.stringify(variables ? { query, variables } : { query }),
    })

    if (!res.ok) {
        throw new Error(`Monday API error: ${await res.text()}`)
    }

    const json: any = await res.json()
    if (json.errors) {
        throw new Error(`Monday GraphQL errors: ${JSON.stringify(json.errors)}`)
    }
    return json.data
}

type MondayItemsPage = { cursor?: string | null; items?: any[] }

async function fetchMondayItemsPage(cursor: string | null): Promise<MondayItemsPage> {
    const query: string = cursor
        ? `query($cursor: String!) {
            next_items_page(cursor: $cursor, limit: 500) {
                cursor
                items { id name column_values { id text value } }
            }
        }`
        : `{
            boards(ids: [${MONDAY_BOARD_ID}]) {
                items_page(limit: 500) {
                    cursor
                    items { id name column_values { id text value } }
                }
            }
        }`

    const data = await mondayRequest(query, cursor ? { cursor } : undefined)
    return (cursor ? data?.next_items_page : data?.boards?.[0]?.items_page) || {}
}

// items_page só retorna até 500 itens por página. Boards com mais itens
// precisam ser paginados com o cursor retornado, senão itens além do
// primeiro lote nunca são sincronizados.
async function fetchAllMondayItems(): Promise<any[]> {
    const allItems: any[] = []
    let cursor: string | null = null
    const MAX_PAGES = 50 // trava de segurança (até 25 mil itens)

    for (let page = 0; page < MAX_PAGES; page++) {
        const itemsPage = await fetchMondayItemsPage(cursor)
        allItems.push(...(itemsPage.items || []))

        cursor = itemsPage.cursor || null
        if (!cursor) break
    }

    return allItems
}

async function fetchMondayColumns(): Promise<{ id: string; title: string }[]> {
    const data = await mondayRequest(`{
        boards(ids: [${MONDAY_BOARD_ID}]) {
            columns { id title }
        }
    }`)
    return data?.boards?.[0]?.columns || []
}

// Busca o e-mail de cada pessoa do Monday, em lotes (a API aceita uma lista
// de IDs, mas evitamos mandar milhares de uma vez).
async function fetchMondayUserEmails(userIds: number[]): Promise<Map<number, string>> {
    const emailById = new Map<number, string>()
    const LOTE = 100

    for (let i = 0; i < userIds.length; i += LOTE) {
        const lote = userIds.slice(i, i + LOTE)
        if (lote.length === 0) continue
        const data = await mondayRequest(`{ users(ids: [${lote.join(',')}]) { id email } }`)
        for (const u of data?.users || []) {
            if (u?.id && u?.email) emailById.set(Number(u.id), String(u.email).toLowerCase().trim())
        }
    }

    return emailById
}

// Extrai os IDs de pessoa do valor bruto (JSON) de uma coluna do tipo
// "people"/"person". Formatos possíveis:
// - people (atual): {"personsAndTeams":[{"id":123,"kind":"person"}, ...]}
// - person (legado): {"id":123,"changed_at":"..."}
function extrairPersonIds(rawValue: string | null | undefined): number[] {
    if (!rawValue) return []
    try {
        const parsed = JSON.parse(rawValue)
        if (Array.isArray(parsed?.personsAndTeams)) {
            return parsed.personsAndTeams
                .filter((p: any) => !p.kind || p.kind === 'person')
                .map((p: any) => Number(p.id))
                .filter((id: number) => !isNaN(id))
        }
        if (parsed?.id) {
            const id = Number(parsed.id)
            return isNaN(id) ? [] : [id]
        }
    } catch {
        // valor vazio ou não é JSON (coluna sem ninguém atribuído)
    }
    return []
}

function normalizeMondayStatus(statusText: string): 'Ativo' | 'Concluído' | 'Pausado' {
    const t = (statusText || '').toLowerCase()
    if (t.includes('finalizado') || t.includes('conclu') || t.includes('done')) return 'Concluído'
    if (t.includes('rescindido') || t.includes('cancelado')) return 'Concluído'
    if (t.includes('parado') || t.includes('pausado')) return 'Pausado'
    return 'Ativo'
}

export type SyncResult =
    | { skipped: true; reason: string }
    | { synced: number; added?: number; total?: number; message?: string }

export async function syncMondayProjects(): Promise<SyncResult> {
    if (!MONDAY_API_TOKEN || !MONDAY_BOARD_ID) {
        return { skipped: true, reason: 'Monday API not configured' }
    }

    const items = await fetchAllMondayItems()
    if (items.length === 0) {
        return { synced: 0, message: 'No items found on Monday board' }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    const { data: existingProjects } = await supabase.from('projetos').select('id, nome')
    const existingNames = new Set((existingProjects || []).map(p => p.nome?.toLowerCase().trim()))

    let synced = 0
    let added = 0

    for (const item of items) {
        const nome = item.name?.trim()
        if (!nome) continue

        const statusCol = item.column_values?.find((c: any) => c.id === 'status')
        const statusText = statusCol?.text?.trim() || ''
        const status = normalizeMondayStatus(statusText)

        if (!existingNames.has(nome.toLowerCase().trim())) {
            const { error } = await supabase
                .from('projetos')
                .insert({ nome, status })

            if (!error) {
                added++
                existingNames.add(nome.toLowerCase().trim())
            }
        } else {
            const existing = (existingProjects || []).find(p => p.nome?.toLowerCase().trim() === nome.toLowerCase().trim())
            if (existing) {
                await supabase
                    .from('projetos')
                    .update({ status })
                    .eq('id', existing.id)
            }
        }
        synced++
    }

    return { synced, added, total: items.length }
}

// ─── Alocação de projetos por colaborador (colaboradores.projetos) ─────────
//
// Conta, para cada colaborador, quantos itens do board estão com status
// "Em execução" (normalizado para 'Ativo') e têm esse colaborador em alguma
// coluna de pessoas cujo título contenha "geren" ou "consultor" (ex.:
// "Gerente", "Consultores") — um mesmo projeto conta para todos os
// colaboradores alocados nele. O vínculo Monday → colaborador é feito por
// e-mail corporativo, já que não existe nenhum ID do Monday salvo no
// Supabase.
//
// dryRun (padrão true nas rotas manuais) só calcula e retorna o que mudaria,
// sem gravar nada — usado para validar o resultado antes de aplicar de
// verdade.

export type AlocacaoColaborador = {
    colaborador_id: string
    nome: string
    email: string
    valor_antigo: number
    valor_novo: number
}

export type AlocacaoResult =
    | { skipped: true; reason: string }
    | {
        dryRun: boolean
        totalItensAtivos: number
        colunasConsideradas: { id: string; title: string }[]
        alterados: AlocacaoColaborador[]
        emailsNaoEncontrados: string[]
    }

export async function syncMondayAlocacoes(opts?: { dryRun?: boolean }): Promise<AlocacaoResult> {
    const dryRun = opts?.dryRun !== false

    if (!MONDAY_API_TOKEN || !MONDAY_BOARD_ID) {
        return { skipped: true, reason: 'Monday API not configured' }
    }

    const [columns, items] = await Promise.all([fetchMondayColumns(), fetchAllMondayItems()])

    const colunasPessoas = columns.filter(c => /geren|consultor/i.test(c.title))
    if (colunasPessoas.length === 0) {
        return { skipped: true, reason: 'Nenhuma coluna de "Gerente" ou "Consultores" encontrada no board' }
    }

    // 1ª passada: descobre quais itens estão ativos e quais IDs de pessoa
    // aparecem nas colunas relevantes desses itens.
    const personIdsPorItemAtivo: number[][] = []
    let totalItensAtivos = 0
    const todosPersonIds = new Set<number>()

    for (const item of items) {
        const statusCol = item.column_values?.find((c: any) => c.id === 'status')
        const status = normalizeMondayStatus(statusCol?.text?.trim() || '')
        if (status !== 'Ativo') continue

        totalItensAtivos++
        const personIds: number[] = []
        for (const col of colunasPessoas) {
            const valueCol = item.column_values?.find((c: any) => c.id === col.id)
            for (const id of extrairPersonIds(valueCol?.value)) {
                personIds.push(id)
                todosPersonIds.add(id)
            }
        }
        personIdsPorItemAtivo.push(personIds)
    }

    const emailById = await fetchMondayUserEmails(Array.from(todosPersonIds))

    // 2ª passada: soma, por e-mail, quantos itens ativos cada pessoa aparece.
    const contagemPorEmail = new Map<string, number>()
    for (const personIds of personIdsPorItemAtivo) {
        const emailsUnicos = new Set(personIds.map(id => emailById.get(id)).filter((e): e is string => !!e))
        for (const email of emailsUnicos) {
            contagemPorEmail.set(email, (contagemPorEmail.get(email) || 0) + 1)
        }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    const { data: colaboradores } = await supabase
        .from('colaboradores')
        .select('id, nome, email_corporativo, projetos')
        .eq('status', 'Ativo')
        .neq('cargo_atual', CARGO_FANTASMA)

    const emailsUsados = new Set<string>()
    const alterados: AlocacaoColaborador[] = []

    for (const colab of colaboradores || []) {
        const email = (colab.email_corporativo || '').toLowerCase().trim()
        if (!email) continue

        const valorNovo = contagemPorEmail.get(email) || 0
        if (contagemPorEmail.has(email)) emailsUsados.add(email)

        const valorAntigo = Number(colab.projetos || 0)
        if (valorAntigo === valorNovo) continue

        alterados.push({
            colaborador_id: colab.id,
            nome: colab.nome,
            email,
            valor_antigo: valorAntigo,
            valor_novo: valorNovo,
        })
    }

    const emailsNaoEncontrados = Array.from(contagemPorEmail.keys()).filter(e => !emailsUsados.has(e))

    if (!dryRun) {
        for (const alteracao of alterados) {
            await supabase
                .from('colaboradores')
                .update({ projetos: alteracao.valor_novo })
                .eq('id', alteracao.colaborador_id)

            await supabase.from('audit_logs').insert({
                colaborador_id: alteracao.colaborador_id,
                campo: 'projetos',
                valor_antigo: String(alteracao.valor_antigo),
                valor_novo: String(alteracao.valor_novo),
                editado_por: 'Monday Sync',
            })
        }
    }

    return { dryRun, totalItensAtivos, colunasConsideradas: colunasPessoas, alterados, emailsNaoEncontrados }
}
