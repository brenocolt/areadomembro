"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Edit, Image as ImageIcon, Save, Loader2, KeyRound } from "lucide-react"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { changePasswordLocal } from "@/lib/actions"
import { toast } from "sonner"

export function ProfileCard() {
    const { colaborador, loading: loadingColab, colaboradorId } = useColaborador()
    const [isOpen, setIsOpen] = useState(false)
    const [isPasswordOpen, setIsPasswordOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(false)
    const [isChangingPassword, setIsChangingPassword] = useState(false)
    const [newPassword, setNewPassword] = useState("")
    const [confirmPassword, setConfirmPassword] = useState("")
    const [formData, setFormData] = useState({
        nome: "", telefone: "", emailPessoal: "", endereco: "",
        hobby: "", chocolate: "", serieFilme: ""
    })

    useEffect(() => {
        if (colaborador) {
            setFormData({
                nome: colaborador.nome || "",
                telefone: colaborador.telefone || "",
                emailPessoal: colaborador.email_pessoal || "",
                endereco: colaborador.endereco || "",
                hobby: colaborador.hobby || "",
                chocolate: colaborador.chocolate_favorito || "",
                serieFilme: colaborador.serie_filme_favorito || ""
            })
        }
    }, [colaborador])

    const handleSave = async () => {
        setIsLoading(true)
        await supabase
            .from('colaboradores')
            .update({
                nome: formData.nome,
                telefone: formData.telefone,
                email_pessoal: formData.emailPessoal,
                endereco: formData.endereco,
                hobby: formData.hobby,
                chocolate_favorito: formData.chocolate,
                serie_filme_favorito: formData.serieFilme || null,
            })
            .eq('id', colaboradorId)
        setIsLoading(false)
        setIsOpen(false)
        toast.success("Perfil atualizado com sucesso!")
    }

    const handleChangePassword = async () => {
        if (newPassword.length < 6) {
            toast.error("A senha deve ter pelo menos 6 caracteres.")
            return;
        }
        if (newPassword !== confirmPassword) {
            toast.error("As senhas não coincidem.")
            return;
        }
        
        setIsChangingPassword(true)
        const result = await changePasswordLocal(colaboradorId, newPassword)
        if (result.success) {
            toast.success("Senha alterada com sucesso!")
            setIsPasswordOpen(false)
            setNewPassword("")
            setConfirmPassword("")
        } else {
            toast.error(result.message || "Erro ao alterar a senha.")
        }
        setIsChangingPassword(false)
    }

    if (loadingColab) return <Card className="h-64 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-2xl border-none" />

    return (
        <Card className="overflow-hidden border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
            <div className="h-28 bg-[#001a41] relative"></div>
            <CardContent className="pt-0 relative px-6 pb-6">
                <div className="flex flex-col items-center -mt-12">
                    <Avatar className="h-24 w-24 border-4 border-white dark:border-[#0F172A] shadow-md bg-white">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-slate-100 dark:bg-slate-800 text-slate-400"><ImageIcon className="h-8 w-8" /></AvatarFallback>
                    </Avatar>

                    <h2 className="mt-4 text-2xl font-display font-bold text-center">{formData.nome}</h2>
                    <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
                        <span>{colaborador?.cargo_atual}</span>
                        <span className="text-slate-300">|</span>
                        <span>{colaborador?.nucleo_atual}</span>
                    </div>

                    <Dialog open={isOpen} onOpenChange={setIsOpen}>
                        <DialogTrigger asChild>
                            <Button className="w-full mt-6 bg-[#001a41] hover:bg-[#001a41]/90 text-white rounded-xl h-10 font-semibold gap-2 shadow-sm transition-transform active:scale-95">
                                <Edit className="h-4 w-4" />
                                Editar Perfil
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[500px]">
                            <DialogHeader>
                                <DialogTitle className="font-display text-xl">Editar Perfil</DialogTitle>
                                <DialogDescription>
                                    Atualize suas informações pessoais. Clique em salvar quando terminar.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="nome">Nome Completo</Label>
                                    <Input id="nome" value={formData.nome} onChange={(e) => setFormData({ ...formData, nome: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="telefone">Telefone</Label>
                                        <Input id="telefone" value={formData.telefone} onChange={(e) => setFormData({ ...formData, telefone: e.target.value })} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="emailPessoal">E-mail Pessoal</Label>
                                        <Input id="emailPessoal" type="email" value={formData.emailPessoal} onChange={(e) => setFormData({ ...formData, emailPessoal: e.target.value })} />
                                    </div>
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="endereco">Endereço</Label>
                                    <Input id="endereco" value={formData.endereco} onChange={(e) => setFormData({ ...formData, endereco: e.target.value })} />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="grid gap-2">
                                        <Label htmlFor="hobby">Hobby</Label>
                                        <Input id="hobby" value={formData.hobby} onChange={(e) => setFormData({ ...formData, hobby: e.target.value })} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="chocolate">Chocolate Favorito</Label>
                                        <Input id="chocolate" value={formData.chocolate} onChange={(e) => setFormData({ ...formData, chocolate: e.target.value })} />
                                    </div>
                                    <div className="grid gap-2">
                                        <Label htmlFor="serieFilme">Série/Filme</Label>
                                        <Input id="serieFilme" placeholder="Não informado" value={formData.serieFilme} onChange={(e) => setFormData({ ...formData, serieFilme: e.target.value })} />
                                    </div>
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsOpen(false)}>Cancelar</Button>
                                <Button onClick={handleSave} disabled={isLoading} className="gap-2">
                                    {isLoading ? (<><Loader2 className="h-4 w-4 animate-spin" />Salvando...</>) : (<><Save className="h-4 w-4" />Salvar Alterações</>)}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={isPasswordOpen} onOpenChange={setIsPasswordOpen}>
                        <DialogTrigger asChild>
                            <Button variant="outline" className="w-full mt-3 border-[#001a41]/20 text-[#001a41] dark:border-white/10 dark:text-white rounded-xl h-10 font-semibold gap-2 shadow-sm transition-transform active:scale-95">
                                <KeyRound className="h-4 w-4" />
                                Trocar Senha
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[400px]">
                            <DialogHeader>
                                <DialogTitle className="font-display text-xl">Trocar Senha</DialogTitle>
                                <DialogDescription>
                                    Defina uma nova senha para o seu acesso à Plataforma.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                    <Label htmlFor="novaSenha">Nova Senha</Label>
                                    <Input id="novaSenha" type="password" placeholder="••••••••" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                                </div>
                                <div className="grid gap-2">
                                    <Label htmlFor="confirmarSenha">Confirmar Nova Senha</Label>
                                    <Input id="confirmarSenha" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setIsPasswordOpen(false)}>Cancelar</Button>
                                <Button onClick={handleChangePassword} disabled={isChangingPassword} className="gap-2 bg-[#001a41] hover:bg-[#001a41]/90">
                                    {isChangingPassword ? (<><Loader2 className="h-4 w-4 animate-spin" />Alterando...</>) : (<><Save className="h-4 w-4" />Salvar Senha</>)}
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>
                </div>
            </CardContent>
        </Card>
    )
}
