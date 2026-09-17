"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Bell } from "lucide-react"

interface PdiNotificacao {
    id: string
    texto: string
    lida: boolean
    solicitacao_id: string | null
    criado_em: string
}

// Sino de notificações internas do PDI (§10). Não há um sistema genérico de
// notificações no resto da Área do Membro ainda — este componente só lê
// pdi_notificacoes por enquanto.
export function PdiNotificationBell() {
    const { colaboradorId } = useColaborador()
    const [notificacoes, setNotificacoes] = useState<PdiNotificacao[]>([])
    const [open, setOpen] = useState(false)

    useEffect(() => {
        if (!colaboradorId) return

        async function fetchNotificacoes() {
            const { data } = await supabase
                .from('pdi_notificacoes')
                .select('*')
                .eq('membro_id', colaboradorId)
                .order('criado_em', { ascending: false })
                .limit(30)
            setNotificacoes(data || [])
        }
        fetchNotificacoes()

        const channel = supabase
            .channel(`pdi_notificacoes_${colaboradorId}`)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pdi_notificacoes', filter: `membro_id=eq.${colaboradorId}` }, fetchNotificacoes)
            .subscribe()

        return () => { supabase.removeChannel(channel) }
    }, [colaboradorId])

    const naoLidas = notificacoes.filter(n => !n.lida)

    async function marcarTodasComoLidas() {
        if (naoLidas.length === 0) return
        setNotificacoes(ns => ns.map(n => ({ ...n, lida: true })))
        await supabase.from('pdi_notificacoes').update({ lida: true }).eq('membro_id', colaboradorId).eq('lida', false)
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
                                href={n.solicitacao_id ? `/pdi?solicitacao=${n.solicitacao_id}` : '/pdi'}
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
