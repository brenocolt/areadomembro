"use client"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ShoppingBag, Coffee, Car, GraduationCap, Lock, ArrowUpRight, Loader2, Paperclip } from "lucide-react"
import { useColaborador } from "@/hooks/use-supabase"
import { supabase } from "@/lib/supabase"
import { useState, useEffect, useTransition } from "react"

const ICON_MAP: Record<string, any> = { 'coffee': Coffee, 'car': Car, 'graduation-cap': GraduationCap, 'shopping-bag': ShoppingBag }

export function BenefitsCatalog() {
    const [benefits, setBenefits] = useState<any[]>([])

    useEffect(() => {
        async function fetch() {
            const { data } = await supabase.from('beneficios_catalogo').select('*').eq('ativo', true)
            if (data) setBenefits(data)
        }
        fetch()
    }, [])

    return (
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
            <DialogHeader>
                <DialogTitle className="font-display text-2xl">Catálogo de Benefícios</DialogTitle>
                <DialogDescription>Troque seu saldo PIPJ por recompensas incríveis.</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                {benefits.map((benefit) => {
                    const Icon = ICON_MAP[benefit.icone] || ShoppingBag
                    return (
                        <Card key={benefit.id} className={`border-2 ${benefit.desbloqueado ? 'border-slate-100 hover:border-accent cursor-pointer' : 'border-slate-100 opacity-60'} transition-all`}>
                            <CardContent className="p-4 flex flex-col items-center text-center gap-3">
                                <div className={`h-12 w-12 rounded-full flex items-center justify-center ${benefit.desbloqueado ? 'bg-accent/10 text-accent-foreground' : 'bg-slate-100 text-slate-400'}`}>
                                    <Icon className="h-6 w-6" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm">{benefit.nome}</h4>
                                    <span className="text-xl font-display font-bold text-primary dark:text-white">R$ {Number(benefit.valor).toFixed(0)}</span>
                                </div>
                                <Button disabled={!benefit.desbloqueado} className={`w-full ${benefit.desbloqueado ? 'bg-primary' : 'bg-slate-200 text-slate-500'}`} size="sm">
                                    {benefit.desbloqueado ? 'Resgatar' : <div className="flex items-center gap-2"><Lock className="h-3 w-3" /> Bloqueado</div>}
                                </Button>
                            </CardContent>
                        </Card>
                    )
                })}
            </div>
        </DialogContent>
    )
}

function SaqueForm({ saldo, colaboradorId, onClose }: { saldo: number; colaboradorId: string; onClose: () => void }) {
    const [isPending, startTransition] = useTransition()
    const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
    const [uploadingFile, setUploadingFile] = useState(false)
    const [form, setForm] = useState({
        descricao: '',
        valor: '',
        forma_pagamento: '',
        chave_pix: '',
        banco: '',
        agencia: '',
        conta: '',
        comprovante_url: '',
    })

    function handleSubmit() {
        const valor = Number(form.valor)
        if (!form.descricao || !form.valor || !form.forma_pagamento) {
            setMsg({ text: 'Preencha descrição, valor e forma de pagamento.', type: 'error' })
            return
        }
        if (valor <= 0 || valor > saldo) {
            setMsg({ text: `Valor deve ser entre R$ 0,01 e R$ ${saldo.toFixed(2).replace('.', ',')}.`, type: 'error' })
            return
        }
        if (form.forma_pagamento === 'pix' && !form.chave_pix) {
            setMsg({ text: 'Informe a chave PIX.', type: 'error' })
            return
        }
        if (form.forma_pagamento === 'transferencia' && (!form.banco || !form.agencia || !form.conta)) {
            setMsg({ text: 'Preencha os dados bancários completos.', type: 'error' })
            return
        }
        setMsg(null)
        startTransition(async () => {
            const dadosBancarios = form.forma_pagamento === 'pix'
                ? { forma: 'pix', chave_pix: form.chave_pix }
                : { forma: 'transferencia', banco: form.banco, agencia: form.agencia, conta: form.conta }

            const { error } = await supabase.from('solicitacoes_saque').insert({
                colaborador_id: colaboradorId,
                valor: valor,
                descricao: `${form.descricao} | ${JSON.stringify(dadosBancarios)}`,
                comprovante_url: form.comprovante_url || null,
                atividade: form.forma_pagamento,
                tipo: 'saque_pipj',
                status: 'PENDENTE',
                data_solicitacao: new Date().toISOString(),
            })
            if (error) {
                setMsg({ text: 'Erro ao enviar solicitação: ' + error.message, type: 'error' })
            } else {
                setMsg({ text: 'Solicitação enviada com sucesso!', type: 'success' })
                setTimeout(() => onClose(), 1500)
            }
        })
    }

    return (
        <DialogContent className="sm:max-w-[520px] max-h-[85vh] overflow-y-auto bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
            <DialogHeader>
                <DialogTitle className="font-display text-2xl">Solicitar Saque PIPJ</DialogTitle>
                <DialogDescription>Preencha os dados para solicitar o saque do seu saldo.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
                <div className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-xl text-center">
                    <span className="text-xs font-bold uppercase text-slate-400">Saldo disponível</span>
                    <div className="text-2xl font-display font-bold text-primary dark:text-white">R$ {saldo.toFixed(2).replace('.', ',')}</div>
                </div>

                <div className="space-y-2">
                    <Label htmlFor="descricao">Descrição / Motivo</Label>
                    <Textarea id="descricao" placeholder="Descreva o motivo do saque..." value={form.descricao} onChange={(e) => setForm(f => ({ ...f, descricao: e.target.value }))} className="resize-none" rows={3} />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="valor">Valor (R$)</Label>
                    <Input id="valor" type="number" min="1" max={Math.min(saldo, 300)} step="1" placeholder="0" value={form.valor} onChange={(e) => setForm(f => ({ ...f, valor: e.target.value }))} />
                </div>

                <div className="space-y-2">
                    <Label>Forma de Pagamento</Label>
                    <Select value={form.forma_pagamento} onValueChange={(v) => setForm(f => ({ ...f, forma_pagamento: v }))}>
                        <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="pix">PIX</SelectItem>
                            <SelectItem value="transferencia">Transferência Bancária</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

                {form.forma_pagamento === 'pix' && (
                    <div className="space-y-2">
                        <Label htmlFor="chave_pix">Chave PIX</Label>
                        <Input id="chave_pix" placeholder="CPF, e-mail, telefone ou chave aleatória" value={form.chave_pix} onChange={(e) => setForm(f => ({ ...f, chave_pix: e.target.value }))} />
                    </div>
                )}

                {form.forma_pagamento === 'transferencia' && (
                    <div className="space-y-3">
                        <div className="space-y-2">
                            <Label htmlFor="banco">Banco</Label>
                            <Input id="banco" placeholder="Ex: Nubank, Itaú..." value={form.banco} onChange={(e) => setForm(f => ({ ...f, banco: e.target.value }))} />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                                <Label htmlFor="agencia">Agência</Label>
                                <Input id="agencia" placeholder="0001" value={form.agencia} onChange={(e) => setForm(f => ({ ...f, agencia: e.target.value }))} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="conta">Conta</Label>
                                <Input id="conta" placeholder="12345-6" value={form.conta} onChange={(e) => setForm(f => ({ ...f, conta: e.target.value }))} />
                            </div>
                        </div>
                    </div>
                )}

                <div className="space-y-2">
                    <Label htmlFor="comprovante">Comprovante / Imagem (opcional)</Label>
                    <div className="flex items-center gap-3">
                        <label className="flex-1 flex items-center gap-2 cursor-pointer border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                            {uploadingFile ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : <Paperclip className="h-4 w-4 text-slate-400" />}
                            <span className="text-sm text-slate-500 truncate">{form.comprovante_url ? 'Arquivo enviado ✓' : 'Anexar imagem...'}</span>
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={uploadingFile}
                                onChange={async (e) => {
                                    const file = e.target.files?.[0]
                                    if (!file) return
                                    setUploadingFile(true)
                                    const ext = file.name.split('.').pop()
                                    const path = `comprovantes/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
                                    const { error } = await supabase.storage.from('pdi-anexos').upload(path, file)
                                    if (error) {
                                        setMsg({ text: 'Erro ao enviar imagem: ' + error.message, type: 'error' })
                                    } else {
                                        const { data: urlData } = supabase.storage.from('pdi-anexos').getPublicUrl(path)
                                        setForm(f => ({ ...f, comprovante_url: urlData.publicUrl }))
                                    }
                                    setUploadingFile(false)
                                }}
                            />
                        </label>
                        {form.comprovante_url && (
                            <a href={form.comprovante_url} target="_blank" rel="noreferrer" className="text-xs text-cyan-600 dark:text-cyan-400 hover:underline shrink-0">Ver</a>
                        )}
                    </div>
                </div>

                {msg && (
                    <div className={`text-sm font-medium p-3 rounded-xl ${msg.type === 'success' ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400' : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'}`}>
                        {msg.text}
                    </div>
                )}

                <Button onClick={handleSubmit} disabled={isPending} className="w-full bg-primary hover:bg-primary/90 text-white font-bold h-12 rounded-xl">
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowUpRight className="h-4 w-4 mr-2" />}
                    Enviar Solicitação
                </Button>
            </div>
        </DialogContent>
    )
}

export function WalletCard() {
    const { colaborador, loading, colaboradorId } = useColaborador()
    const [saqueOpen, setSaqueOpen] = useState(false)

    if (loading) return <Card className="h-64 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-3xl border-none" />

    const saldo = Number(colaborador?.saldo_pipj || 0)

    return (
        <Card className="bg-gradient-to-br from-white to-slate-50 dark:from-[#0F172A] dark:to-[#0B1120] border-none shadow-lg rounded-3xl overflow-hidden relative">
            <div className="absolute top-0 right-0 p-8 opacity-5"><ShoppingBag className="h-48 w-48 rotate-12" /></div>
            <CardContent className="p-8 flex flex-col justify-between h-full relative z-10">
                <div>
                    <span className="text-sm font-bold uppercase tracking-wider text-slate-500">Saldo Atual Disponível</span>
                    <div className="text-5xl md:text-6xl font-display font-bold text-primary dark:text-white mt-2 tracking-tight">
                        R$ {saldo.toFixed(2).replace('.', ',')}
                    </div>
                    <div className="flex items-center gap-2 mt-4 text-green-600 dark:text-green-400 font-bold bg-green-50 dark:bg-green-900/20 px-3 py-1 rounded-full w-fit text-sm">
                        <span className="text-lg">↗</span> +R$ 50,00 este mês
                    </div>
                </div>
                <div className="mt-8 flex flex-wrap gap-3">
                    <Dialog open={saqueOpen} onOpenChange={setSaqueOpen}>
                        <DialogTrigger asChild>
                            <Button className="bg-[#001a41] dark:bg-white dark:text-[#001a41] hover:scale-105 transition-transform text-white rounded-xl px-8 py-6 text-lg font-bold shadow-xl shadow-primary/20">
                                <ArrowUpRight className="mr-2 h-5 w-5" /> Solicitar Saque
                            </Button>
                        </DialogTrigger>
                        <SaqueForm saldo={saldo} colaboradorId={colaboradorId} onClose={() => setSaqueOpen(false)} />
                    </Dialog>
                </div>
            </CardContent>
        </Card>
    )
}
