"use client"

import { useState, useEffect, useCallback } from "react"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Target, Plus, Clock, CheckCircle2, Loader2 } from "lucide-react"
import { toast } from "sonner"
import {
    PdiPapel, PdiTipoMomento,
    formatarDataBr, formatarTiposComOpcoes, formatarLista, nomesDosPapeis,
    linkAdicionarAgenda, PDI_STATUS_LABEL, PDI_STATUS_BADGE_CLASS, resolverPapelId,
    construirPapeisPorNucleo,
} from "@/lib/pdi"
import { WizardSolicitarMomento } from "./components/wizard-solicitar-momento"
import { PainelLider } from "./components/painel-lider"

function SolicitacaoCard({ s, papeis, tipos, onClick }: { s: any, papeis: PdiPapel[], tipos: PdiTipoMomento[], onClick: () => void }) {
    const papeisNomes = nomesDosPapeis(papeis, s.cargos || [])
    const tiposTexto = formatarTiposComOpcoes(tipos, s.tipos || [], s.detalhes || {}, s.outro_texto)
    const aceites = (s.pdi_solicitacao_lideres || []).filter((l: any) => l.lider_id)
    const quemAceitou = aceites.length > 0
        ? aceites.map((a: any) => a.lider?.nome).filter(Boolean).join(', ')
        : `com ${formatarLista(papeisNomes)} — aguardando alguém aceitar`

    return (
        <div
            onClick={onClick}
            className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 shadow-sm cursor-pointer hover:border-primary/40 transition-all"
        >
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="font-bold text-slate-900 dark:text-white truncate">{tiposTexto}</p>
                    <p className="text-sm text-slate-500 mt-0.5">{formatarDataBr(s.data)} às {s.hora}</p>
                    <p className="text-xs text-slate-400 mt-1 truncate">{quemAceitou}</p>
                </div>
                <Badge variant="outline" className={`shrink-0 ${PDI_STATUS_BADGE_CLASS[s.status]}`}>{PDI_STATUS_LABEL[s.status]}</Badge>
            </div>
        </div>
    )
}

export default function PdiPage() {
    const { colaborador, colaboradorId } = useColaborador()
    const [papeis, setPapeis] = useState<PdiPapel[]>([])
    const [tipos, setTipos] = useState<PdiTipoMomento[]>([])
    const [solicitacoes, setSolicitacoes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [view, setView] = useState<'lista' | 'wizard' | 'detalhe'>('lista')
    const [detalheId, setDetalheId] = useState<string | null>(null)
    const [acting, setActing] = useState(false)
    // Se o colaborador é Tático (líder do núcleo dele) ou Estratégico
    // (Diretor), a aba "Para Eu Atender" (painel do líder, §5) aparece.
    const [meuPapelId, setMeuPapelId] = useState<string | null>(null)

    const fetchTudo = useCallback(async () => {
        const [{ data: taticos }, { data: tiposData }, res] = await Promise.all([
            supabase.from('colaboradores').select('nucleo_atual').eq('cargo_atual', 'Tático').eq('status', 'Ativo'),
            supabase.from('pdi_tipos_momento').select('*').eq('ativo', true).order('ordem'),
            fetch('/api/pdi/solicitacoes'),
        ])
        setPapeis(construirPapeisPorNucleo((taticos || []).map(t => t.nucleo_atual)))
        setTipos(tiposData || [])
        setMeuPapelId(resolverPapelId(colaborador?.cargo_atual, colaborador?.nucleo_atual))
        if (res.ok) {
            const json = await res.json()
            setSolicitacoes(json.solicitacoes || [])
        }
        setLoading(false)
    }, [colaborador?.cargo_atual, colaborador?.nucleo_atual])

    useEffect(() => {
        if (colaboradorId) fetchTudo()
    }, [colaboradorId, fetchTudo])

    // Link direto de uma notificação ou do Slack (/pdi?solicitacao=ID) abre
    // o detalhe assim que a lista carregar. Lido via window.location (em vez
    // de useSearchParams) pra não exigir um Suspense boundary aqui.
    useEffect(() => {
        if (typeof window === 'undefined') return
        const idParam = new URLSearchParams(window.location.search).get('solicitacao')
        if (idParam && solicitacoes.some(s => s.id === idParam)) {
            setDetalheId(idParam)
            setView('detalhe')
        }
    }, [solicitacoes])

    function abrirDetalhe(id: string) {
        setDetalheId(id)
        setView('detalhe')
    }

    async function handleAction(action: string) {
        if (!detalheId) return
        setActing(true)
        try {
            const res = await fetch(`/api/pdi/solicitacoes/${detalheId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            })
            const json = await res.json()
            if (!res.ok) {
                toast.error(json.error || 'Erro ao atualizar solicitação.')
                return
            }
            toast.success('Feito!')
            await fetchTudo()
        } finally {
            setActing(false)
        }
    }

    if (view === 'wizard') {
        return (
            <WizardSolicitarMomento
                papeis={papeis}
                tipos={tipos}
                onCancel={() => setView('lista')}
                onCriado={async () => { await fetchTudo(); setView('lista') }}
            />
        )
    }

    const detalhe = solicitacoes.find(s => s.id === detalheId) || null

    if (view === 'detalhe' && detalhe) {
        const papeisNomes = nomesDosPapeis(papeis, detalhe.cargos || [])
        const tiposTexto = formatarTiposComOpcoes(tipos, detalhe.tipos || [], detalhe.detalhes || {}, detalhe.outro_texto)
        const podeAgenda = ['aguardando', 'agendado', 'reagendado'].includes(detalhe.status)
        const podeCancelar = !['concluido', 'cancelado'].includes(detalhe.status)
        const linkAgenda = linkAdicionarAgenda({
            titulo: `Momento de desenvolvimento: ${tiposTexto} — ${colaborador?.nome || ''}`,
            dataStr: detalhe.data,
            horaStr: detalhe.hora,
            detalhes: `Colaborador: ${colaborador?.nome || ''} / Tipo: ${tiposTexto}${detalhe.descricao ? ' / ' + detalhe.descricao : ''}`,
        })
        const eventos = (detalhe.pdi_eventos || []).slice().sort((a: any, b: any) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime())

        return (
            <div className="max-w-2xl mx-auto flex flex-col gap-4 pb-8">
                <Button variant="ghost" onClick={() => setView('lista')} className="w-fit rounded-xl font-bold text-slate-500">← Voltar</Button>
                <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-3xl">
                    <CardHeader className="border-b border-slate-50 dark:border-slate-800/50 pb-4">
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle className="text-xl font-display">{tiposTexto}</CardTitle>
                            <Badge variant="outline" className={PDI_STATUS_BADGE_CLASS[detalhe.status]}>{PDI_STATUS_LABEL[detalhe.status]}</Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-5">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <span className="text-slate-400">Com quem</span>
                                <p className="font-semibold text-slate-900 dark:text-white">{formatarLista(papeisNomes)}</p>
                            </div>
                            <div>
                                <span className="text-slate-400">Quando</span>
                                <p className="font-semibold text-slate-900 dark:text-white">{formatarDataBr(detalhe.data)} às {detalhe.hora}</p>
                            </div>
                        </div>

                        {detalhe.descricao && (
                            <div>
                                <span className="text-slate-400 text-sm">Descrição</span>
                                <p className="text-sm mt-1 text-slate-700 dark:text-slate-300">{detalhe.descricao}</p>
                            </div>
                        )}

                        {detalhe.status === 'reagendado' && detalhe.sugestao && (
                            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900 rounded-xl p-4 space-y-2">
                                <p className="text-sm font-bold text-blue-700 dark:text-blue-300">Novo horário sugerido</p>
                                <p className="text-sm text-blue-600 dark:text-blue-400">
                                    {formatarDataBr(detalhe.sugestao.data)} às {detalhe.sugestao.hora}
                                    {detalhe.sugestao.motivo && ` — ${detalhe.sugestao.motivo}`}
                                </p>
                                <div className="flex gap-2 pt-2">
                                    <Button size="sm" disabled={acting} onClick={() => handleAction('aceitar_sugestao')} className="rounded-xl font-bold">
                                        {acting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Aceitar novo horário
                                    </Button>
                                    <Button size="sm" variant="outline" disabled={acting} onClick={() => handleAction('manter_original')} className="rounded-xl font-bold">
                                        Manter horário original
                                    </Button>
                                </div>
                            </div>
                        )}

                        {eventos.length > 0 && (
                            <div>
                                <span className="text-slate-400 text-sm">Histórico</span>
                                <div className="mt-2 space-y-1.5">
                                    {eventos.map((e: any) => (
                                        <div key={e.id} className="text-xs text-slate-500 flex gap-2">
                                            <span className="text-slate-400 shrink-0">{new Date(e.criado_em).toLocaleDateString('pt-BR')}</span>
                                            <span>{e.texto}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                            {podeAgenda && (
                                <a href={linkAgenda} target="_blank" rel="noopener">
                                    <Button variant="outline" className="rounded-xl font-bold">Adicionar ao Google Agenda</Button>
                                </a>
                            )}
                            {podeCancelar && (
                                <Button variant="ghost" disabled={acting} onClick={() => handleAction('cancelar')} className="rounded-xl font-bold text-rose-500 hover:bg-rose-500/10 hover:text-rose-600">
                                    Cancelar solicitação
                                </Button>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        )
    }

    const proximos = solicitacoes.filter(s => ['aguardando', 'agendado', 'reagendado'].includes(s.status))
    const historico = solicitacoes.filter(s => ['concluido', 'cancelado'].includes(s.status))

    return (
        <div className="flex flex-col gap-8 pb-8">
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-3">
                    <div className="bg-primary/10 p-2.5 rounded-2xl border border-primary/20">
                        <Target className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">PDI — Momentos de Desenvolvimento</h1>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Solicite um momento com quem puder te ajudar a evoluir.</p>
                    </div>
                </div>
                <Button onClick={() => setView('wizard')} className="rounded-xl h-11 px-5 font-bold">
                    <Plus className="h-4 w-4 mr-2" /> Solicitar momento
                </Button>
            </div>

            {loading ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
            ) : (
                <Tabs defaultValue="meus-pedidos">
                    {meuPapelId && (
                        <TabsList>
                            <TabsTrigger value="meus-pedidos">Meus Pedidos</TabsTrigger>
                            <TabsTrigger value="para-atender">Para Eu Atender</TabsTrigger>
                        </TabsList>
                    )}

                    <TabsContent value="meus-pedidos" className="space-y-8 mt-4">
                        <div className="space-y-3">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <Clock className="h-5 w-5 text-amber-500" /> Próximos
                            </h2>
                            {proximos.length === 0 ? (
                                <p className="text-sm text-slate-400 italic">Nenhum momento em andamento no momento.</p>
                            ) : (
                                <div className="grid gap-3">
                                    {proximos.map(s => (
                                        <SolicitacaoCard key={s.id} s={s} papeis={papeis} tipos={tipos} onClick={() => abrirDetalhe(s.id)} />
                                    ))}
                                </div>
                            )}
                        </div>

                        {historico.length > 0 && (
                            <div className="space-y-3">
                                <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Histórico
                                </h2>
                                <div className="grid gap-3">
                                    {historico.map(s => (
                                        <SolicitacaoCard key={s.id} s={s} papeis={papeis} tipos={tipos} onClick={() => abrirDetalhe(s.id)} />
                                    ))}
                                </div>
                            </div>
                        )}
                    </TabsContent>

                    {meuPapelId && (
                        <TabsContent value="para-atender" className="mt-4">
                            <PainelLider papeis={papeis} tipos={tipos} />
                        </TabsContent>
                    )}
                </Tabs>
            )}
        </div>
    )
}
