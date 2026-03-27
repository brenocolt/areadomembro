"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { supabase } from "@/lib/supabase"
import { Loader2, Shield } from "lucide-react"

const ALL_PAGES = [
    { label: "Início", path: "/" },
    { label: "Perfil", path: "/profile" },
    { label: "Performance", path: "/performance" },
    { label: "NPS Gerente", path: "/nps-gerente" },
    { label: "NPS Projeto", path: "/nps-projeto" },
    { label: "Carteira PIPJ", path: "/wallet" },
    { label: "Meus PDIs", path: "/pdis" },
    { label: "Formulários", path: "/formularios" },
    { label: "Minhas Milhas", path: "/milhas" },
    { label: "Punições", path: "/punishments" },
    { label: "Gestão de PDIs", path: "/pdis-management" },
    { label: "Gestão de Formulários", path: "/forms-management" },
    { label: "Gestão de Pontos", path: "/points-management" },
    { label: "Gestão de Milhas", path: "/miles-management" },
    { label: "Gestão de PIPJ", path: "/pipj-management" },
    { label: "Gestão de Usuários", path: "/users-management" },
    { label: "Gestão de Ausências", path: "/absences-management" },
]

interface EditUserAccessDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    colaborador: {
        id: string
        nome: string
        paginas_permitidas?: string[] | null
    }
    userRole?: string
}

export function EditUserAccessDialog({ open, onOpenChange, colaborador, userRole }: EditUserAccessDialogProps) {
    const [selectedPages, setSelectedPages] = useState<string[]>([])
    const [saving, setSaving] = useState(false)
    const [role, setRole] = useState(userRole || 'COLABORADOR')

    useEffect(() => {
        if (open) {
            // If paginas_permitidas is null/undefined, means all pages (for admin or unset)
            if (colaborador.paginas_permitidas && colaborador.paginas_permitidas.length > 0) {
                setSelectedPages([...colaborador.paginas_permitidas])
            } else {
                // Default: all pages selected
                setSelectedPages(ALL_PAGES.map(p => p.path))
            }
            setRole(userRole || 'COLABORADOR')
        }
    }, [open, colaborador, userRole])

    function togglePage(path: string) {
        setSelectedPages(prev =>
            prev.includes(path)
                ? prev.filter(p => p !== path)
                : [...prev, path]
        )
    }

    function selectAll() {
        setSelectedPages(ALL_PAGES.map(p => p.path))
    }

    function deselectAll() {
        setSelectedPages([])
    }

    async function handleSave() {
        setSaving(true)
        try {
            // Update colaboradores.paginas_permitidas
            const { error: colabErr } = await supabase
                .from('colaboradores')
                .update({ paginas_permitidas: selectedPages })
                .eq('id', colaborador.id)

            if (colabErr) {
                alert("Erro ao salvar: " + colabErr.message)
                return
            }

            // Update user role if changed
            if (role !== userRole) {
                await supabase
                    .from('users')
                    .update({ role: role })
                    .eq('colaborador_id', colaborador.id)
            }

            onOpenChange(false)
        } finally {
            setSaving(false)
        }
    }

    const memberPages = ALL_PAGES.filter(p => !['/pdis-management', '/forms-management', '/points-management', '/miles-management', '/pipj-management', '/users-management', '/absences-management'].includes(p.path))
    const managementPages = ALL_PAGES.filter(p => ['/pdis-management', '/forms-management', '/points-management', '/miles-management', '/pipj-management', '/users-management', '/absences-management'].includes(p.path))

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-slate-900 dark:text-white flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        Editar Acesso — {colaborador.nome}
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    {/* Role selector */}
                    <div>
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">Permissão</label>
                        <select
                            value={role}
                            onChange={e => setRole(e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none"
                        >
                            <option value="COLABORADOR">Colaborador</option>
                            <option value="GESTOR">Gestor</option>
                            <option value="ADMIN">Admin (acesso total)</option>
                        </select>
                    </div>

                    {role !== 'ADMIN' && (
                        <>
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Páginas Permitidas</label>
                                <div className="flex gap-2">
                                    <button onClick={selectAll} className="text-[10px] font-bold text-primary hover:underline">Marcar Todas</button>
                                    <button onClick={deselectAll} className="text-[10px] font-bold text-rose-500 hover:underline">Desmarcar Todas</button>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Membro</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {memberPages.map(page => (
                                            <label key={page.path} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                                <Checkbox
                                                    checked={selectedPages.includes(page.path)}
                                                    onCheckedChange={() => togglePage(page.path)}
                                                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                />
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{page.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Gestão de Pessoas</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        {managementPages.map(page => (
                                            <label key={page.path} className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
                                                <Checkbox
                                                    checked={selectedPages.includes(page.path)}
                                                    onCheckedChange={() => togglePage(page.path)}
                                                    className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                />
                                                <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{page.label}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {role === 'ADMIN' && (
                        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 text-center">
                            <p className="text-sm font-medium text-primary">O perfil Admin tem acesso a todas as páginas automaticamente.</p>
                        </div>
                    )}
                </div>

                <DialogFooter className="gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="dark:border-white/10 dark:text-slate-300">
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-white">
                        {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</> : 'Salvar'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
