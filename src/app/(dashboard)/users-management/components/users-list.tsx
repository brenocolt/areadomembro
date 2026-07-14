"use client"

import { useState, useEffect } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Search, Pencil, UserX, UserCheck, Shield, Mail } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { supabase } from "@/lib/supabase"
import { desligarMembro, reativarMembro } from "@/lib/admin-actions"
import { EditUserAccessDialog } from "./edit-user-access-dialog"

type PendingAction = { id: string, name: string, type: 'desligar' | 'reativar' }

export function UsersList() {
    const [colaboradores, setColaboradores] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [search, setSearch] = useState("")
    const [tab, setTab] = useState<'ativos' | 'desligados'>('ativos')
    const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
    const [processing, setProcessing] = useState(false)
    const [userToEdit, setUserToEdit] = useState<any | null>(null)

    useEffect(() => {
        async function fetch() {
            const { data } = await supabase
                .from('colaboradores')
                .select('*, users!inner(role), milhas_saldo(saldo_disponivel)')
                .order('nome', { ascending: true })

            if (data) {
                setColaboradores(data)
            }
            setLoading(false)
        }
        fetch()

        const sub = supabase.channel('colaboradores_list_changes')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'colaboradores' }, fetch)
            .subscribe()

        return () => {
            supabase.removeChannel(sub)
        }
    }, [])

    const byTab = colaboradores.filter(c => tab === 'desligados' ? c.status === 'Desligado' : c.status !== 'Desligado')

    const filtered = byTab.filter(c =>
        c.nome.toLowerCase().includes(search.toLowerCase()) ||
        c.email_corporativo?.toLowerCase().includes(search.toLowerCase()) ||
        c.cpf?.toLowerCase().includes(search.toLowerCase())
    )

    const desligadosCount = colaboradores.filter(c => c.status === 'Desligado').length

    const handleConfirmAction = async () => {
        if (!pendingAction) return;
        setProcessing(true)
        try {
            const { success, error } = pendingAction.type === 'desligar'
                ? await desligarMembro(pendingAction.id)
                : await reativarMembro(pendingAction.id)

            if (success) {
                const novoStatus = pendingAction.type === 'desligar' ? 'Desligado' : 'Ativo'
                setColaboradores(prev => prev.map(c => c.id === pendingAction.id ? { ...c, status: novoStatus } : c))
            } else {
                alert("Erro: " + error)
            }
        } catch (e: any) {
            alert("Erro fatal: " + e.message)
        }
        setProcessing(false)
        setPendingAction(null)
    }

    return (
        <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none text-slate-900 dark:text-white rounded-3xl h-full shadow-lg overflow-hidden">
            <CardHeader className="flex flex-col gap-4 pb-4 border-b border-slate-100 dark:border-white/5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
                            <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <CardTitle className="text-base font-bold">
                            {tab === 'desligados' ? 'Membros Desligados' : 'Colaboradores Ativos'}
                        </CardTitle>
                    </div>
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar colaboradores..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="pl-9 bg-slate-50 dark:bg-slate-900 border-none h-9 text-sm rounded-xl focus-visible:ring-1 focus-visible:ring-primary"
                        />
                    </div>
                </div>
                <Tabs value={tab} onValueChange={(v) => setTab(v as 'ativos' | 'desligados')}>
                    <TabsList>
                        <TabsTrigger value="ativos">Ativos</TabsTrigger>
                        <TabsTrigger value="desligados">
                            Desligados {desligadosCount > 0 && `(${desligadosCount})`}
                        </TabsTrigger>
                    </TabsList>
                </Tabs>
            </CardHeader>
            <CardContent className="p-0">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-slate-50/50 dark:bg-slate-900/20">
                            <TableRow className="border-b-slate-100 dark:border-white/5 hover:bg-transparent">
                                <TableHead className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Nome</TableHead>
                                <TableHead className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">CPF</TableHead>
                                <TableHead className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Cargo & Núcleo</TableHead>
                                <TableHead className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Contatos</TableHead>
                                <TableHead className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Milhas</TableHead>
                                <TableHead className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-slate-500">Permissão</TableHead>
                                <TableHead className="py-3 px-6 text-xs font-bold uppercase tracking-wider text-slate-500 text-right">Ações</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-slate-400">Carregando colaboradores...</TableCell>
                                </TableRow>
                            ) : filtered.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={7} className="text-center py-8 text-slate-400">
                                        {tab === 'desligados' ? 'Nenhum membro desligado' : 'Nenhum colaborador encontrado'}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filtered.map((c) => (
                                    <TableRow key={c.id} className="border-b-slate-100 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                        <TableCell className="py-3 px-6">
                                            <div className="flex items-center gap-3">
                                                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary text-sm shrink-0">
                                                    {(c.nome || '??').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()}
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="font-bold text-sm text-slate-900 dark:text-white truncate">{c.nome}</p>
                                                    <p className="text-xs text-slate-500 truncate">Matrícula: {c.matricula}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3 px-6">
                                            <span className="text-sm font-mono text-slate-700 dark:text-slate-300">{c.cpf || '—'}</span>
                                        </TableCell>
                                        <TableCell className="py-3 px-6">
                                            <p className="text-sm font-medium">{c.cargo_atual}</p>
                                            <p className="text-xs text-slate-500">{c.nucleo_atual}</p>
                                        </TableCell>
                                        <TableCell className="py-3 px-6">
                                            <div className="flex flex-col gap-1 items-start text-xs text-slate-600 dark:text-slate-400">
                                                <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" /> {c.email_corporativo}</span>
                                                <span className="text-[10px] pl-4">{c.telefone}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3 px-6">
                                            <div className="inline-flex px-2 py-1 rounded bg-indigo-50 dark:bg-indigo-900/30 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                                                {Array.isArray(c.milhas_saldo) ? c.milhas_saldo[0]?.saldo_disponivel || 0 : c.milhas_saldo?.saldo_disponivel || 0} pts
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3 px-6">
                                            <div className="inline-flex px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono font-bold text-slate-600 dark:text-slate-300">
                                                {c.users?.[0]?.role || 'SEM_ACESSO'}
                                            </div>
                                        </TableCell>
                                        <TableCell className="py-3 px-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button onClick={() => setUserToEdit(c)} size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-primary hover:bg-primary/10 rounded-lg">
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                {tab === 'desligados' ? (
                                                    <Button onClick={() => setPendingAction({ id: c.id, name: c.nome, type: 'reativar' })} size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-emerald-500 hover:bg-emerald-500/10 rounded-lg">
                                                        <UserCheck className="h-4 w-4" />
                                                    </Button>
                                                ) : (
                                                    <Button onClick={() => setPendingAction({ id: c.id, name: c.nome, type: 'desligar' })} size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg">
                                                        <UserX className="h-4 w-4" />
                                                    </Button>
                                                )}
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>

            {/* DESLIGAR / REATIVAR CONFIRMATION DIALOG */}
            <Dialog open={!!pendingAction} onOpenChange={(open) => !open && setPendingAction(null)}>
                <DialogContent className="sm:max-w-[420px] bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800">
                    <DialogHeader>
                        <DialogTitle className="text-slate-900 dark:text-white">
                            {pendingAction?.type === 'reativar' ? 'Reativar Membro' : 'Desligar Membro'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        {pendingAction?.type === 'reativar' ? (
                            <p className="text-sm border-l-4 border-emerald-500 pl-4 py-1 text-slate-500 dark:text-slate-400">
                                Tem certeza que deseja <strong>REATIVAR</strong> <span className="font-bold text-slate-900 dark:text-white">{pendingAction?.name}</span>? A conta volta a ter acesso ao portal e os saldos de milhas, pontos e PIPJ voltam a circular normalmente.
                            </p>
                        ) : (
                            <p className="text-sm border-l-4 border-rose-500 pl-4 py-1 text-slate-500 dark:text-slate-400">
                                Tem certeza que deseja <strong>DESLIGAR</strong> <span className="font-bold text-slate-900 dark:text-white">{pendingAction?.name}</span>? O acesso ao portal é bloqueado imediatamente. As milhas, pontos e PIPJ ficam retidos (fora de circulação), mas continuam vinculados à conta e podem ser recuperados reativando o membro depois.
                            </p>
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setPendingAction(null)} className="dark:border-white/10 dark:text-slate-300">
                            Cancelar
                        </Button>
                        <Button
                            onClick={handleConfirmAction}
                            disabled={processing}
                            className={pendingAction?.type === 'reativar'
                                ? "bg-emerald-500 hover:bg-emerald-600 text-white border-none"
                                : "bg-rose-500 hover:bg-rose-600 text-white border-none"}
                        >
                            {processing ? 'Processando...' : pendingAction?.type === 'reativar' ? 'Sim, Reativar' : 'Sim, Desligar'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* EDIT USER ACCESS DIALOG */}
            {userToEdit && (
                <EditUserAccessDialog
                    open={!!userToEdit}
                    onOpenChange={(open) => !open && setUserToEdit(null)}
                    colaborador={userToEdit}
                    userRole={userToEdit.users?.[0]?.role}
                    onSave={(updatedData, newRole) => {
                        setColaboradores(prev => prev.map(c => {
                            if (c.id !== userToEdit.id) return c

                            // Handle milhas_saldo update specifically
                            const updatedMilhasSaldo = updatedData.saldo_milhas !== undefined
                                ? [{ saldo_disponivel: updatedData.saldo_milhas }]
                                : c.milhas_saldo;

                            // Remove saldo_milhas from updatedData to not pollute c
                            const { saldo_milhas, ...restUpdatedData } = updatedData;

                            return {
                                ...c,
                                ...restUpdatedData,
                                milhas_saldo: updatedMilhasSaldo,
                                users: [{ ...c.users?.[0], role: newRole }],
                            }
                        }))
                    }}
                />
            )}
        </Card>
    )
}
