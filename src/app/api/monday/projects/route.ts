import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN || ''
const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

export async function GET() {
    try {
        if (!MONDAY_API_TOKEN || !MONDAY_BOARD_ID) {
            return NextResponse.json({ error: 'Monday API not configured' }, { status: 500 })
        }

        // Query Monday GraphQL API to get all items
        const query = `{
            boards(ids: [${MONDAY_BOARD_ID}]) {
                items_page(limit: 500) {
                    items {
                        id
                        name
                        column_values {
                            id
                            text
                        }
                    }
                }
            }
        }`

        const res = await fetch('https://api.monday.com/v2', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': MONDAY_API_TOKEN,
                'API-Version': '2024-10',
            },
            body: JSON.stringify({ query }),
        })

        if (!res.ok) {
            const errText = await res.text()
            return NextResponse.json({ error: 'Monday API error', details: errText }, { status: res.status })
        }

        const json = await res.json()

        if (json.errors) {
            return NextResponse.json({ error: 'Monday GraphQL errors', details: json.errors }, { status: 400 })
        }

        const items = json?.data?.boards?.[0]?.items_page?.items || []

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
