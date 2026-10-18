"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2, Shield, UserCog, History, Lock } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { UserAuditLog } from "./user-audit-log"
import { useSession } from "next-auth/react"
import { CARGOS } from "@/lib/cargos"
import { NUCLEOS } from "@/lib/nucleos"
import { getPaginasPadrao } from "@/lib/access-control"

// Só essa conta pode ter o papel ADMIN — qualquer outra promoção precisa
// passar por aqui manualmente (ver src/lib/access-control.ts).
const EMAIL_UNICO_ADMIN = 'produtivajunior@gmail.com'

// "Perfil" e "Presença em Reuniões" não entram aqui de propósito: /profile e
// /presenca são sempre acessíveis a todo mundo (ver RouteGuard), não
// dependem de páginas permitidas.
const ALL_PAGES = [
    { label: "Início", path: "/" },
    { label: "Minhas Atividades", path: "/minhas-prioridades" },
    { label: "Performance", path: "/performance" },
    { label: "NPS Gerente", path: "/nps-gerente" },
    { label: "Agente de Feedback", path: "/feedback-agente" },
    { label: "Assistente Pessoal", path: "/assistente-pessoal" },
    { label: "Carteira PIPJ", path: "/wallet" },
    { label: "PDI", path: "/pdi" },
    { label: "Formulários", path: "/formularios" },
    { label: "Minhas Milhas", path: "/milhas" },
    { label: "Punições", path: "/punishments" },
    { label: "Gestão de PDI", path: "/pdi-management" },
    { label: "Gestão de Formulários", path: "/forms-management" },
    { label: "Gestão de Pontos", path: "/points-management" },
    { label: "Pontuar Membros", path: "/pontuar-membros" },
    { label: "Gestão de Milhas", path: "/miles-management" },
    { label: "Gestão de PIPJ", path: "/pipj-management" },
    { label: "Gestão de Usuários", path: "/users-management" },
    { label: "Gestão de Ausências", path: "/absences-management" },
    { label: "Gestão de Alocações", path: "/allocations-management" },
    { label: "Gestão de Reuniões", path: "/reunioes-management" },
]

interface EditUserAccessDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    colaborador: any
    userRole?: string
    // Nível de quem está editando em Gestão de Usuários (ver
    // getUsersManagementTier): 1 = dados básicos + desligar, 2 = + cargo,
    // 3 = + role/páginas permitidas e os campos sensíveis abaixo.
    editorTier?: 0 | 1 | 2 | 3
    onSave?: (updatedData: Record<string, any>, newRole: string) => void
}

const EDITABLE_FIELDS = [
    { key: 'nome', label: 'Nome', type: 'text' },
    { key: 'cargo_atual', label: 'Cargo', type: 'select', options: [...CARGOS] },
    { key: 'nucleo_atual', label: 'Núcleo', type: 'select', options: [...NUCLEOS] },
    { key: 'nivel_consultor', label: 'Nível do Consultor', type: 'select', options: ['Júnior', 'Pleno', 'Sênior'] },
    { key: 'matricula', label: 'Matrícula', type: 'text' },
    { key: 'email_corporativo', label: 'Email Corporativo', type: 'email' },
    { key: 'telefone', label: 'Telefone', type: 'text' },
    { key: 'pontos_negativos', label: 'Pontos Negativos', type: 'number' },
    { key: 'saldo_pipj', label: 'Saldo PIPJ (R$)', type: 'number' },
    { key: 'saldo_milhas', label: 'Saldo de Milhas', type: 'number' },
]

export function EditUserAccessDialog({ open, onOpenChange, colaborador, userRole, editorTier = 0, onSave }: EditUserAccessDialogProps) {
    const { data: session } = useSession()
    const podeMudarCargo = editorTier >= 2
    const podeGerenciarAcesso = editorTier >= 3
    const podeEditarCamposSensiveis = editorTier >= 3
    const alvoPodeSerAdmin = (colaborador?.email_corporativo || '').trim().toLowerCase() === EMAIL_UNICO_ADMIN
    // Páginas que o cargo/núcleo já liberam sozinhos — mostradas marcadas e
    // travadas aqui, já que desmarcar uma exceção manual não tira esse
    // acesso (ver src/lib/access-control.ts).
    const paginasPadrao = getPaginasPadrao(colaborador?.cargo_atual, colaborador?.nucleo_atual)
    const [selectedPages, setSelectedPages] = useState<string[]>([])
    const [saving, setSaving] = useState(false)
    const [role, setRole] = useState(userRole || 'COLABORADOR')
    const [formData, setFormData] = useState<Record<string, any>>({})

    useEffect(() => {
        if (open && colaborador) {
            // Initialize form data from colaborador
            const data: Record<string, any> = {}
            EDITABLE_FIELDS.forEach(field => {
                if (field.key === 'saldo_milhas') {
                    const milhasSaldo = colaborador.milhas_saldo
                    data[field.key] = Array.isArray(milhasSaldo) ? (milhasSaldo[0]?.saldo_disponivel ?? 0) : (milhasSaldo?.saldo_disponivel ?? 0)
                } else {
                    data[field.key] = colaborador[field.key] ?? ''
                }
            })
            setFormData(data)

            // Páginas permitidas agora é só a exceção manual, além do que o
            // cargo/núcleo já dá por padrão (ver src/lib/access-control.ts)
            // — não inicializa mais marcando tudo quando está vazio.
            setSelectedPages(colaborador.paginas_permitidas ? [...colaborador.paginas_permitidas] : [])
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
            const auditLogs: { campo: string; valor_antigo: string; valor_novo: string; editado_por: string }[] = []

            // Build update object and detect changes
            const updateObj: Record<string, any> = { paginas_permitidas: selectedPages }

            EDITABLE_FIELDS.forEach(field => {
                let oldVal = colaborador[field.key]
                if (field.key === 'saldo_milhas') {
                    const milhasSaldo = colaborador.milhas_saldo
                    oldVal = Array.isArray(milhasSaldo) ? (milhasSaldo[0]?.saldo_disponivel ?? 0) : (milhasSaldo?.saldo_disponivel ?? 0)
                }
                
                const newVal = field.type === 'number' ? Number(formData[field.key]) || 0 : formData[field.key]
                updateObj[field.key] = newVal

                const oldStr = String(oldVal ?? '')
                const newStr = String(newVal ?? '')
                if (oldStr !== newStr) {
                    auditLogs.push({
                        campo: field.key,
                        valor_antigo: oldStr || '—',
                        valor_novo: newStr || '—',
                        editado_por: editorName,
                    })
                }
            })

            // Check pages change
            const oldPages = JSON.stringify(colaborador.paginas_permitidas || [])
            const newPages = JSON.stringify(selectedPages)
            if (oldPages !== newPages) {
                auditLogs.push({
                    campo: 'paginas_permitidas',
                    valor_antigo: colaborador.paginas_permitidas?.length ? `${colaborador.paginas_permitidas.length} exceções` : 'Nenhuma exceção',
                    valor_novo: selectedPages.length ? `${selectedPages.length} exceções` : 'Nenhuma exceção',
                    editado_por: editorName,
                })
            }

            // Check role change
            if (role !== userRole) {
                auditLogs.push({
                    campo: 'role',
                    valor_antigo: userRole || '—',
                    valor_novo: role,
                    editado_por: editorName,
                })
            }

            // Save via server-side API
            const res = await fetch('/api/colaboradores/update', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    colaboradorId: colaborador.id,
                    updateObj,
                    role,
                    currentRole: userRole,
                    auditLogs,
                }),
            })

            const result = await res.json()
            if (!result.success) {
                alert("Erro ao salvar: " + (result.error || 'Erro desconhecido'))
                return
            }

            // Notify parent of updated data so it can refresh locally
            if (onSave) {
                onSave(updateObj, role)
            }

            onOpenChange(false)
        } finally {
            setSaving(false)
        }
    }

    const memberPages = ALL_PAGES.filter(p => !['/forms-management', '/points-management', '/miles-management', '/pipj-management', '/users-management', '/absences-management'].includes(p.path))
    const managementPages = ALL_PAGES.filter(p => ['/forms-management', '/points-management', '/miles-management', '/pipj-management', '/users-management', '/absences-management'].includes(p.path))

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
                            {EDITABLE_FIELDS.map(field => {
                                // Cargo e Núcleo agora são listas fechadas (dropdown), mas um
                                // registro antigo pode ter um valor fora dela (cargo legado não
                                // migrado, ou núcleo em texto livre — ver src/lib/nucleos.ts).
                                // Nesses casos, mostra o valor real como uma opção extra em vez
                                // de esconder o dado — assim ele só muda se alguém escolher
                                // outra opção explicitamente.
                                const currentValue = formData[field.key]
                                const options = field.type === 'select' && field.options
                                    ? (currentValue && !field.options.includes(currentValue)
                                        ? [currentValue, ...field.options]
                                        : field.options)
                                    : null
                                const sensivel = field.key === 'pontos_negativos' || field.key === 'saldo_pipj' || field.key === 'saldo_milhas'
                                const mudaCargoOuNucleo = field.key === 'cargo_atual' || field.key === 'nucleo_atual'
                                const disabled = mudaCargoOuNucleo ? !podeMudarCargo : (sensivel && !podeEditarCamposSensiveis)
                                return (
                                <div key={field.key} className="space-y-1.5">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                                        {field.label}
                                        {disabled && (
                                            <span className="normal-case font-normal text-slate-400">
                                                {mudaCargoOuNucleo ? ' — sem permissão pra mudar' : ' — só Estratégico/ADM'}
                                            </span>
                                        )}
                                    </Label>
                                    {options ? (
                                        <select
                                            value={formData[field.key] ?? ''}
                                            onChange={e => updateField(field.key, e.target.value)}
                                            disabled={disabled}
                                            className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none h-9 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {options.map(opt => (
                                                <option key={opt} value={opt}>{opt}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <Input
                                            type={field.type}
                                            value={formData[field.key] ?? ''}
                                            onChange={e => updateField(field.key, e.target.value)}
                                            disabled={disabled}
                                            className="bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 h-9 text-sm rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
                                        />
                                    )}
                                </div>
                                )
                            })}
                        </div>
                    </TabsContent>

                    {/* ACCESS TAB */}
                    <TabsContent value="access" className="space-y-4 mt-4">
                        {!podeGerenciarAcesso ? (
                            <div className="bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 rounded-xl p-4 text-center">
                                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Conceder acesso e mudar permissão é liberado só pra Estratégico e Admin.</p>
                            </div>
                        ) : (
                        <>
                        <div>
                            <Label className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 block">Permissão</Label>
                            <select
                                value={role}
                                onChange={e => setRole(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary/50 outline-none"
                            >
                                <option value="COLABORADOR">Colaborador</option>
                                {(role === 'ADMIN' || alvoPodeSerAdmin) && (
                                    <option value="ADMIN">Admin (acesso total)</option>
                                )}
                            </select>
                            {!alvoPodeSerAdmin && (
                                <p className="text-[10px] text-slate-400 mt-1">Só {EMAIL_UNICO_ADMIN} pode ser Admin.</p>
                            )}
                        </div>

                        {role !== 'ADMIN' && (
                            <>
                                <div className="flex items-center justify-between">
                                    <Label className="text-xs font-bold uppercase tracking-wider text-slate-500">Exceções Manuais de Acesso</Label>
                                    <div className="flex gap-2">
                                        <button onClick={selectAll} className="text-[10px] font-bold text-primary hover:underline">Marcar Todas</button>
                                        <button onClick={deselectAll} className="text-[10px] font-bold text-rose-500 hover:underline">Desmarcar Todas</button>
                                    </div>
                                </div>
                                <p className="text-[10px] text-slate-400 -mt-2">
                                    Páginas com <span className="font-semibold text-slate-500">cadeado</span> já vêm do cargo/núcleo — não dá pra tirar por aqui. Marque só o que precisa ser liberado além disso.
                                </p>

                                <div className="space-y-3">
                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Membro</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {memberPages.map(page => {
                                                const isPadrao = paginasPadrao.has(page.path)
                                                return (
                                                <label key={page.path} className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${isPadrao ? 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 cursor-default' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'}`}>
                                                    <Checkbox
                                                        checked={isPadrao || selectedPages.includes(page.path)}
                                                        onCheckedChange={() => !isPadrao && togglePage(page.path)}
                                                        disabled={isPadrao}
                                                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                    />
                                                    <span className={`text-xs font-medium flex items-center gap-1 ${isPadrao ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                        {page.label}{isPadrao && <Lock className="h-3 w-3 shrink-0" />}
                                                    </span>
                                                </label>
                                                )
                                            })}
                                        </div>
                                    </div>

                                    <div>
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Gestão de Pessoas</p>
                                        <div className="grid grid-cols-2 gap-2">
                                            {managementPages.map(page => {
                                                const isPadrao = paginasPadrao.has(page.path)
                                                return (
                                                <label key={page.path} className={`flex items-center gap-2 p-2 rounded-lg border transition-colors ${isPadrao ? 'bg-slate-100 dark:bg-slate-800/60 border-slate-200 dark:border-slate-700 cursor-default' : 'bg-slate-50 dark:bg-slate-900 border-slate-100 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer'}`}>
                                                    <Checkbox
                                                        checked={isPadrao || selectedPages.includes(page.path)}
                                                        onCheckedChange={() => !isPadrao && togglePage(page.path)}
                                                        disabled={isPadrao}
                                                        className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                                                    />
                                                    <span className={`text-xs font-medium flex items-center gap-1 ${isPadrao ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-300'}`}>
                                                        {page.label}{isPadrao && <Lock className="h-3 w-3 shrink-0" />}
                                                    </span>
                                                </label>
                                                )
                                            })}
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
                        </>
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
                    <Button onClick={handleSave} disabled={saving} className="bg-primary hover:bg-primary/90 text-primary-foreground">
                        {saving ? <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Salvando...</> : 'Salvar Alterações'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
