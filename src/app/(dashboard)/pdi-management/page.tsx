"use client"

import { useState, useEffect } from "react"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Target, PlusCircle, Pencil, Loader2, BarChart3, Ban } from "lucide-react"
import { toast } from "sonner"
import {
    PdiPapel, PdiTipoMomento, PdiCargoMapeamento,
    formatarDataBr, formatarTiposComOpcoes, nomesDosPapeis,
    PDI_STATUS_LABEL, PDI_STATUS_BADGE_CLASS, resolverPapelId,
} from "@/lib/pdi"
import { TipoMomentoDialog } from "./components/tipo-momento-dialog"
import { DetalheSolicitacaoDialog } from "./components/detalhe-solicitacao-dialog"

export default function PdiManagementPage() {
    const { role, loading: loadingColaborador } = useColaborador()
    const [loading, setLoading] = useState(true)
    const [papeis, setPapeis] = useState<PdiPapel[]>([])
    const [tipos, setTipos] = useState<PdiTipoMomento[]>([])
    const [solicitacoes, setSolicitacoes] = useState<any[]>([])
    const [lideresAtivos, setLideresAtivos] = useState<any[]>([])
    const [mapeamentos, setMapeamentos] = useState<PdiCargoMapeamento[]>([])
    const [eventosSugestao, setEventosSugestao] = useState<any[]>([])
    const [feedEventos, setFeedEventos] = useState<any[]>([])

    const [detalheSolicitacao, setDetalheSolicitacao] = useState<any | null>(null)
    const [tipoEditando, setTipoEditando] = useState<PdiTipoMomento | null>(null)
    const [tipoDialogOpen, setTipoDialogOpen] = useState(false)

    const [filtroStatus, setFiltroStatus] = useState('todos')
    const [filtroPapel, setFiltroPapel] = useState('todos')
    const [filtroTipo, setFiltroTipo] = useState('todos')
    const [filtroData, setFiltroData] = useState('')
    // Bumped para forçar um refetch (após criar/editar tipo, cancelar
    // solicitação etc.) sem depender de uma referência de função no efeito.
    const [refreshTick, setRefreshTick] = useState(0)

    useEffect(() => {
        if (role !== 'ADMIN') return

        async function fetchTudo() {
            const [
                { data: papeisData },
                { data: tiposData },
                { data: mapeamentosData },
                { data: solicitacoesData },
                { data: lideresData },
                { data: eventosSugestaoData },
                { data: feedData },
            ] = await Promise.all([
                supabase.from('pdi_papeis').select('*').order('ordem'),
                supabase.from('pdi_tipos_momento').select('*').order('ordem'),
                supabase.from('pdi_cargos').select('papel_id, cargo_atual, nucleo_atual'),
                supabase
                    .from('pdi_solicitacoes')
                    .select('*, colaborador:colaborador_id(nome, nucleo_atual), pdi_solicitacao_lideres(papel_id, lider_id, aceito_em, lider:lider_id(nome)), pdi_eventos(*)')
                    .order('data', { ascending: false }),
                supabase.from('colaboradores').select('id, nome, cargo_atual, nucleo_atual').eq('status', 'Ativo').in('cargo_atual', ['Tático', 'Estratégico']),
                supabase.from('pdi_eventos').select('autor_id').eq('tipo', 'sugestao'),
                supabase.from('pdi_eventos').select('*, autor:autor_id(nome)').order('criado_em', { ascending: false }).limit(20),
            ])

            setPapeis(papeisData || [])
            setTipos(tiposData || [])
            setMapeamentos((mapeamentosData || []) as PdiCargoMapeamento[])
            setSolicitacoes(solicitacoesData || [])
            setLideresAtivos(lideresData || [])
            setEventosSugestao(eventosSugestaoData || [])
            setFeedEventos(feedData || [])
            setLoading(false)
        }
        fetchTudo()
    }, [role, refreshTick])

    function refetch() {
        setRefreshTick(t => t + 1)
    }

    if (loadingColaborador) {
        return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
    }

    if (role !== 'ADMIN') {
        return (
            <div className="max-w-md mx-auto text-center py-16">
                <p className="text-slate-500">Esta página é restrita a administradores.</p>
            </div>
        )
    }

    if (loading) {
        return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
    }

    const totalSolicitacoes = solicitacoes.length
    const aguardandoAceite = solicitacoes.filter(s => ['aguardando', 'reagendado'].includes(s.status)).length
    const agendadas = solicitacoes.filter(s => s.status === 'agendado').length
    const concluidas = solicitacoes.filter(s => s.status === 'concluido').length

    const linhasLideres = (() => {
        const todasLinhas = solicitacoes.flatMap(s => (s.pdi_solicitacao_lideres || []).map((l: any) => ({ ...l, statusSolicitacao: s.status })))
        return lideresAtivos.map(c => {
            const meuPapel = resolverPapelId(c.cargo_atual, c.nucleo_atual, mapeamentos)
            const papelNome = meuPapel ? (papeis.find(p => p.id === meuPapel)?.nome || meuPapel) : null
            const aceitos = todasLinhas.filter(l => l.lider_id === c.id && l.aceito_em && l.statusSolicitacao !== 'cancelado').length
            const concluidos = todasLinhas.filter(l => l.lider_id === c.id && l.statusSolicitacao === 'concluido').length
            const sugeriu = eventosSugestao.filter(e => e.autor_id === c.id).length
            const abertasAgora = meuPapel
                ? todasLinhas.filter(l => l.papel_id === meuPapel && !l.lider_id && !['cancelado', 'concluido'].includes(l.statusSolicitacao)).length
                : 0
            return { id: c.id, nome: c.nome, papelNome, aceitos, concluidos, sugeriu, abertasAgora }
        })
    })()

    const solicitacoesFiltradas = solicitacoes.filter(s => {
        if (filtroStatus !== 'todos' && s.status !== filtroStatus) return false
        if (filtroPapel !== 'todos' && !(s.cargos || []).includes(filtroPapel)) return false
        if (filtroTipo !== 'todos' && !(s.tipos || []).includes(filtroTipo)) return false
        if (filtroData && s.data !== filtroData) return false
        return true
    })

    const tiposOrdemSeguinte = tipos.length > 0 ? Math.max(...tipos.map(t => t.ordem)) + 1 : 1

    async function alternarAtivoTipo(t: PdiTipoMomento) {
        const { error } = await supabase.from('pdi_tipos_momento').update({ ativo: !t.ativo }).eq('id', t.id)
        if (error) {
            toast.error('Erro ao atualizar tipo: ' + error.message)
            return
        }
        refetch()
    }

    return (
        <div className="flex flex-col gap-8 pb-8">
            <div className="flex items-center gap-3">
                <div className="bg-primary/10 p-2.5 rounded-2xl border border-primary/20">
                    <Target className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Gestão de PDI</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Acompanhe os momentos de desenvolvimento solicitados na equipe.</p>
                </div>
            </div>

            <Tabs defaultValue="visao-geral">
                <TabsList>
                    <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
                    <TabsTrigger value="solicitacoes">Solicitações</TabsTrigger>
                    <TabsTrigger value="tipos">Tipos de momento</TabsTrigger>
                </TabsList>

                <TabsContent value="visao-geral" className="space-y-8 mt-4">
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                        {[
                            { label: 'Total', valor: totalSolicitacoes },
                            { label: 'Aguardando aceite', valor: aguardandoAceite },
                            { label: 'Agendadas', valor: agendadas },
                            { label: 'Concluídas', valor: concluidas },
                        ].map(stat => (
                            <Card key={stat.label} className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
                                <CardContent className="p-5">
                                    <p className="text-sm text-slate-500">{stat.label}</p>
                                    <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{stat.valor}</p>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
                        <CardHeader className="border-b border-slate-50 dark:border-slate-800/50 pb-4">
                            <CardTitle className="text-lg font-display">Atualizações das solicitações</CardTitle>
                        </CardHeader>
                        <CardContent className="p-4 space-y-2">
                            {feedEventos.length === 0 ? (
                                <p className="text-sm text-slate-400 italic py-4 text-center">Nenhum evento registrado ainda.</p>
                            ) : (
                                feedEventos.map(e => {
                                    const solicitacaoRelacionada = solicitacoes.find(s => s.id === e.solicitacao_id)
                                    return (
                                        <button
                                            key={e.id}
                                            type="button"
                                            onClick={() => solicitacaoRelacionada && setDetalheSolicitacao(solicitacaoRelacionada)}
                                            className="w-full text-left flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors"
                                        >
                                            <span className="text-sm text-slate-600 dark:text-slate-300">
                                                <strong>{e.autor?.nome}</strong> — {e.texto}
                                            </span>
                                            <span className="text-xs text-slate-400 shrink-0">{new Date(e.criado_em).toLocaleDateString('pt-BR')}</span>
                                        </button>
                                    )
                                })
                            )}
                        </CardContent>
                    </Card>

                    <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
                        <CardHeader className="border-b border-slate-50 dark:border-slate-800/50 pb-4">
                            <CardTitle className="text-lg font-display flex items-center gap-2">
                                <BarChart3 className="h-5 w-5" /> Aceites por líder
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Líder</TableHead>
                                        <TableHead>Papel</TableHead>
                                        <TableHead className="text-center">Aceitos</TableHead>
                                        <TableHead className="text-center">Concluídos</TableHead>
                                        <TableHead className="text-center">Sugeriu horário</TableHead>
                                        <TableHead className="text-center">Abertas agora</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {linhasLideres.map(l => (
                                        <TableRow key={l.id}>
                                            <TableCell className="font-semibold">{l.nome}</TableCell>
                                            <TableCell className="text-slate-500">{l.papelNome || '—'}</TableCell>
                                            <TableCell className="text-center">{l.aceitos}</TableCell>
                                            <TableCell className="text-center">{l.concluidos}</TableCell>
                                            <TableCell className="text-center">{l.sugeriu}</TableCell>
                                            <TableCell className="text-center">
                                                {l.abertasAgora > 0 ? <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-200">{l.abertasAgora}</Badge> : 0}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="solicitacoes" className="space-y-4 mt-4">
                    <div className="flex flex-wrap gap-3">
                        <Select value={filtroStatus} onValueChange={setFiltroStatus}>
                            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos os status</SelectItem>
                                {Object.entries(PDI_STATUS_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={filtroPapel} onValueChange={setFiltroPapel}>
                            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos os papéis</SelectItem>
                                {papeis.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="todos">Todos os tipos</SelectItem>
                                {tipos.map(t => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}
                            </SelectContent>
                        </Select>
                        <Input type="date" value={filtroData} onChange={(e) => setFiltroData(e.target.value)} className="w-[160px]" />
                        {(filtroStatus !== 'todos' || filtroPapel !== 'todos' || filtroTipo !== 'todos' || filtroData) && (
                            <Button variant="ghost" size="sm" onClick={() => { setFiltroStatus('todos'); setFiltroPapel('todos'); setFiltroTipo('todos'); setFiltroData('') }}>
                                Limpar filtros
                            </Button>
                        )}
                    </div>

                    <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
                        <CardContent className="p-0">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Colaborador</TableHead>
                                        <TableHead>Com quem</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Quando</TableHead>
                                        <TableHead>Status</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {solicitacoesFiltradas.length === 0 ? (
                                        <TableRow><TableCell colSpan={5} className="text-center text-slate-400 py-8">Nenhuma solicitação encontrada.</TableCell></TableRow>
                                    ) : (
                                        solicitacoesFiltradas.map(s => (
                                            <TableRow key={s.id} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/30" onClick={() => setDetalheSolicitacao(s)}>
                                                <TableCell className="font-semibold">{s.colaborador?.nome}</TableCell>
                                                <TableCell className="text-sm text-slate-500">{nomesDosPapeis(papeis, s.cargos || []).join(', ')}</TableCell>
                                                <TableCell className="text-sm text-slate-500 max-w-[220px] truncate">{formatarTiposComOpcoes(tipos, s.tipos || [], s.detalhes || {}, s.outro_texto)}</TableCell>
                                                <TableCell className="text-sm">{formatarDataBr(s.data)} às {s.hora}</TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={PDI_STATUS_BADGE_CLASS[s.status]}>{PDI_STATUS_LABEL[s.status]}</Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="tipos" className="space-y-4 mt-4">
                    <div className="flex justify-end">
                        <Button onClick={() => { setTipoEditando(null); setTipoDialogOpen(true) }} className="rounded-xl font-bold">
                            <PlusCircle className="h-4 w-4 mr-2" /> Novo tipo
                        </Button>
                    </div>
                    <div className="grid gap-3">
                        {tipos.map(t => (
                            <Card key={t.id} className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
                                <CardContent className="p-5 flex items-center justify-between gap-4">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="font-bold text-slate-900 dark:text-white">{t.nome}</p>
                                            {!t.ativo && <Badge variant="outline" className="bg-slate-500/10 text-slate-500 border-slate-200 text-[10px]">Inativo</Badge>}
                                        </div>
                                        {t.descricao && <p className="text-sm text-slate-500 mt-0.5">{t.descricao}</p>}
                                        {t.sub_opcoes.length > 0 && (
                                            <p className="text-xs text-slate-400 mt-1">{t.sub_label}: {t.sub_opcoes.join(', ')}</p>
                                        )}
                                    </div>
                                    {t.id !== 'outro' && (
                                        <div className="flex items-center gap-2 shrink-0">
                                            <Button variant="ghost" size="icon" onClick={() => { setTipoEditando(t); setTipoDialogOpen(true) }} className="h-8 w-8 text-slate-400 hover:text-primary">
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                            <Button variant="ghost" size="icon" onClick={() => alternarAtivoTipo(t)} title={t.ativo ? 'Desativar' : 'Ativar'} className="h-8 w-8 text-slate-400 hover:text-rose-500">
                                                <Ban className="h-4 w-4" />
                                            </Button>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>

            {detalheSolicitacao && (
                <DetalheSolicitacaoDialog
                    solicitacao={detalheSolicitacao}
                    papeis={papeis}
                    tipos={tipos}
                    onClose={() => setDetalheSolicitacao(null)}
                    onAlterado={() => { setDetalheSolicitacao(null); refetch() }}
                />
            )}

            <TipoMomentoDialog
                tipo={tipoEditando}
                open={tipoDialogOpen}
                onOpenChange={setTipoDialogOpen}
                ordemSeguinte={tiposOrdemSeguinte}
                onSalvo={() => { setTipoDialogOpen(false); refetch() }}
            />
        </div>
    )
}
