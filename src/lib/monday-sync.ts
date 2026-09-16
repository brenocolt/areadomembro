// Sincroniza a tabela `projetos` com o board do Monday.com configurado em
// MONDAY_BOARD_ID. Extraído de src/app/api/monday/projects/route.ts para ser
// chamado tanto pela rota (sincronização manual/sob demanda) quanto pelo job
// agendado em src/instrumentation.ts (sincronização automática, já que o app
// roda num VPS como processo persistente — não há Cron Jobs de plataforma
// como no Vercel).
import { createClient } from '@supabase/supabase-js'

const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN || ''
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

type MondayItemsPage = { cursor?: string | null; items?: any[] }

async function fetchMondayItemsPage(cursor: string | null): Promise<MondayItemsPage> {
    const query: string = cursor
        ? `query($cursor: String!) {
            next_items_page(cursor: $cursor, limit: 500) {
                cursor
                items { id name column_values { id text } }
            }
        }`
        : `{
            boards(ids: [${MONDAY_BOARD_ID}]) {
                items_page(limit: 500) {
                    cursor
                    items { id name column_values { id text } }
                }
            }
        }`

    const res: Response = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': MONDAY_API_TOKEN,
            'API-Version': '2024-10',
        },
        body: JSON.stringify(cursor ? { query, variables: { cursor } } : { query }),
    })

    if (!res.ok) {
        throw new Error(`Monday API error: ${await res.text()}`)
    }

    const json: any = await res.json()
    if (json.errors) {
        throw new Error(`Monday GraphQL errors: ${JSON.stringify(json.errors)}`)
    }

    return (cursor ? json?.data?.next_items_page : json?.data?.boards?.[0]?.items_page) || {}
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

        let status = 'Ativo'
        if (statusText.toLowerCase().includes('finalizado') || statusText.toLowerCase().includes('conclu') || statusText.toLowerCase().includes('done')) {
            status = 'Concluído'
        } else if (statusText.toLowerCase().includes('rescindido') || statusText.toLowerCase().includes('cancelado')) {
            status = 'Concluído'
        } else if (statusText.toLowerCase().includes('parado') || statusText.toLowerCase().includes('pausado')) {
            status = 'Pausado'
        } else if (statusText.toLowerCase().includes('execução') || statusText.toLowerCase().includes('andamento')) {
            status = 'Ativo'
        }

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
