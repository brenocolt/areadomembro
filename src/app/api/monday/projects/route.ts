import { NextResponse } from 'next/server'
import { syncMondayProjects } from '@/lib/monday-sync'

// A sincronização automática roda no processo do servidor (ver
// src/instrumentation.ts) — este endpoint continua existindo apenas para
// disparar uma sincronização manual sob demanda (ex.: testar a integração).
export async function GET() {
    try {
        const result = await syncMondayProjects()
        if ('skipped' in result) {
            return NextResponse.json({ error: result.reason }, { status: 500 })
        }
        return NextResponse.json(result)
    } catch (err: any) {
        return NextResponse.json({ error: err.message }, { status: 500 })
    }
}
