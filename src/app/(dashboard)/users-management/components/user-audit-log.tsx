"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Clock, User, ArrowRight } from "lucide-react"

interface AuditLog {
    id: string
    colaborador_id: string
    campo: string
    valor_antigo: string | null
    valor_novo: string | null
    editado_por: string | null
    created_at: string
}

const FIELD_LABELS: Record<string, string> = {
    nome: "Nome",
    cargo_atual: "Cargo",
    nucleo_atual: "Núcleo",
    matricula: "Matrícula",
    email_corporativo: "Email",
    telefone: "Telefone",
    pontos_negativos: "Pontos Negativos",
    saldo_pipj: "Saldo PIPJ",
    milhas: "Milhas",
    role: "Permissão",
    paginas_permitidas: "Páginas Permitidas",
}

export function UserAuditLog({ colaboradorId }: { colaboradorId: string }) {
    const [logs, setLogs] = useState<AuditLog[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        if (!colaboradorId) return
        async function fetchLogs() {
            setLoading(true)
            const { data } = await supabase
                .from('audit_logs')
                .select('*')
                .eq('colaborador_id', colaboradorId)
                .order('created_at', { ascending: false })
                .limit(50)

            setLogs((data as AuditLog[]) || [])
            setLoading(false)
        }
        fetchLogs()
    }, [colaboradorId])

    if (loading) {
        return (
            <div className="space-y-2">
                {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-slate-100 dark:bg-white/5 rounded-xl animate-pulse" />
                ))}
            </div>
        )
    }

    if (logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400">
                <Clock className="h-8 w-8 opacity-20 mb-2" />
                <p className="text-sm font-medium">Nenhuma alteração registrada</p>
            </div>
        )
    }

    return (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
            {logs.map(log => {
                const date = new Date(log.created_at)
                const dateStr = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
                const timeStr = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                const fieldLabel = FIELD_LABELS[log.campo] || log.campo

                return (
                    <div key={log.id} className="p-3 bg-slate-50 dark:bg-white/[0.03] rounded-xl border border-slate-100 dark:border-slate-800/50 text-xs">
                        <div className="flex items-center justify-between mb-1.5">
                            <span className="font-bold text-slate-700 dark:text-slate-300">{fieldLabel}</span>
                            <span className="text-[10px] text-slate-400 font-mono">{dateStr} {timeStr}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
                            <span className="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2 py-0.5 rounded font-medium truncate max-w-[120px]" title={log.valor_antigo || '—'}>
                                {log.valor_antigo || '—'}
                            </span>
                            <ArrowRight className="h-3 w-3 shrink-0 text-slate-300" />
                            <span className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded font-medium truncate max-w-[120px]" title={log.valor_novo || '—'}>
                                {log.valor_novo || '—'}
                            </span>
                        </div>
                        {log.editado_por && (
                            <div className="flex items-center gap-1 mt-1.5 text-[10px] text-slate-400">
                                <User className="h-3 w-3" />
                                <span>por {log.editado_por}</span>
                            </div>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
