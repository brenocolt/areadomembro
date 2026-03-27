"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { CheckCircle2, History, Plus, Pencil, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"

export function InfoRow() {
    const { colaborador, loading } = useColaborador()

    if (loading) return <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{[...Array(4)].map((_, i) => <Card key={i} className="h-20 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-xl" />)}</div>

    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <Card className="p-4 border shadow-sm rounded-xl bg-white dark:bg-[#0f172a] dark:border-none">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Safra</span>
                <span className="font-bold text-lg font-display text-slate-900 dark:text-white">{colaborador?.safra}</span>
            </Card>
            <Card className="p-4 border shadow-sm rounded-xl bg-white dark:bg-[#0f172a] dark:border-none">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Semestre de Ingresso</span>
                <span className="font-bold text-lg font-display text-slate-900 dark:text-white">{colaborador?.semestre_ingresso}</span>
            </Card>
            <Card className="p-4 border shadow-sm rounded-xl bg-white dark:bg-[#0f172a] dark:border-none">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Núcleo Atual</span>
                <span className="font-bold text-lg font-display text-slate-900 dark:text-white">{colaborador?.nucleo_atual}</span>
            </Card>
            <Card className="p-4 border shadow-sm rounded-xl bg-white dark:bg-[#0f172a] dark:border-none">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">Cargo Atual</span>
                <span className="font-bold text-lg font-display text-slate-900 dark:text-white">{colaborador?.cargo_atual}</span>
            </Card>
        </div>
    )
}

export function HistoryTables() {
    const { colaboradorId } = useColaborador()
    const [cargos, setCargos] = useState<any[]>([])
    const [projetos, setProjetos] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    // Cargos Form State
    const [cargoOpen, setCargoOpen] = useState(false)
    const [editingCargo, setEditingCargo] = useState<any>(null)
    const [cargoData, setCargoData] = useState({ cargo: '', semestre_inicio: '', semestre_fim: '' })
    const [savingCargo, setSavingCargo] = useState(false)

    // Projetos Form State
    const [projetoOpen, setProjetoOpen] = useState(false)
    const [editingProjeto, setEditingProjeto] = useState<any>(null)
    const [projetoData, setProjetoData] = useState({ empresa: '', servico: '', duracao_dias: '', semestres: '' })
    const [savingProjeto, setSavingProjeto] = useState(false)

    // Deletion states
    const [cargoToDelete, setCargoToDelete] = useState<string | null>(null)
    const [projetoToDelete, setProjetoToDelete] = useState<string | null>(null)

    useEffect(() => {
        if (!colaboradorId) return;

        async function fetchAll() {
            const [cargosRes, projetosRes] = await Promise.all([
                supabase.from('historico_cargos').select('*').eq('colaborador_id', colaboradorId).order('semestre_inicio', { ascending: false }),
                supabase.from('projetos_finalizados').select('*').eq('colaborador_id', colaboradorId).order('created_at', { ascending: false })
            ])
            if (cargosRes.data) setCargos(cargosRes.data)
            if (projetosRes.data) setProjetos(projetosRes.data)
            setLoading(false)
        }
        fetchAll()
    }, [colaboradorId])

    const saveCargo = async () => {
        if (!colaboradorId || !cargoData.cargo || !cargoData.semestre_inicio) return;
        setSavingCargo(true)
        if (editingCargo) {
            const { data } = await supabase.from('historico_cargos').update(cargoData).eq('id', editingCargo.id).select().single()
            if (data) setCargos(cargos.map(c => c.id === data.id ? data : c))
        } else {
            const { data } = await supabase.from('historico_cargos').insert({ ...cargoData, colaborador_id: colaboradorId }).select().single()
            if (data) setCargos([data, ...cargos])
        }
        setSavingCargo(false)
        setCargoOpen(false)
    }

    const deleteCargo = async () => {
        if (!cargoToDelete) return;
        const { error } = await supabase.from('historico_cargos').delete().eq('id', cargoToDelete)
        if (error) {
            alert('Erro ao excluir cargo: ' + error.message)
        } else {
            setCargos(cargos.filter(c => c.id !== cargoToDelete))
        }
        setCargoToDelete(null)
    }

    const saveProjeto = async () => {
        if (!colaboradorId || !projetoData.empresa || !projetoData.servico) return;
        setSavingProjeto(true)
        const payload = { ...projetoData, duracao_dias: projetoData.duracao_dias ? parseInt(projetoData.duracao_dias) : 0 }

        if (editingProjeto) {
            const { data } = await supabase.from('projetos_finalizados').update(payload).eq('id', editingProjeto.id).select().single()
            if (data) setProjetos(projetos.map(p => p.id === data.id ? data : p))
        } else {
            const { data } = await supabase.from('projetos_finalizados').insert({ ...payload, colaborador_id: colaboradorId }).select().single()
            if (data) setProjetos([data, ...projetos])
        }
        setSavingProjeto(false)
        setProjetoOpen(false)
    }

    const deleteProjeto = async () => {
        if (!projetoToDelete) return;
        const { error } = await supabase.from('projetos_finalizados').delete().eq('id', projetoToDelete)
        if (error) {
            alert('Erro ao excluir projeto: ' + error.message)
        } else {
            setProjetos(projetos.filter(p => p.id !== projetoToDelete))
        }
        setProjetoToDelete(null)
    }

    const openCargoDialog = (cargo: any = null) => {
        setEditingCargo(cargo)
        setCargoData(cargo || { cargo: '', semestre_inicio: '', semestre_fim: '' })
        setCargoOpen(true)
    }

    const openProjetoDialog = (projeto: any = null) => {
        setEditingProjeto(projeto)
        setProjetoData(projeto ? { ...projeto, duracao_dias: String(projeto.duracao_dias) } : { empresa: '', servico: '', duracao_dias: '', semestres: '' })
        setProjetoOpen(true)
    }

    return (
        <div className="space-y-6">
            {/* CARGOS TABLE */}
            <div className="bg-white dark:bg-[#0F172A] rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="bg-[#001a41] px-4 py-3 flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                        <History className="h-4 w-4" /> Histórico de Cargos
                    </h3>
                    <Button onClick={() => openCargoDialog()} size="sm" variant="ghost" className="h-7 text-white/70 hover:text-white hover:bg-white/10 px-2 text-xs">
                        <Plus className="h-3 w-3 mr-1" /> Adicionar
                    </Button>
                </div>
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                        <TableRow className="hover:bg-transparent border-b-slate-100 dark:border-b-slate-800">
                            <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9">Cargo</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9">Semestre Início</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9">Semestre Fim</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9 text-right w-[100px]">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!loading && cargos.length > 0 ? cargos.map((c: any) => (
                            <TableRow key={c.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 border-b-slate-100 dark:border-b-slate-800 transition-colors">
                                <TableCell className="font-bold text-xs text-slate-900 dark:text-white">{c.cargo}</TableCell>
                                <TableCell className="font-medium text-xs text-slate-600 dark:text-slate-300">{c.semestre_inicio}</TableCell>
                                <TableCell className="text-xs italic text-slate-400">{c.semestre_fim || 'Atual'}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-primary" onClick={() => openCargoDialog(c)}>
                                            <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-rose-500" onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            setCargoToDelete(c.id)
                                        }}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={4} className="text-center text-xs text-slate-400 italic py-4">Nenhum histórico registrado</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* PROJETOS TABLE */}
            <div className="bg-white dark:bg-[#0F172A] rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 overflow-hidden">
                <div className="bg-[#001a41] px-4 py-3 flex items-center justify-between">
                    <h3 className="text-white font-bold text-sm uppercase tracking-wider flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" /> Projetos Finalizados
                    </h3>
                    <Button onClick={() => openProjetoDialog()} size="sm" variant="ghost" className="h-7 text-white/70 hover:text-white hover:bg-white/10 px-2 text-xs">
                        <Plus className="h-3 w-3 mr-1" /> Adicionar
                    </Button>
                </div>
                <Table>
                    <TableHeader className="bg-slate-50 dark:bg-slate-900/50">
                        <TableRow className="hover:bg-transparent border-b-slate-100 dark:border-b-slate-800">
                            <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9">Empresa</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9">Serviço</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9">Duração (Dias)</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9">Semestre(s)</TableHead>
                            <TableHead className="text-[10px] font-bold uppercase text-slate-500 h-9 text-right w-[100px]">Ações</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {!loading && projetos.length > 0 ? projetos.map((p: any) => (
                            <TableRow key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 border-b-slate-100 dark:border-b-slate-800 transition-colors">
                                <TableCell className="font-bold text-xs text-slate-900 dark:text-white">{p.empresa}</TableCell>
                                <TableCell className="text-xs text-slate-600 dark:text-slate-300">{p.servico}</TableCell>
                                <TableCell className="text-xs text-slate-600 dark:text-slate-300">{p.duracao_dias}</TableCell>
                                <TableCell className="text-xs text-slate-600 dark:text-slate-300">{p.semestres}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-primary" onClick={() => openProjetoDialog(p)}>
                                            <Pencil className="h-3 w-3" />
                                        </Button>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 text-slate-400 hover:text-rose-500" onClick={(e) => {
                                            e.preventDefault()
                                            e.stopPropagation()
                                            setProjetoToDelete(p.id)
                                        }}>
                                            <Trash2 className="h-3 w-3" />
                                        </Button>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow><TableCell colSpan={5} className="text-center text-xs text-slate-400 italic py-8">Aguardando finalização do primeiro projeto</TableCell></TableRow>
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* DIALOG DE CARGOS */}
            <Dialog open={cargoOpen} onOpenChange={setCargoOpen}>
                <DialogContent className="sm:max-w-[425px] bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800">
                    <DialogHeader>
                        <DialogTitle className="text-slate-900 dark:text-white">{editingCargo ? 'Editar Cargo' : 'Adicionar Cargo'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="cargo" className="text-slate-700 dark:text-slate-300">Cargo</Label>
                            <Input id="cargo" value={cargoData.cargo} onChange={e => setCargoData({ ...cargoData, cargo: e.target.value })} placeholder="Ex: Consultor de Projetos" className="bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="sem-inicio" className="text-slate-700 dark:text-slate-300">Semestre Início</Label>
                                <Input id="sem-inicio" value={cargoData.semestre_inicio} onChange={e => setCargoData({ ...cargoData, semestre_inicio: e.target.value })} placeholder="Ex: 2023.1" className="bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="sem-fim" className="text-slate-700 dark:text-slate-300">Semestre Fim</Label>
                                <Input id="sem-fim" value={cargoData.semestre_fim || ''} onChange={e => setCargoData({ ...cargoData, semestre_fim: e.target.value })} placeholder="Ex: 2023.2 (Vazio se atual)" className="bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10" />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setCargoOpen(false)} className="dark:border-white/10 dark:text-slate-300">Cancelar</Button>
                        <Button onClick={saveCargo} disabled={savingCargo} className="bg-primary hover:bg-primary/90 text-white">
                            {savingCargo ? 'Salvando...' : 'Salvar Cargo'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* DIALOG DE PROJETOS */}
            <Dialog open={projetoOpen} onOpenChange={setProjetoOpen}>
                <DialogContent className="sm:max-w-[425px] bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800">
                    <DialogHeader>
                        <DialogTitle className="text-slate-900 dark:text-white">{editingProjeto ? 'Editar Projeto' : 'Adicionar Projeto'}</DialogTitle>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label htmlFor="empresa" className="text-slate-700 dark:text-slate-300">Nome da Empresa / Cliente</Label>
                            <Input id="empresa" value={projetoData.empresa} onChange={e => setProjetoData({ ...projetoData, empresa: e.target.value })} placeholder="Ex: Nome da Empresa" className="bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10" />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="servico" className="text-slate-700 dark:text-slate-300">Serviço Prestado</Label>
                            <Input id="servico" value={projetoData.servico} onChange={e => setProjetoData({ ...projetoData, servico: e.target.value })} placeholder="Ex: Consultoria" className="bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="grid gap-2">
                                <Label htmlFor="duracao" className="text-slate-700 dark:text-slate-300">Duração (Dias)</Label>
                                <Input id="duracao" type="number" value={projetoData.duracao_dias} onChange={e => setProjetoData({ ...projetoData, duracao_dias: e.target.value })} placeholder="Ex: 45" className="bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10" />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="semestres" className="text-slate-700 dark:text-slate-300">Semestre(s)</Label>
                                <Input id="semestres" value={projetoData.semestres} onChange={e => setProjetoData({ ...projetoData, semestres: e.target.value })} placeholder="Ex: 2023.2" className="bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10" />
                            </div>
                        </div>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setProjetoOpen(false)} className="dark:border-white/10 dark:text-slate-300">Cancelar</Button>
                        <Button onClick={saveProjeto} disabled={savingProjeto} className="bg-primary hover:bg-primary/90 text-white">
                            {savingProjeto ? 'Salvando...' : 'Salvar Projeto'}
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
            {/* DELETE CARGO DIALOG */}
            <Dialog open={!!cargoToDelete} onOpenChange={(open) => !open && setCargoToDelete(null)}>
                <DialogContent className="sm:max-w-[400px] bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800">
                    <DialogHeader>
                        <DialogTitle className="text-slate-900 dark:text-white">Excluir Cargo</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm border-l-4 border-rose-500 pl-4 py-1 text-slate-500 dark:text-slate-400">
                            Tem certeza que deseja excluir este cargo do seu histórico? Esta ação é permanente e não pode ser desfeita.
                        </p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setCargoToDelete(null)} className="dark:border-white/10 dark:text-slate-300">
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={deleteCargo} className="bg-rose-500 hover:bg-rose-600 text-white border-none">
                            Sim, Excluir
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* DELETE PROJETO DIALOG */}
            <Dialog open={!!projetoToDelete} onOpenChange={(open) => !open && setProjetoToDelete(null)}>
                <DialogContent className="sm:max-w-[400px] bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800">
                    <DialogHeader>
                        <DialogTitle className="text-slate-900 dark:text-white">Excluir Projeto</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm border-l-4 border-rose-500 pl-4 py-1 text-slate-500 dark:text-slate-400">
                            Tem certeza que deseja excluir este projeto finalizado? Esta ação é permanente e não pode ser desfeita.
                        </p>
                    </div>
                    <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setProjetoToDelete(null)} className="dark:border-white/10 dark:text-slate-300">
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={deleteProjeto} className="bg-rose-500 hover:bg-rose-600 text-white border-none">
                            Sim, Excluir
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    )
}
