'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { CARGOS_AUTOCADASTRO } from '@/lib/cargos';

const formSchema = z.object({
    nome: z.string().min(3, { message: 'Informe seu nome completo' }),
    email_corporativo: z.string().email({ message: 'E-mail corporativo inválido' }),
    cargo: z.string().min(2, { message: 'Informe seu cargo' }),
    senha: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres' }),
    nucleo: z.string().min(2, { message: 'Informe seu núcleo' }),
    safra: z.string().min(1, { message: 'Informe sua safra' }),
    semestre_ingresso: z.string().min(2, { message: 'Informe o semestre' }),
    data_nascimento: z.string().min(10, { message: 'Informe a data (DD/MM/AAAA)' }),
    cpf: z.string().min(11, { message: 'Informe o CPF' }),
    endereco: z.string().min(5, { message: 'Informe seu endereço' }),
    matricula: z.string().min(2, { message: 'Informe a matrícula da universidade' }),
    telefone: z.string().min(10, { message: 'Informe o telefone' }),
    email_pessoal: z.string().email({ message: 'E-mail pessoal inválido' }),
    hobby: z.string().optional(),
    chocolate_favorito: z.string().optional(),
    serie_filme_favorito: z.string().optional(),
});

export function SignupForm() {
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            nome: '',
            email_corporativo: '',
            cargo: '',
            senha: '',
            nucleo: '',
            safra: '',
            semestre_ingresso: '',
            data_nascimento: '',
            cpf: '',
            endereco: '',
            matricula: '',
            telefone: '',
            email_pessoal: '',
            hobby: '',
            chocolate_favorito: '',
            serie_filme_favorito: '',
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setMessage(null);
        startTransition(async () => {
            // Converter data DD/MM/AAAA para YYYY-MM-DD
            let formattedDate = null;
            try {
                const parts = values.data_nascimento.split('/');
                if (parts.length === 3) {
                    formattedDate = `${parts[2]}-${parts[1]}-${parts[0]}`;
                }
            } catch (e) { }

            const { error } = await supabase.from('solicitacoes_conta').insert({
                nome: values.nome,
                cargo: values.cargo,
                nucleo: values.nucleo,
                safra: values.safra,
                semestre_ingresso: values.semestre_ingresso,
                data_nascimento: formattedDate,
                cpf: values.cpf,
                endereco: values.endereco,
                matricula: values.matricula,
                telefone: values.telefone,
                email_pessoal: values.email_pessoal,
                email_corporativo: values.email_corporativo,
                hobby: values.hobby,
                chocolate_favorito: values.chocolate_favorito,
                serie_filme_favorito: values.serie_filme_favorito,
                senha: values.senha,
                status: 'PENDENTE',
            });

            if (error) {
                setMessage({ text: error.message || 'Erro ao solicitar a criação de conta.', type: 'error' });
            } else {
                setMessage({ text: 'Solicitação enviada com sucesso! Aguarde a aprovação do administrador para fazer login.', type: 'success' });
                form.reset()
            }
        });
    }

    const inputCls = "bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-600";

    return (
        <div className="w-full max-w-4xl p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl my-8">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-display font-bold text-white mb-2">Criar Conta</h1>
                <p className="text-slate-400">Preencha seus dados para solicitar o acesso à plataforma</p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                    {/* Dados de acesso */}
                    <div>
                        <h2 className="text-accent font-bold text-sm uppercase tracking-wider mb-3">Dados de acesso</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField control={form.control} name="nome" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">Nome Completo</FormLabel><FormControl>
                                    <Input placeholder="Seu nome completo" {...field} className={inputCls} />
                                </FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="email_corporativo" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">E-mail Corporativo</FormLabel><FormControl>
                                    <Input placeholder="nome@produtivajunior.com.br" {...field} className={inputCls} />
                                </FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="cargo" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">Cargo Atual</FormLabel><FormControl>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                                            <SelectValue placeholder="Selecione o cargo" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                            {CARGOS_AUTOCADASTRO.map(c => (
                                                <SelectItem key={c} value={c}>{c}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="senha" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">Senha (para login)</FormLabel><FormControl>
                                    <Input type="password" placeholder="••••••••" {...field} className={inputCls} />
                                </FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                    </div>

                    {/* Dados pessoais e institucionais */}
                    <div>
                        <h2 className="text-accent font-bold text-sm uppercase tracking-wider mb-3">Dados pessoais e institucionais</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            <FormField control={form.control} name="nucleo" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">Núcleo</FormLabel><FormControl>
                                    <Select onValueChange={field.onChange} value={field.value}>
                                        <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
                                            <SelectValue placeholder="Selecione o núcleo" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-700 text-white">
                                            <SelectItem value="Marketing">Marketing</SelectItem>
                                            <SelectItem value="Projetos">Projetos</SelectItem>
                                            <SelectItem value="Gestão de Pessoas">Gestão de Pessoas</SelectItem>
                                            <SelectItem value="Presidência">Presidência</SelectItem>
                                            <SelectItem value="Vice-Presidência">Vice-Presidência</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="safra" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">Safra</FormLabel><FormControl>
                                    <Input placeholder="Ex: 32" {...field} className={inputCls} />
                                </FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="semestre_ingresso" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">Semestre de Ingresso</FormLabel><FormControl>
                                    <Input placeholder="Ex: 2025.2" {...field} className={inputCls} />
                                </FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="data_nascimento" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">Data de Nascimento</FormLabel><FormControl>
                                    <Input placeholder="00/00/0000" {...field} maxLength={10} onChange={(e) => {
                                        let v = e.target.value.replace(/\D/g, '');
                                        if (v.length > 8) v = v.slice(0, 8);
                                        let formatted = v;
                                        if (v.length > 2) formatted = `${v.slice(0, 2)}/${v.slice(2)}`;
                                        if (v.length > 4) formatted = `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
                                        field.onChange(formatted);
                                    }} className={inputCls} />
                                </FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="cpf" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">CPF</FormLabel><FormControl>
                                    <Input placeholder="000.000.000-00" {...field} maxLength={14} onChange={(e) => {
                                        let v = e.target.value.replace(/\D/g, '');
                                        if (v.length > 11) v = v.slice(0, 11);
                                        let formatted = v;
                                        if (v.length > 3) formatted = `${v.slice(0, 3)}.${v.slice(3)}`;
                                        if (v.length > 6) formatted = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
                                        if (v.length > 9) formatted = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
                                        field.onChange(formatted);
                                    }} className={inputCls} />
                                </FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="matricula" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">Matrícula (Universidade)</FormLabel><FormControl>
                                    <Input placeholder="Ex: 202100..." {...field} className={inputCls} />
                                </FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="telefone" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">Telefone (WhatsApp)</FormLabel><FormControl>
                                    <Input placeholder="(00) 00000-0000" {...field} maxLength={15} onChange={(e) => {
                                        let v = e.target.value.replace(/\D/g, '');
                                        if (v.length > 11) v = v.slice(0, 11);
                                        let formatted = v;
                                        if (v.length > 0) formatted = `(${v}`;
                                        if (v.length > 2) formatted = `(${v.slice(0, 2)}) ${v.slice(2)}`;
                                        if (v.length > 7) formatted = `(${v.slice(0, 2)}) ${v.slice(2, 7)}-${v.slice(7)}`;
                                        field.onChange(formatted);
                                    }} className={inputCls} />
                                </FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="email_pessoal" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">E-mail Pessoal</FormLabel><FormControl>
                                    <Input placeholder="joao@gmail.com" {...field} className={inputCls} />
                                </FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="endereco" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">Endereço</FormLabel><FormControl>
                                    <Input placeholder="Rua..." {...field} className={inputCls} />
                                </FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                    </div>

                    {/* Sobre você (opcional) */}
                    <div>
                        <h2 className="text-accent font-bold text-sm uppercase tracking-wider mb-3">Sobre você <span className="text-slate-500 normal-case font-normal">(opcional)</span></h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <FormField control={form.control} name="hobby" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">Hobby</FormLabel><FormControl>
                                    <Input placeholder="..." {...field} className={inputCls} />
                                </FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="chocolate_favorito" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">Chocolate Favorito</FormLabel><FormControl>
                                    <Input placeholder="..." {...field} className={inputCls} />
                                </FormControl><FormMessage /></FormItem>
                            )} />
                            <FormField control={form.control} name="serie_filme_favorito" render={({ field }) => (
                                <FormItem><FormLabel className="text-slate-300">Série/Filme Favorito</FormLabel><FormControl>
                                    <Input placeholder="..." {...field} className={inputCls} />
                                </FormControl><FormMessage /></FormItem>
                            )} />
                        </div>
                    </div>

                    {message && (
                        <div className={`p-3 rounded-lg text-sm text-center border ${message.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                            {message.text}
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        <Button
                            type="submit"
                            disabled={isPending}
                            className="w-full h-12 bg-accent hover:bg-accent/90 text-primary font-bold text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Solicitar Conta'}
                        </Button>
                        <Link href="/login" className="text-center text-sm text-slate-400 hover:text-white transition-colors">
                            Já tem uma conta? Faça login
                        </Link>
                    </div>
                </form>
            </Form>
        </div>
    );
}
