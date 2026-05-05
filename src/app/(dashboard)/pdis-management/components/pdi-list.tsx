"use client"
import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Progress } from "@/components/ui/progress"
import { supabase } from "@/lib/supabase"
import Link from "next/link"
import { MoreHorizontal, Eye, Pencil, Trash2, Copy, Search, Filter, CalendarDays, X } from "lucide-react"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
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
    const [searchName, setSearchName] = useState("")
    const [searchTitulo, setSearchTitulo] = useState("")
    const [filterDateFrom, setFilterDateFrom] = useState("")
    const [filterDateTo, setFilterDateTo] = useState("")
    const [showFilters, setShowFilters] = useState(false)

    const fetchPDIs = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('pdi_planos')
            .select(`
                id,
                colaborador_id,
                titulo,
                descricao,
                observacao_interna,
                status,
                progresso,
                data_inicio,
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

    const filteredPlans = plans.filter(plan => {
        const matchName = !searchName || (plan.colaboradores?.nome || '').toLowerCase().includes(searchName.toLowerCase())
        const matchTitulo = !searchTitulo || (plan.titulo || '').toLowerCase().includes(searchTitulo.toLowerCase())
        
        let matchDate = true
        if (filterDateFrom || filterDateTo) {
            if (!plan.data_prazo) {
                matchDate = false
            } else {
                const prazo = new Date(plan.data_prazo)
                if (filterDateFrom && prazo < new Date(filterDateFrom)) matchDate = false
                if (filterDateTo && prazo > new Date(filterDateTo + 'T23:59:59')) matchDate = false
            }
        }
        
        return matchName && matchTitulo && matchDate
    })

    const hasActiveFilters = searchName || searchTitulo || filterDateFrom || filterDateTo

    const clearFilters = () => {
        setSearchName("")
        setSearchTitulo("")
        setFilterDateFrom("")
        setFilterDateTo("")
    }

    if (loading) {
        return <div className="animate-pulse space-y-4">
            {[1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 rounded-xl" />)}
        </div>
    }

    return (
        <div className="space-y-4">
            {/* Search and Filter Bar */}
            <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por nome do colaborador..."
                            value={searchName}
                            onChange={(e) => setSearchName(e.target.value)}
                            className="pl-9 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 h-10 rounded-xl"
                        />
                    </div>
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por título do PDI..."
                            value={searchTitulo}
                            onChange={(e) => setSearchTitulo(e.target.value)}
                            className="pl-9 bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 h-10 rounded-xl"
                        />
                    </div>
                    <Button
                        variant="outline"
                        onClick={() => setShowFilters(!showFilters)}
                        className={`h-10 rounded-xl px-4 border-slate-200 dark:border-white/10 flex items-center gap-2 shrink-0 ${showFilters ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-200 dark:border-cyan-500/20' : ''}`}
                    >
                        <Filter className="h-4 w-4" />
                        Filtros
                        {hasActiveFilters && (
                            <span className="bg-cyan-500 text-white text-[10px] font-bold h-4 w-4 rounded-full flex items-center justify-center">!</span>
                        )}
                    </Button>
                    {hasActiveFilters && (
                        <Button
                            variant="ghost"
                            onClick={clearFilters}
                            className="h-10 rounded-xl px-3 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 shrink-0"
                        >
                            <X className="h-4 w-4 mr-1" />
                            Limpar
                        </Button>
                    )}
                </div>

                {showFilters && (
                    <div className="flex flex-col sm:flex-row gap-3 p-4 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-100 dark:border-white/10 animate-in slide-in-from-top-2 duration-200">
                        <div className="flex-1 space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <CalendarDays className="h-3 w-3" />
                                Prazo de Finalização (De)
                            </label>
                            <Input
                                type="date"
                                value={filterDateFrom}
                                onChange={(e) => setFilterDateFrom(e.target.value)}
                                className="bg-white dark:bg-[#0f172a] border-slate-200 dark:border-white/10 h-9 rounded-lg text-sm"
                            />
                        </div>
                        <div className="flex-1 space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                                <CalendarDays className="h-3 w-3" />
                                Prazo de Finalização (Até)
                            </label>
                            <Input
                                type="date"
                                value={filterDateTo}
                                onChange={(e) => setFilterDateTo(e.target.value)}
                                className="bg-white dark:bg-[#0f172a] border-slate-200 dark:border-white/10 h-9 rounded-lg text-sm"
                            />
                        </div>
                    </div>
                )}
            </div>

            <Table>
                <TableHeader>
                    <TableRow className="border-slate-100 dark:border-slate-800 hover:bg-transparent">
                        <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider h-11">Piloto</TableHead>
                        <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider h-11">Título do PDI</TableHead>
                        <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider h-11 w-1/4">Progresso do PDI</TableHead>
                        <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider h-11">Status</TableHead>
                        <TableHead className="text-xs font-bold text-slate-500 uppercase tracking-wider h-11 text-right">Ação</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredPlans.length > 0 ? filteredPlans.map((plan) => {
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
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-sm text-cyan-600 dark:text-cyan-400 font-medium">{plan.titulo || 'Sem título'}</span>
                                        {plan.data_prazo && (
                                            <span className="text-[10px] text-slate-400">
                                                Prazo: {new Date(plan.data_prazo).toLocaleDateString('pt-BR')}
                                            </span>
                                        )}
                                    </div>
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
                                {hasActiveFilters ? 'Nenhum plano encontrado com os filtros aplicados.' : 'Nenhum plano de desenvolvimento encontrado.'}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
