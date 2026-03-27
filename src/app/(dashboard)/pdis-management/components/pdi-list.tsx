"use client"
import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { MoreHorizontal, Eye, Pencil, Trash2, Copy } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { EditPdiDialog } from "./edit-pdi-dialog"
import { DeletePdiDialog } from "./delete-pdi-dialog"
import { DuplicatePdiDialog } from "./duplicate-pdi-dialog"

const STATUS_MAP: Record<string, { label: string; className: string }> = {
    'Em Dia': { label: 'Em Dia', className: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
    'Atrasado': { label: 'Atrasado', className: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' },
    'Finalizando': { label: 'Finalizando', className: 'bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400' },
    'Concluído': { label: 'Concluído', className: 'bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-slate-400' },
}

export function PdiList() {
    const [plans, setPlans] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    const fetchPDIs = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('pdi_planos')
            .select(`
                id,
                titulo,
                descricao,
                status,
                progresso,
                data_prazo,
                colaboradores!inner(id, nome, email_corporativo, cargo_atual)
            `)
            .order('created_at', { ascending: false })

        if (data) setPlans(data)
        setLoading(false)
    }

    useEffect(() => {
        fetchPDIs()
    }, [])

    if (loading) {
        return <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl" />)}
        </div>
    }

    return (
        <Table>
            <TableHeader>
                <TableRow className="border-slate-100 dark:border-slate-800 hover:bg-transparent">
                    <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider h-11">Piloto</TableHead>
                    <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider h-11">Cargo</TableHead>
                    <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider h-11 w-1/4">Progresso do PDI</TableHead>
                    <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider h-11">Status</TableHead>
                    <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider h-11 text-right">Ação</TableHead>
                </TableRow>
            </TableHeader>
            <TableBody>
                {plans.length > 0 ? plans.map((plan) => {
                    const progresso = Math.round(plan.progresso || 0)
                    let computedStatus = plan.status || 'Em Dia';
                    if (progresso === 100) {
                        computedStatus = 'Concluído';
                    } else if (plan.data_prazo && new Date(plan.data_prazo) < new Date()) {
                        computedStatus = 'Atrasado';
                    } else if (progresso >= 80) {
                        computedStatus = 'Finalizando';
                    } else {
                        computedStatus = 'Em Dia';
                    }

                    const status = STATUS_MAP[computedStatus] || STATUS_MAP['Em Dia']
                    const initials = (plan.colaboradores?.nome || '??').split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()

                    return (
                        <TableRow key={plan.id} className="border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                            <TableCell className="py-4">
                                <div className="flex items-center gap-3">
                                    <Avatar className="h-10 w-10 border border-slate-100 dark:border-white/10">
                                        <AvatarImage src={`https://ui-avatars.com/api/?name=${encodeURIComponent(plan.colaboradores?.nome || '')}&background=random`} />
                                        <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-bold">
                                            {initials}
                                        </AvatarFallback>
                                    </Avatar>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-sm text-slate-900 dark:text-white capitalize-first">{plan.colaboradores?.nome?.toLowerCase()}</span>
                                        <span className="text-xs text-slate-500">{plan.colaboradores?.email_corporativo}</span>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <span className="text-sm text-cyan-600 dark:text-cyan-400 font-medium">{plan.colaboradores?.cargo_atual || 'Não definido'}</span>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <Progress value={progresso} className="h-2 bg-slate-100 dark:bg-slate-800" indicatorClassName={
                                        progresso === 100 ? "bg-emerald-500" :
                                            computedStatus === 'Atrasado' ? "bg-rose-500" : "bg-cyan-500"
                                    } />
                                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300 w-10 text-right">{progresso}%</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className={`font-bold border-0 ${status.className}`}>
                                    {status.label}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" className="h-8 w-8 p-0 text-slate-500 hover:text-cyan-600">
                                            <span className="sr-only">Abrir menu</span>
                                            <MoreHorizontal className="h-4 w-4" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-xl shadow-xl">
                                        <DropdownMenuLabel className="text-xs font-bold text-slate-400 px-3 py-2 uppercase tracking-wider">Ações</DropdownMenuLabel>
                                        <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />
                                        
                                        <DropdownMenuItem asChild>
                                            <Link href={`/pdis/${plan.id}`} className="flex items-center px-3 py-2 cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors rounded-lg mx-1">
                                                <Eye className="mr-2 h-4 w-4" />
                                                Visualizar Detalhes
                                            </Link>
                                        </DropdownMenuItem>

                                        <EditPdiDialog pdi={plan} onSuccess={fetchPDIs}>
                                            <div className="w-full flex items-center px-3 py-2 cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors rounded-lg mx-1">
                                                <Pencil className="mr-2 h-4 w-4" />
                                                Editar Plano
                                            </div>
                                        </EditPdiDialog>

                                        <DropdownMenuSeparator className="bg-slate-100 dark:bg-slate-800" />

                                        <DuplicatePdiDialog pdi={plan} onSuccess={fetchPDIs}>
                                            <div className="w-full flex items-center px-3 py-2 cursor-pointer text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-cyan-600 dark:hover:text-cyan-400 hover:bg-cyan-50 dark:hover:bg-cyan-900/20 transition-colors rounded-lg mx-1">
                                                <Copy className="mr-2 h-4 w-4" />
                                                Duplicar PDI
                                            </div>
                                        </DuplicatePdiDialog>

                                        <DeletePdiDialog pdi={plan} onSuccess={fetchPDIs}>
                                            <div className="w-full flex items-center px-3 py-2 cursor-pointer text-sm font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-900/20 transition-colors rounded-lg mx-1">
                                                <Trash2 className="mr-2 h-4 w-4" />
                                                Excluir PDI
                                            </div>
                                        </DeletePdiDialog>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </TableCell>
                        </TableRow>
                    )
                }) : (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center py-12 text-slate-500">
                            Nenhum plano de desenvolvimento encontrado.
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
        </Table>
    )
}
