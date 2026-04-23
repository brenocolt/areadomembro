"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { AlertTriangle, Wallet, Plane, Calendar, ArrowRight, TrendingUp, Loader2, MapPin, FileQuestion, Star } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { useState, useEffect, useTransition } from "react"

export function WelcomeHeader() {
    const { colaborador, loading } = useColaborador()

    const today = new Date()
    const dateStr = today.toLocaleDateString('pt-BR', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    })

    if (loading) return (
        <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl mb-6">
            <CardContent className="p-6"><div className="h-20 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl" /></CardContent>
        </Card>
    )

    const initials = colaborador?.nome
        ? colaborador.nome.split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
        : '?'

    return (
        <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl mb-6">
            <CardContent className="p-6 flex flex-col md:flex-row items-center gap-6">
                <div className="h-20 w-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center border-4 border-slate-50 dark:border-slate-900 shadow-sm overflow-hidden">
                    <Avatar className="h-full w-full">
                        <AvatarImage src={colaborador?.foto || ""} />
                        <AvatarFallback className="text-2xl font-bold text-slate-400">{initials}</AvatarFallback>
                    </Avatar>
                </div>
                <div className="text-center md:text-left">
                    <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">
                        Bem-vindo de volta, {colaborador?.nome?.split(' ')[0] || 'Colaborador'}
                    </h1>
                    <p className="text-sm text-slate-500 mt-1 capitalize">
                        {dateStr}
                    </p>
                </div>
            </CardContent>
        </Card>
    )
}

export function MetricCards() {
    const { colaborador, loading, colaboradorId } = useColaborador()
    const [milhasSaldo, setMilhasSaldo] = useState<any>(null)

    useEffect(() => {
        async function fetch() {
            const { data } = await supabase
                .from('milhas_saldo')
                .select('saldo_disponivel')
                .eq('colaborador_id', colaboradorId)
                .single()
            if (data) setMilhasSaldo(data)
        }
        if (colaboradorId) fetch()
    }, [colaboradorId])

    if (loading) return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {[...Array(3)].map((_, i) => <Card key={i} className="h-32 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-2xl border-none" />)}
        </div>
    )

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            {/* Plano de Punição */}
            <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl p-6 relative overflow-hidden group hover:shadow-md transition-all duration-300">
                <div className="flex justify-between items-start mb-4">
                    <div className="h-12 w-12 rounded-xl bg-rose-50 dark:bg-rose-900/10 flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform duration-300">
                        <AlertTriangle className="h-6 w-6" />
                    </div>
                    <Badge variant="secondary" className={`border-none ${(colaborador?.pontos_negativos || 0) > 0 ? 'bg-rose-50 text-rose-600 hover:bg-rose-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                        {(colaborador?.pontos_negativos || 0) > 0 ? `${colaborador?.pontos_negativos} ponto(s)` : 'Sem punição'}
                    </Badge>
                </div>
                <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Plano de Punição</span>
                    <div className="text-3xl font-display font-bold text-slate-900 dark:text-white mt-1">
                        {colaborador?.pontos_negativos || 0} pts
                    </div>
                </div>
            </Card>

            {/* Saldo PIPJ */}
            <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl p-6 relative overflow-hidden group hover:shadow-md transition-all duration-300">
                <div className="flex justify-between items-start mb-4">
                    <div className="h-12 w-12 rounded-xl bg-green-50 dark:bg-green-900/10 flex items-center justify-center text-green-600 group-hover:scale-110 transition-transform duration-300">
                        <Wallet className="h-6 w-6" />
                    </div>
                    <Badge variant="secondary" className="bg-green-50 text-green-600 hover:bg-green-100 border-none">Disponível</Badge>
                </div>
                <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Saldo PIPJ</span>
                    <div className="text-3xl font-display font-bold text-slate-900 dark:text-white mt-1">
                        R$ {Number(colaborador?.saldo_pipj || 0).toFixed(2).replace('.', ',')}
                    </div>
                </div>
            </Card>

            {/* Milhas */}
            <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl p-6 relative overflow-hidden group hover:shadow-md transition-all duration-300">
                <div className="flex justify-between items-start mb-4">
                    <div className="h-12 w-12 rounded-xl bg-blue-50 dark:bg-blue-900/10 flex items-center justify-center text-blue-600 group-hover:scale-110 transition-transform duration-300">
                        <Plane className="h-6 w-6" />
                    </div>
                    <Badge variant="secondary" className="bg-blue-50 text-blue-600 hover:bg-blue-100 border-none">Acumulado</Badge>
                </div>
                <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Milhas Acumuladas</span>
                    <div className="text-3xl font-display font-bold text-slate-900 dark:text-white mt-1">
                        {new Intl.NumberFormat('pt-BR').format(milhasSaldo?.saldo_disponivel || 0)} mi
                    </div>
                </div>
            </Card>
        </div>
    )
}

export function RecentActivity() {
    const { colaboradorId } = useColaborador()
    const [activities, setActivities] = useState<any[]>([])

    useEffect(() => {
        async function fetchActivities() {
            if (!colaboradorId) return

            // Fetch recent transactions and citações combined
            const [txRes, citRes, trocasRes, saquesRes, remocoesRes, flagsRes] = await Promise.all([
                supabase.from('transacoes_pipj').select('*').eq('colaborador_id', colaboradorId).order('data', { ascending: false }).limit(3),
                supabase.from('citacoes').select('*').eq('colaborador_id', colaboradorId).order('data', { ascending: false }).limit(3),
                supabase.from('milhas_trocas').select('*').eq('colaborador_id', colaboradorId).order('data_troca', { ascending: false }).limit(3),
                supabase.from('solicitacoes_saque').select('*').eq('colaborador_id', colaboradorId).order('data_solicitacao', { ascending: false }).limit(3),
                supabase.from('solicitacoes_remocao').select('*').eq('colaborador_id', colaboradorId).order('created_at', { ascending: false }).limit(3),
                supabase.from('flags').select('*').eq('colaborador_id', colaboradorId).order('created_at', { ascending: false }).limit(3),
            ])

            const items: any[] = []

            if (txRes.data) txRes.data.forEach(t => items.push({
                type: 'pipj',
                label: `${t.tipo === 'ENTRADA' ? 'Crédito' : 'Resgate'} PIPJ - R$ ${Number(t.valor).toFixed(2).replace('.', ',')}`,
                rawDate: new Date(t.data),
                time: new Date(t.data).toLocaleDateString('pt-BR'),
                sub: 'Carteira PIPJ',
                badge: t.status,
                badgeClass: t.status === 'APROVADA' || t.status === 'CREDITADO' || t.status === 'PAGO'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                    : t.status === 'PENDENTE'
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                        : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
                color: t.status === 'APROVADA' || t.status === 'CREDITADO' || t.status === 'PAGO' ? 'bg-emerald-500' : t.status === 'PENDENTE' ? 'bg-amber-500' : 'bg-rose-500'
            }))

            if (citRes.data) citRes.data.forEach(c => items.push({
                type: 'citacao',
                label: `Citação: ${c.descricao?.substring(0, 50) || 'Registro'}`,
                rawDate: new Date(c.data),
                time: new Date(c.data).toLocaleDateString('pt-BR'),
                sub: c.tipo === 'ENTRADA' ? 'Elogio' : 'Observação',
                badge: c.tipo,
                badgeClass: c.tipo === 'ENTRADA' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-orange-50 text-orange-700 border-orange-200',
                color: c.tipo === 'ENTRADA' ? 'bg-blue-500' : 'bg-orange-500'
            }))

            if (trocasRes.data) trocasRes.data.forEach(t => items.push({
                type: 'troca_milhas',
                label: `Troca de Milhas: ${t.item_nome}`,
                rawDate: new Date(t.data_troca),
                time: new Date(t.data_troca).toLocaleDateString('pt-BR'),
                sub: `${t.milhas_gastas} milhas`,
                badge: t.status,
                badgeClass: t.status === 'APROVADA'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                    : t.status === 'PENDENTE'
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                        : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
                color: t.status === 'APROVADA' ? 'bg-emerald-500' : t.status === 'PENDENTE' ? 'bg-amber-500' : 'bg-rose-500'
            }))

            if (saquesRes.data) saquesRes.data.forEach(s => items.push({
                type: 'saque',
                label: s.tipo === 'adicao_milhas' ? `Adição Extra de Milhas: ${s.atividade || 'Recompensa'}` : `Saque PIPJ - R$ ${Number(s.valor || 0).toFixed(2).replace('.', ',')}`,
                rawDate: new Date(s.data_solicitacao),
                time: new Date(s.data_solicitacao).toLocaleDateString('pt-BR'),
                sub: s.tipo === 'adicao_milhas' ? `+${s.quantidade || 0} milhas` : 'Saque',
                badge: s.status,
                badgeClass: s.status === 'APROVADO' || s.status === 'PAGO'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                    : s.status === 'PENDENTE'
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                        : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
                color: s.status === 'APROVADO' || s.status === 'PAGO' ? 'bg-emerald-500' : s.status === 'PENDENTE' ? 'bg-amber-500' : 'bg-rose-500'
            }))

            if (remocoesRes.data) remocoesRes.data.forEach(r => items.push({
                type: 'remocao',
                label: `Remoção Restrição: ${r.motivo.substring(0, 30)}`,
                rawDate: new Date(r.created_at),
                time: new Date(r.created_at).toLocaleDateString('pt-BR'),
                sub: 'Pontos Negativos',
                badge: r.status,
                badgeClass: r.status === 'APROVADA'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20'
                    : r.status === 'PENDENTE'
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20'
                        : 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20',
                color: r.status === 'APROVADA' ? 'bg-emerald-500' : r.status === 'PENDENTE' ? 'bg-amber-500' : 'bg-rose-500'
            }))

            if (flagsRes.data) flagsRes.data.forEach(f => items.push({
                type: 'flag',
                label: `Aviso Disciplinar: Flag ${f.cor.charAt(0).toUpperCase() + f.cor.slice(1)}`,
                rawDate: new Date(f.created_at),
                time: new Date(f.created_at).toLocaleDateString('pt-BR'),
                sub: `Motivo: ${f.motivo}`,
                badge: `Flag ${f.cor.charAt(0).toUpperCase() + f.cor.slice(1)}`,
                badgeClass: f.cor === 'vermelha' ? 'bg-red-50 text-red-700 border-red-200 dark:bg-red-500/10 dark:text-red-400 border' :
                            f.cor === 'amarela' ? 'bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 border' :
                            'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 border',
                color: f.cor === 'vermelha' ? 'bg-red-500' : f.cor === 'amarela' ? 'bg-yellow-500' : 'bg-blue-500'
            }))

            // Sort by time descending and take latest 4
            items.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime())
            setActivities(items.slice(0, 4))
        }

        fetchActivities()

        const channels = [
            'transacoes_pipj',
            'citacoes',
            'milhas_trocas',
            'solicitacoes_saque',
            'solicitacoes_remocao',
            'flags'
        ].map(table =>
            supabase.channel(`recent_activity_widget_${table}`)
                .on('postgres_changes', { event: '*', schema: 'public', table }, fetchActivities)
                .subscribe()
        )

        return () => {
            channels.forEach(channel => supabase.removeChannel(channel))
        }
    }, [colaboradorId])

    return (
        <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl h-full">
            <CardHeader className="border-b border-slate-50 dark:border-slate-800/50 pb-4">
                <CardTitle className="text-lg font-display">Atividade Recente</CardTitle>
            </CardHeader>
            <CardContent className="p-6">
                {activities.length > 0 ? (
                    <div className="relative border-l-2 border-slate-100 dark:border-slate-800 ml-3 space-y-8">
                        {activities.map((a, i) => (
                            <div key={i} className="relative pl-8">
                                <div className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white dark:border-[#0F172A] ${a.color} shadow-sm z-10`}></div>
                                <div className="flex flex-col gap-1">
                                    <span className="font-bold text-sm text-slate-900 dark:text-white">{a.label}</span>
                                    <span className="text-xs text-slate-500">{a.time} • {a.sub}</span>
                                    <Badge variant="outline" className={`w-fit mt-1 text-[9px] ${a.badgeClass}`}>{a.badge}</Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-sm text-slate-400 italic text-center py-8">Nenhuma atividade recente</p>
                )}
            </CardContent>
        </Card>
    )
}

export function QuickActions() {
    const { colaboradorId } = useColaborador()
    const [isPending, startTransition] = useTransition()
    const [dialogOpen, setDialogOpen] = useState(false)
    const [ausenciaForm, setAusenciaForm] = useState({ localizacao: '', data_ida: '', data_volta: '', justificativa: '' })
    const [ausenciaMsg, setAusenciaMsg] = useState<{ text: string, type: 'success' | 'error' } | null>(null)

    function handleAusenciaSubmit() {
        if (!ausenciaForm.localizacao || !ausenciaForm.data_ida || !ausenciaForm.data_volta || !ausenciaForm.justificativa) {
            setAusenciaMsg({ text: 'Preencha todos os campos.', type: 'error' })
            return
        }
        setAusenciaMsg(null)
        startTransition(async () => {
            const { error } = await supabase.from('ausencias').insert({
                colaborador_id: colaboradorId,
                localizacao: ausenciaForm.localizacao,
                data_ida: ausenciaForm.data_ida,
                data_volta: ausenciaForm.data_volta,
                justificativa: ausenciaForm.justificativa,
            })
            if (error) {
                setAusenciaMsg({ text: 'Erro ao registrar ausência: ' + error.message, type: 'error' })
            } else {
                setAusenciaMsg({ text: 'Ausência registrada com sucesso!', type: 'success' })
                setAusenciaForm({ localizacao: '', data_ida: '', data_volta: '', justificativa: '' })
                setTimeout(() => setDialogOpen(false), 1500)
            }
        })
    }

    return (
        <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
            <CardHeader className="border-b border-slate-50 dark:border-slate-800/50 pb-4">
                <CardTitle className="text-lg font-display">Ações Rápidas</CardTitle>
            </CardHeader>
            <CardContent className="p-6 space-y-3">
                <Link href="/wallet" className="block">
                    <Button className="w-full justify-start gap-3 h-12 bg-primary hover:bg-primary/90 text-white font-bold shadow-md shadow-primary/20">
                        <div className="h-6 w-6 rounded bg-white/20 flex items-center justify-center">
                            <Wallet className="h-4 w-4" />
                        </div>
                        Ver Carteira PIPJ
                    </Button>
                </Link>

                <Link href="/performance" className="block">
                    <Button className="w-full justify-start gap-3 h-12 bg-primary hover:bg-primary/90 text-white font-bold shadow-md shadow-primary/20">
                        <div className="h-6 w-6 rounded bg-white/20 flex items-center justify-center">
                            <TrendingUp className="h-4 w-4" />
                        </div>
                        Ver Relatório NPS
                    </Button>
                </Link>

                <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setAusenciaMsg(null) }}>
                    <DialogTrigger asChild>
                        <Button className="w-full justify-start gap-3 h-12 bg-primary hover:bg-primary/90 text-white font-bold shadow-md shadow-primary/20">
                            <div className="h-6 w-6 rounded bg-white/20 flex items-center justify-center">
                                <MapPin className="h-4 w-4" />
                            </div>
                            Agendar Ausência
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[480px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-display">Agendar Ausência</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4 pt-2">
                            <div className="space-y-2">
                                <Label htmlFor="localizacao" className="font-semibold">Localização da Viagem</Label>
                                <Input
                                    id="localizacao"
                                    placeholder="Ex: São Paulo, SP"
                                    value={ausenciaForm.localizacao}
                                    onChange={(e) => setAusenciaForm(f => ({ ...f, localizacao: e.target.value }))}
                                    className="dark:bg-slate-800 dark:border-slate-700"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="data_ida" className="font-semibold">Data de Ida</Label>
                                    <Input
                                        id="data_ida"
                                        type="date"
                                        value={ausenciaForm.data_ida}
                                        onChange={(e) => setAusenciaForm(f => ({ ...f, data_ida: e.target.value }))}
                                        className="dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="data_volta" className="font-semibold">Data de Volta</Label>
                                    <Input
                                        id="data_volta"
                                        type="date"
                                        value={ausenciaForm.data_volta}
                                        onChange={(e) => setAusenciaForm(f => ({ ...f, data_volta: e.target.value }))}
                                        className="dark:bg-slate-800 dark:border-slate-700"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="justificativa" className="font-semibold">Justificativa da Viagem</Label>
                                <Textarea
                                    id="justificativa"
                                    placeholder="Descreva o motivo da sua ausência..."
                                    rows={3}
                                    value={ausenciaForm.justificativa}
                                    onChange={(e) => setAusenciaForm(f => ({ ...f, justificativa: e.target.value }))}
                                    className="dark:bg-slate-800 dark:border-slate-700 resize-none"
                                />
                            </div>

                            {ausenciaMsg && (
                                <div className={`p-3 rounded-lg text-sm text-center border ${ausenciaMsg.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-500' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500'}`}>
                                    {ausenciaMsg.text}
                                </div>
                            )}

                            <Button
                                onClick={handleAusenciaSubmit}
                                disabled={isPending}
                                className="w-full h-11 bg-primary hover:bg-primary/90 text-white font-bold"
                            >
                                {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Registrar Ausência
                            </Button>
                        </div>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    )
}

export function PendingFormsWidget() {
    const { colaborador } = useColaborador()
    const [pendentes, setPendentes] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        const fetchPendentes = async () => {
            if (!colaborador?.id) return;
            
            // fetch active forms
            const { data: activeForms } = await supabase
                .from('formularios')
                .select('*')
                .eq('status', 'ativo')
                .order('created_at', { ascending: false });
                
            if (!activeForms) {
                setLoading(false);
                return;
            }

            // fetch user responses
            const { data: responses } = await supabase
                .from('formulario_respostas')
                .select('formulario_id')
                .eq('colaborador_id', colaborador.id);
                
            const respondedIds = new Set((responses || []).map(r => r.formulario_id));
            const p = activeForms.filter(f => !respondedIds.has(f.id));
            
            setPendentes(p);
            setLoading(false);
        }
        fetchPendentes();
    }, [colaborador?.id])

    if (loading) {
        return (
            <Card className="border-none shadow-sm bg-slate-50 dark:bg-slate-800/20 rounded-2xl mt-6 border border-slate-100 dark:border-slate-800/50">
                <CardContent className="p-6 flex flex-col items-center justify-center">
                    <Loader2 className="h-6 w-6 text-slate-400 animate-spin" />
                </CardContent>
            </Card>
        )
    }

    if (pendentes.length === 0) {
        return (
            <Card className="border-none shadow-sm bg-slate-50 dark:bg-slate-800/20 rounded-2xl mt-6 border border-slate-100 dark:border-slate-800/50">
                <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                    <div className="bg-emerald-100 dark:bg-emerald-500/10 p-3 rounded-full mb-3">
                        <FileQuestion className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <h3 className="font-bold text-slate-900 dark:text-white mb-1">Tudo em dia!</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Nenhum formulário pendente.
                    </p>
                </CardContent>
            </Card>
        )
    }

    return (
        <Card className="border-none shadow-sm bg-violet-50 dark:bg-violet-950/20 rounded-2xl mt-6 border border-violet-100 dark:border-violet-900/50">
            <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-3">
                    <div className="bg-violet-100 dark:bg-violet-900/50 p-2 rounded-xl">
                        <FileQuestion className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <h3 className="font-bold text-violet-900 dark:text-violet-100">Avaliações Pendentes</h3>
                </div>
                <p className="text-sm text-violet-700 dark:text-violet-300/80 mb-4">
                    Você tem <span className="font-bold">{pendentes.length}</span> {pendentes.length === 1 ? 'formulário aguardando' : 'formulários aguardando'} sua resposta.
                </p>
                <Link href="/formularios">
                    <Button variant="outline" className="w-full bg-white dark:bg-[#0F172A] border-violet-200 dark:border-violet-800 hover:bg-violet-50 dark:hover:bg-violet-900/40 text-violet-700 dark:text-violet-300 font-bold transition-all">
                        Responder agora <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                </Link>
            </CardContent>
        </Card>
    )
}
