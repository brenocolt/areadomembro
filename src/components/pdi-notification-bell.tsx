"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Bell } from "lucide-react"

interface Notificacao {
    id: string
    texto: string
    lida: boolean
    criado_em: string
    href: string
}

// Sino de notificações internas da Área do Membro. Ainda não existe uma
// tabela genérica de notificações — cada feature grava na sua própria
// (pdi_notificacoes, pontuacao_notificacoes, ...) e este componente busca
// em todas e mescla por data.
export function PdiNotificationBell() {
    const { colaboradorId } = useColaborador()
    const [notificacoes, setNotificacoes] = useState<Notificacao[]>([])
    const [open, setOpen] = useState(false)

    useEffect(() => {
        if (!colaboradorId) return

        async function fetchNotificacoes() {
            const [pdiRes, pontuacaoRes] = await Promise.all([
                supabase.from('pdi_notificacoes').select('*').eq('membro_id', colaboradorId).order('criado_em', { ascending: false }).limit(30),
                supabase.from('pontuacao_notificacoes').select('*').eq('colaborador_id', colaboradorId).order('criado_em', { ascending: false }).limit(30),
            ])

            const pdi: Notificacao[] = (pdiRes.data || []).map((n: any) => ({
                id: n.id,
                texto: n.texto,
                lida: n.lida,
                criado_em: n.criado_em,
                href: n.solicitacao_id ? `/pdi?solicitacao=${n.solicitacao_id}` : '/pdi',
            }))
            const pontuacao: Notificacao[] = (pontuacaoRes.data || []).map((n: any) => ({
                id: n.id,
                texto: n.texto,
                lida: n.lida,
                criado_em: n.criado_em,
                href: '/pontuar-membros',
            }))

            const todas = [...pdi, ...pontuacao].sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime())
            setNotificacoes(todas)
        }
        fetchNotificacoes()

        const channel = supabase
            .channel(`notificacoes_${colaboradorId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pdi_notificacoes', filter: `membro_id=eq.${colaboradorId}` }, fetchNotificacoes)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pontuacao_notificacoes', filter: `colaborador_id=eq.${colaboradorId}` }, fetchNotificacoes)
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [colaboradorId])

    const naoLidas = notificacoes.filter(n => !n.lida)

    async function marcarTodasComoLidas() {
        if (naoLidas.length === 0) return
        setNotificacoes(ns => ns.map(n => ({ ...n, lida: true })))
        await Promise.all([
            supabase.from('pdi_notificacoes').update({ lida: true }).eq('membro_id', colaboradorId).eq('lida', false),
            supabase.from('pontuacao_notificacoes').update({ lida: true }).eq('colaborador_id', colaboradorId).eq('lida', false),
        ])
    }

    if (!colaboradorId) return null

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="ghost" size="icon" className="relative h-9 w-9 rounded-full">
                    <Bell className="h-4 w-4" />
                    {naoLidas.length > 0 && (
                        <Badge className="absolute -top-1 -right-1 h-4 min-w-4 px-1 flex items-center justify-center text-[10px] bg-rose-500 text-white border-none">
                            {naoLidas.length > 9 ? '9+' : naoLidas.length}
                        </Badge>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
                <div className="flex items-center justify-between p-3 border-b border-slate-100 dark:border-slate-800">
                    <span className="text-sm font-bold">Notificações</span>
                    {naoLidas.length > 0 && (
                        <button onClick={marcarTodasComoLidas} className="text-xs text-primary font-semibold hover:underline">
                            Marcar todas como lidas
                        </button>
                    )}
                </div>
                <div className="max-h-80 overflow-y-auto">
                    {notificacoes.length === 0 ? (
                        <p className="text-sm text-slate-400 italic text-center py-6">Nenhuma notificação ainda.</p>
                    ) : (
                        notificacoes.map(n => (
                            <Link
                                key={n.id}
                                href={n.href}
                                onClick={() => setOpen(false)}
                                className={`block px-3 py-2.5 text-sm border-b border-slate-50 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors ${!n.lida ? 'font-semibold' : 'text-slate-500'}`}
                            >
                                <p>{n.texto}</p>
                                <p className="text-[11px] text-slate-400 mt-0.5">{new Date(n.criado_em).toLocaleString('pt-BR')}</p>
                            </Link>
                        ))
                    )}
                </div>
            </PopoverContent>
        </Popover>
    )
}
