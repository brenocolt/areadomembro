"use client"

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { supabase } from '@/lib/supabase'

export function useColaborador() {
    const { data: session, status } = useSession()
    const colaboradorId = (session?.user as any)?.colaborador_id as string | undefined
    const [colaborador, setColaborador] = useState<any>(null)
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (status === 'loading') return
        if (!colaboradorId) {
            setLoading(false)
            return
        }

        async function fetch() {
            const { data } = await supabase
                .from('colaboradores')
                .select('*')
                .eq('id', colaboradorId!)
                .single()
            setColaborador(data)
            setLoading(false)
        }
        fetch()
    }, [colaboradorId, status])

    const role = (session?.user as any)?.role as string | undefined
    return { colaborador, loading: loading || status === 'loading', colaboradorId: colaboradorId || '', role }
}

export function useSupabaseQuery<T>(
    tableName: string,
    options?: {
        column?: string
        value?: string
        orderBy?: string
        ascending?: boolean
        limit?: number
        select?: string
    }
) {
    const [data, setData] = useState<T[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetch() {
            let query = supabase
                .from(tableName)
                .select(options?.select || '*')

            if (options?.column && options?.value) {
                query = query.eq(options.column, options.value)
            }
            if (options?.orderBy) {
                query = query.order(options.orderBy, { ascending: options?.ascending ?? false })
            }
            if (options?.limit) {
                query = query.limit(options.limit)
            }

            const { data: result } = await query
            setData((result as T[]) || [])
            setLoading(false)
        }
        fetch()
    }, [tableName, options?.column, options?.value])

    return { data, loading }
}
