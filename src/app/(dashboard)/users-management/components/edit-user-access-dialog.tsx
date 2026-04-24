"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { supabase } from "@/lib/supabase"
import { Loader2, Shield, UserCog, History } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserAuditLog } from "./user-audit-log"
import { useSession } from "next-auth/react"

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
    { label: "Gestão de Alocações", path: "/allocations-management" },
]

interface EditUserAccessDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    colaborador: any
    userRole?: string
}

const EDITABLE_FIELDS = [
    { key: 'nome', label: 'Nome', type: 'text' },
    { key: 'cargo_atual', label: 'Cargo', type: 'text' },
    { key: 'nucleo_atual', label: 'Núcleo', type: 'text' },
    { key: 'matricula', label: 'Matrícula', type: 'text' },
    { key: 'email_corporativo', label: 'Email Corporativo', type: 'email' },
    { key: 'telefone', label: 'Telefone', type: 'text' },
    { key: 'pontos_negativos', label: 'Pontos Negativos', type: 'number' },
    { key: 'saldo_pipj', label: 'Saldo PIPJ (R$)', type: 'number' },
]

export function EditUserAccessDialog({ open, onOpenChange, colaborador, userRole }: EditUserAccessDialogProps) {
    const { data: session } = useSession()
    const [selectedPages, setSelectedPages] = useState<string[]>([])
    const [saving, setSaving] = useState(false)
    const [role, setRole] = useState(userRole || 'COLABORADOR')
    const [formData, setFormData] = useState<Record<string, any>>({})

    useEffect(() => {
        if (open && colaborador) {
            // Initialize form data from colaborador
            const data: Record<string, any> = {}
            EDITABLE_FIELDS.forEach(field => {
                data[field.key] = colaborador[field.key] ?? ''
            })
            setFormData(data)

            // Pages
            if (colaborador.paginas_permitidas && colaborador.paginas_permitidas.length > 0) {
                setSelectedPages([...colaborador.paginas_permitidas])
            } else {
                setSelectedPages(ALL_PAGES.map(p => p.path))
            }
            setRole(userRole || 'COLABORADOR')
        }
    }, [open, colaborador, userRole])

    function updateField(key: string, value: any) {
        setFormData(prev => ({ ...prev, [key]: value }))
    }

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
            const editorName = (session?.user as any)?.name || (session?.user as any)?.email || 'Sistema'
            const auditLogs: { campo: string; valor_antigo: string; valor_novo: string }[] = []

            // Build update object and detect changes
            const updateObj: Record<string, any> = { paginas_permitidas: selectedPages }

            EDITABLE_FIELDS.forEach(field => {
                const oldVal = colaborador[field.key]
                const newVal = field.type === 'number' ? Number(formData[field.key]) || 0 : formData[field.key]
                updateObj[field.key] = newVal

                const oldStr = String(oldVal ?? '')
                const newStr = String(newVal ?? '')
                if (oldStr !== newStr) {
                    auditLogs.push({
                        campo: field.key,
                        valor_antigo: oldStr || '—',
                        valor_novo: newStr || '—',
                    })
                }
            })

            // Check pages change
            const oldPages = JSON.stringify(colaborador.paginas_permitidas || [])
            const newPages = JSON.stringify(selectedPages)
            if (oldPages !== newPages) {
                auditLogs.push({
                    campo: 'paginas_permitidas',
                    valor_antigo: colaborador.paginas_permitidas?.length ? `${colaborador.paginas_permitidas.length} páginas` : 'Todas',
                    valor_novo: `${selectedPages.length} páginas`,
                })
            }

            // Update colaboradores
            const { error: colabErr } = await supabase
                .from('colaboradores')
                .update(updateObj)
                .eq('id', colaborador.id)

            if (colabErr) {
                alert("Erro ao salvar: " + colabErr.message)
                return
            }

            // Update user role if changed
            if (role !== userRole) {
                auditLogs.push({
                    campo: 'role',
                    valor_antigo: userRole || '—',
                    valor_novo: role,
                })
                await supabase
                    .from('users')
                    .update({ role: role })
                    .eq('colaborador_id', colaborador.id)
            }

            // Insert audit logs
            if (auditLogs.length > 0) {
                await supabase.from('audit_logs').insert(
                    auditLogs.map(log => ({
                        colaborador_id: colaborador.id,
                        campo: log.campo,
                        valor_antigo: log.valor_antigo,
                        valor_novo: log.valor_novo,
                        editado_por: editorName,
                    }))
                )
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
            <DialogContent className="sm:max-w-[600px] bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-800 max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-slate-900 dark:text-white flex items-center gap-2">
                        <UserCog className="h-5 w-5 text-primary" />
                        Editar — {colaborador?.nome || ''}
                    </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="info" className="w-full">
                    <TabsList className="bg-slate-100 dark:bg-slate-800/50 p-1 rounded-xl w-full">
                        <TabsTrigger value="info" className="flex-1 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white font-semibold text-xs">
                            <UserCog className="h-3.5 w-3.5 mr-1.5" /> Informações
                        </TabsTrigger>
                        <TabsTrigger value="access" className="flex-1 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white font-semibold text-xs">
                            <Shield className="h-3.5 w-3.5 mr-1.5" /> Acesso
                        </TabsTrigger>
                        <TabsTrigger value="log" className="flex-1 rounded-lg data-[state=active]:bg-white dark:data-[state=active]:bg-slate-700 data-[state=active]:text-slate-900 dark:data-[state=active]:text-white font-semibold text-xs">
                            <History className="h-3.5 w-3.5 mr-1.5" /> Histórico
                        </TabsTrigger>
                    </TabsList>

                    {/* INFO TAB */}
                    <TabsContent value="info" className="space-y-4 mt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {EDITABLE_FIELDS.map(field => (
                                <div key={field.key} className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">{field.label}</Label>
                                    <Input
                                        type={field.type}
                                        value={formData[field.key] ?? ''}
                                        onChange={e => updateField(field.key, e.target.value)}
                                        className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-9 text-sm rounded-xl"
                                    />
                                </div>
                            ))}
                        </div>
                    </TabsContent>

                    {/* ACCESS TAB */}
                    <TabsContent value="access" className="space-y-4 mt-4">
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">Permissão</Label>
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
                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Páginas Permitidas</Label>
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
                    </TabsContent>

                    {/* LOG TAB */}
                    <TabsContent value="log" className="mt-4">
                        <UserAuditLog colaboradorId={colaborador?.id || ''} />
                    </TabsContent>
                </Tabs>

                <DialogFooter className="gap-2 mt-4">
                    <Button variant="outline" onClick={() => onOpenChange(false)} className="dark:border-white/10 dark:text-slate-300">
                        Cancelar
                    </Button>
                    <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-white">
                        {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</> : 'Salvar Alterações'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
