"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, Users, Clock } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface Ausencia {
    id: string
    colaborador_id: string
    localizacao: string
    data_ida: string
    data_volta: string
    justificativa: string
    status: string
    created_at: string
    colaboradores: {
        nome: string
        cargo_atual: string
        nucleo_atual: string
    }
}

// Color palette for different members
const MEMBER_COLORS = [
    'bg-blue-500', 'bg-emerald-500', 'bg-purple-500', 'bg-amber-500',
    'bg-rose-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-orange-500',
    'bg-teal-500', 'bg-pink-500', 'bg-lime-500', 'bg-fuchsia-500',
    'bg-sky-500', 'bg-red-500', 'bg-green-500', 'bg-violet-500',
]

const MEMBER_COLORS_LIGHT = [
    'bg-blue-400/30', 'bg-emerald-400/30', 'bg-purple-400/30', 'bg-amber-400/30',
    'bg-rose-400/30', 'bg-cyan-400/30', 'bg-indigo-400/30', 'bg-orange-400/30',
    'bg-teal-400/30', 'bg-pink-400/30', 'bg-lime-400/30', 'bg-fuchsia-400/30',
    'bg-sky-400/30', 'bg-red-400/30', 'bg-green-400/30', 'bg-violet-400/30',
]

function formatDate(dateStr: string) {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR')
}

function getDaysBetween(start: string, end: string) {
    const s = new Date(start + 'T12:00:00')
    const e = new Date(end + 'T12:00:00')
    return Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1
}

export default function AbsencesManagementPage() {
    const [ausencias, setAusencias] = useState<Ausencia[]>([])
    const [loading, setLoading] = useState(true)
    const [currentMonth, setCurrentMonth] = useState(new Date())

    useEffect(() => {
        fetchAusencias()
    }, [])

    async function fetchAusencias() {
        const { data, error } = await supabase
            .from('ausencias')
            .select('*, colaboradores(nome, cargo_atual, nucleo_atual)')
            .order('data_ida', { ascending: true })

        if (!error && data) {
            setAusencias(data as Ausencia[])
        }
        setLoading(false)
    }

    // Build member color map
    const memberColorMap = useMemo(() => {
        const map = new Map<string, number>()
        const uniqueIds = [...new Set(ausencias.map(a => a.colaborador_id))]
        uniqueIds.forEach((id, i) => { map.set(id, i % MEMBER_COLORS.length) })
        return map
    }, [ausencias])

    // Calendar logic
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDayOfWeek = new Date(year, month, 1).getDay()
    const monthName = currentMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

    // Build calendar cells
    const calendarDays = useMemo(() => {
        const days: (number | null)[] = []
        // Empty cells before first day
        for (let i = 0; i < firstDayOfWeek; i++) days.push(null)
        for (let d = 1; d <= daysInMonth; d++) days.push(d)
        return days
    }, [firstDayOfWeek, daysInMonth])

    // Map: dateStr -> list of ausencias that cover that date
    const dateAusenciaMap = useMemo(() => {
        const map = new Map<string, Ausencia[]>()
        ausencias.forEach(a => {
            const start = new Date(a.data_ida + 'T12:00:00')
            const end = new Date(a.data_volta + 'T12:00:00')
            for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
                const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
                if (!map.has(key)) map.set(key, [])
                map.get(key)!.push(a)
            }
        })
        return map
    }, [ausencias])

    function prevMonth() {
        setCurrentMonth(new Date(year, month - 1, 1))
    }
    function nextMonth() {
        setCurrentMonth(new Date(year, month + 1, 1))
    }

    // Stats
    const totalAusencias = ausencias.length
    const ausenciasAtivas = ausencias.filter(a => new Date(a.data_volta + 'T12:00:00') >= new Date()).length
    const membrosAusentes = new Set(
        ausencias
            .filter(a => {
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                return new Date(a.data_ida + 'T00:00:00') <= today && new Date(a.data_volta + 'T23:59:59') >= today
            })
            .map(a => a.colaborador_id)
    ).size

    const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold font-display tracking-tight">Gestão de Ausências</h1>
                <p className="text-muted-foreground mt-1">Acompanhe todas as ausências e viagens dos colaboradores</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                            <CalendarDays className="h-6 w-6 text-blue-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Total de Ausências</p>
                            <p className="text-2xl font-bold">{totalAusencias}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                            <Clock className="h-6 w-6 text-amber-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Ausências Futuras/Ativas</p>
                            <p className="text-2xl font-bold">{ausenciasAtivas}</p>
                        </div>
                    </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
                    <CardContent className="p-5 flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-rose-500/10 flex items-center justify-center">
                            <Users className="h-6 w-6 text-rose-500" />
                        </div>
                        <div>
                            <p className="text-sm text-muted-foreground">Ausentes Hoje</p>
                            <p className="text-2xl font-bold">{membrosAusentes}</p>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Calendar */}
            <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
                <CardHeader className="border-b border-slate-50 dark:border-slate-800/50 pb-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-lg font-display flex items-center gap-2">
                            <CalendarDays className="h-5 w-5" />
                            Calendário de Ausências
                        </CardTitle>
                        <div className="flex items-center gap-2">
                            <Button variant="outline" size="icon" onClick={prevMonth} className="h-8 w-8">
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-sm font-semibold min-w-[160px] text-center capitalize">{monthName}</span>
                            <Button variant="outline" size="icon" onClick={nextMonth} className="h-8 w-8">
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-4">
                    <TooltipProvider delayDuration={200}>
                        {/* Weekday headers */}
                        <div className="grid grid-cols-7 mb-2">
                            {weekdays.map(d => (
                                <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-2">{d}</div>
                            ))}
                        </div>
                        {/* Calendar grid */}
                        <div className="grid grid-cols-7 gap-1">
                            {calendarDays.map((day, i) => {
                                if (day === null) return <div key={`empty-${i}`} className="min-h-[72px]" />

                                const dateKey = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                                const dayAusencias = dateAusenciaMap.get(dateKey) || []
                                const isToday =
                                    new Date().getDate() === day &&
                                    new Date().getMonth() === month &&
                                    new Date().getFullYear() === year
                                const isWeekend = (firstDayOfWeek + day - 1) % 7 === 0 || (firstDayOfWeek + day - 1) % 7 === 6

                                return (
                                    <div
                                        key={day}
                                        className={`min-h-[72px] rounded-lg border p-1 transition-colors
                                            ${isToday ? 'border-primary bg-primary/5 dark:bg-primary/10' : 'border-slate-100 dark:border-slate-800'}
                                            ${isWeekend ? 'bg-slate-50/50 dark:bg-slate-900/30' : 'bg-white dark:bg-transparent'}
                                        `}
                                    >
                                        <div className={`text-xs font-medium mb-1 px-1 ${isToday ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                                            {day}
                                        </div>
                                        <div className="space-y-0.5">
                                            {dayAusencias.slice(0, 3).map((a) => {
                                                const colorIdx = memberColorMap.get(a.colaborador_id) || 0
                                                const firstName = a.colaboradores?.nome?.split(' ')[0] || '?'
                                                return (
                                                    <Tooltip key={a.id}>
                                                        <TooltipTrigger asChild>
                                                            <div className={`text-[10px] font-medium truncate rounded px-1 py-0.5 text-white cursor-default ${MEMBER_COLORS[colorIdx]}`}>
                                                                {firstName}
                                                            </div>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="top" className="max-w-[220px]">
                                                            <p className="font-bold">{a.colaboradores?.nome}</p>
                                                            <p className="text-xs">{a.localizacao}</p>
                                                            <p className="text-xs text-muted-foreground">{formatDate(a.data_ida)} → {formatDate(a.data_volta)}</p>
                                                        </TooltipContent>
                                                    </Tooltip>
                                                )
                                            })}
                                            {dayAusencias.length > 3 && (
                                                <div className="text-[10px] text-muted-foreground px-1">+{dayAusencias.length - 3}</div>
                                            )}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </TooltipProvider>

                    {/* Legend */}
                    <div className="mt-4 flex flex-wrap gap-2 pt-3 border-t border-slate-100 dark:border-slate-800">
                        {[...new Set(ausencias.map(a => a.colaborador_id))].map(id => {
                            const a = ausencias.find(x => x.colaborador_id === id)!
                            const colorIdx = memberColorMap.get(id) || 0
                            return (
                                <div key={id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <div className={`h-2.5 w-2.5 rounded-sm ${MEMBER_COLORS[colorIdx]}`} />
                                    {a.colaboradores?.nome?.split(' ').slice(0, 2).join(' ')}
                                </div>
                            )
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* Report Table */}
            <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
                <CardHeader className="border-b border-slate-50 dark:border-slate-800/50 pb-4">
                    <CardTitle className="text-lg font-display flex items-center gap-2">
                        <MapPin className="h-5 w-5" />
                        Relatório de Ausências
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    {loading ? (
                        <div className="p-8 text-center text-muted-foreground">Carregando...</div>
                    ) : ausencias.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">Nenhuma ausência registrada.</div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-slate-50/50 dark:bg-slate-800/30">
                                    <TableHead className="font-bold">Colaborador</TableHead>
                                    <TableHead className="font-bold">Cargo</TableHead>
                                    <TableHead className="font-bold">Localização</TableHead>
                                    <TableHead className="font-bold">Ida</TableHead>
                                    <TableHead className="font-bold">Volta</TableHead>
                                    <TableHead className="font-bold">Dias</TableHead>
                                    <TableHead className="font-bold">Justificativa</TableHead>
                                    <TableHead className="font-bold">Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ausencias.map((a) => {
                                    const days = getDaysBetween(a.data_ida, a.data_volta)
                                    const today = new Date()
                                    today.setHours(0, 0, 0, 0)
                                    const isActive = new Date(a.data_ida + 'T00:00:00') <= today && new Date(a.data_volta + 'T23:59:59') >= today
                                    const isFuture = new Date(a.data_ida + 'T00:00:00') > today
                                    const isPast = new Date(a.data_volta + 'T23:59:59') < today

                                    return (
                                        <TableRow key={a.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                                            <TableCell className="font-semibold">{a.colaboradores?.nome}</TableCell>
                                            <TableCell className="text-muted-foreground text-sm">{a.colaboradores?.cargo_atual}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1.5">
                                                    <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                                                    {a.localizacao}
                                                </div>
                                            </TableCell>
                                            <TableCell>{formatDate(a.data_ida)}</TableCell>
                                            <TableCell>{formatDate(a.data_volta)}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-mono">{days}d</Badge>
                                            </TableCell>
                                            <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{a.justificativa}</TableCell>
                                            <TableCell>
                                                {isActive && <Badge className="bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-800">Ausente</Badge>}
                                                {isFuture && <Badge className="bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-800">Agendada</Badge>}
                                                {isPast && <Badge className="bg-slate-500/10 text-slate-500 border-slate-200 dark:border-slate-700">Concluída</Badge>}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
