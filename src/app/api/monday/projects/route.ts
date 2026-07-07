import { NextResponse } from 'next/server'
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

export async function GET() {
    try {
        if (!MONDAY_API_TOKEN || !MONDAY_BOARD_ID) {
            return NextResponse.json({ error: 'Monday API not configured' }, { status: 500 })
        }

        let items: any[]
        try {
            items = await fetchAllMondayItems()
        } catch (err: any) {
            return NextResponse.json({ error: err.message }, { status: 500 })
        }

        if (items.length === 0) {
            return NextResponse.json({ synced: 0, message: 'No items found on Monday board' })
        }

        // Connect to Supabase with anon key
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

        // Get existing projects
        const { data: existingProjects } = await supabase.from('projetos').select('id, nome')
        const existingNames = new Set((existingProjects || []).map(p => p.nome?.toLowerCase().trim()))

        let synced = 0
        let added = 0

        for (const item of items) {
            const nome = item.name?.trim()
            if (!nome) continue

            // Get status from Monday column
            const statusCol = item.column_values?.find((c: any) => c.id === 'status')
            const statusText = statusCol?.text?.trim() || ''

            // Map Monday status to our status
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

            // Only insert if the project doesn't exist yet
            if (!existingNames.has(nome.toLowerCase().trim())) {
                const { error } = await supabase
                    .from('projetos')
                    .insert({ nome, status })

                if (!error) {
                    added++
                    existingNames.add(nome.toLowerCase().trim())
                }
            } else {
                // Update status of existing project
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

        return NextResponse.json({ synced, added, total: items.length })
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
