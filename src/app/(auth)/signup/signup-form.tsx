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
import { useState, useTransition, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

interface MembroPreCadastro {
    id: string;
    nome: string;
    email_corporativo: string;
    cargo: string;
    pontos_acumulados: number;
    milhas: number;
}

const formSchema = z.object({
    membro_pre_cadastro_id: z.string().min(1, { message: 'Selecione seu nome na lista' }),
    nome: z.string().min(3, { message: 'Informe seu nome completo' }),
    cargo: z.string().min(2, { message: 'Informe seu cargo' }),
    nucleo: z.string().min(2, { message: 'Informe seu núcleo' }),
    safra: z.string().min(2, { message: 'Informe sua safra' }),
    semestre_ingresso: z.string().min(2, { message: 'Informe o semestre' }),
    data_nascimento: z.string().min(10, { message: 'Informe a data (DD/MM/AAAA)' }),
    cpf: z.string().min(11, { message: 'Informe o CPF' }),
    endereco: z.string().min(5, { message: 'Informe seu endereço' }),
    matricula: z.string().min(2, { message: 'Informe a matrícula da universidade' }),
    telefone: z.string().min(10, { message: 'Informe o telefone' }),
    email_pessoal: z.string().email({ message: 'E-mail pessoal inválido' }),
    email_corporativo: z.string().email({ message: 'E-mail corporativo inválido' }),
    hobby: z.string().optional(),
    chocolate_favorito: z.string().optional(),
    serie_filme_favorito: z.string().optional(),
    senha: z.string().min(6, { message: 'A senha deve ter pelo menos 6 caracteres' }),
});

export function SignupForm() {
    const [isPending, startTransition] = useTransition();
    const [message, setMessage] = useState<{ text: string, type: 'error' | 'success' } | null>(null);
    const [membros, setMembros] = useState<MembroPreCadastro[]>([]);
    const [loadingMembros, setLoadingMembros] = useState(true);
    const router = useRouter()

    // Fetch pre-registered members on mount
    useEffect(() => {
        async function fetchMembros() {
            try {
                const res = await fetch('/api/membros');
                const data = await res.json();
                if (Array.isArray(data)) {
                    setMembros(data);
                }
            } catch (e) {
                console.error('Erro ao buscar membros:', e);
            } finally {
                setLoadingMembros(false);
            }
        }
        fetchMembros();
    }, []);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            membro_pre_cadastro_id: '',
            nome: '',
            cargo: '',
            nucleo: '',
            safra: '',
            semestre_ingresso: '',
            data_nascimento: '',
            cpf: '',
            endereco: '',
            matricula: '',
            telefone: '',
            email_pessoal: '',
            email_corporativo: '',
            hobby: '',
            chocolate_favorito: '',
            serie_filme_favorito: '',
            senha: '',
        },
    });

    // Handle member selection — auto-fill fields
    function handleMembroSelect(membroId: string) {
        const membro = membros.find(m => m.id === membroId);
        if (membro) {
            form.setValue('membro_pre_cadastro_id', membro.id);
            form.setValue('nome', membro.nome);
            form.setValue('email_corporativo', membro.email_corporativo);
            form.setValue('cargo', membro.cargo);
        }
    }

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
                membro_pre_cadastro_id: values.membro_pre_cadastro_id,
            });

            if (error) {
                setMessage({ text: error.message || 'Erro ao solicitar a criação de conta.', type: 'error' });
            } else {
                setMessage({ text: 'Solicitação enviada com sucesso! Aguarde a aprovação do administrador para fazer login.', type: 'success' });
                form.reset()
            }
        });
    }

    const selectedMembroId = form.watch('membro_pre_cadastro_id');

    return (
        <div className="w-full max-w-4xl p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl my-8">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-display font-bold text-white mb-2">Criar Conta</h1>
                <p className="text-slate-400">Selecione seu nome e preencha seus dados para solicitar o acesso</p>
            </div>

            <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                    {/* FIRST: Member Selection Dropdown */}
                    <div className="p-4 border border-accent/30 rounded-2xl bg-accent/5">
                        <FormField control={form.control} name="membro_pre_cadastro_id" render={({ field }) => (
                            <FormItem>
                                <FormLabel className="text-accent font-bold text-base">
                                    Selecione seu nome
                                </FormLabel>
                                <FormControl>
                                    <Select
                                        onValueChange={(val) => {
                                            field.onChange(val);
                                            handleMembroSelect(val);
                                        }}
                                        value={field.value}
                                    >
                                        <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white h-12 text-base">
                                            <SelectValue placeholder={loadingMembros ? "Carregando membros..." : "Escolha seu nome na lista"} />
                                        </SelectTrigger>
                                        <SelectContent className="bg-slate-900 border-slate-700 text-white max-h-60">
                                            {membros.map((m) => (
                                                <SelectItem key={m.id} value={m.id} className="text-sm">
                                                    {m.nome}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )} />
                    </div>

                    {/* Auto-filled fields shown after selection */}
                    {selectedMembroId && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border border-white/10 rounded-2xl bg-white/5">
                            <FormField control={form.control} name="email_corporativo" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-slate-300">E-mail Corporativo</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            readOnly
                                            className="bg-slate-900/80 border-slate-700 text-slate-300 cursor-not-allowed opacity-75"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                            <FormField control={form.control} name="cargo" render={({ field }) => (
                                <FormItem>
                                    <FormLabel className="text-slate-300">Cargo Atual</FormLabel>
                                    <FormControl>
                                        <Input
                                            {...field}
                                            readOnly
                                            className="bg-slate-900/80 border-slate-700 text-slate-300 cursor-not-allowed opacity-75"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )} />
                        </div>
                    )}

                    {/* Remaining form fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        <FormField control={form.control} name="senha" render={({ field }) => (
                            <FormItem><FormLabel className="text-slate-300">Senha (para login)</FormLabel><FormControl>
                                <Input type="password" placeholder="••••••••" {...field} className="bg-slate-900/50 border-slate-700 text-white" />
                            </FormControl><FormMessage /></FormItem>
                        )} />

                        <FormField control={form.control} name="nucleo" render={({ field }) => (
                            <FormItem><FormLabel className="text-slate-300">Núcleo</FormLabel><FormControl>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
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
                                <Input placeholder="Ex: 32" {...field} className="bg-slate-900/50 border-slate-700 text-white" />
                            </FormControl><FormMessage /></FormItem>
                        )} />

                        <FormField control={form.control} name="semestre_ingresso" render={({ field }) => (
                            <FormItem><FormLabel className="text-slate-300">Semestre de Ingresso</FormLabel><FormControl>
                                <Input placeholder="Ex: 2025.2" {...field} className="bg-slate-900/50 border-slate-700 text-white" />
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
                                }} className="bg-slate-900/50 border-slate-700 text-white" />
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
                                }} className="bg-slate-900/50 border-slate-700 text-white" />
                            </FormControl><FormMessage /></FormItem>
                        )} />

                        <FormField control={form.control} name="matricula" render={({ field }) => (
                            <FormItem><FormLabel className="text-slate-300">Matrícula (Universidade)</FormLabel><FormControl>
                                <Input placeholder="Ex: 202100..." {...field} className="bg-slate-900/50 border-slate-700 text-white" />
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
                                }} className="bg-slate-900/50 border-slate-700 text-white" />
                            </FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="email_pessoal" render={({ field }) => (
                            <FormItem><FormLabel className="text-slate-300">E-mail Pessoal</FormLabel><FormControl>
                                <Input placeholder="joao@gmail.com" {...field} className="bg-slate-900/50 border-slate-700 text-white" />
                            </FormControl><FormMessage /></FormItem>
                        )} />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <FormField control={form.control} name="endereco" render={({ field }) => (
                            <FormItem><FormLabel className="text-slate-300">Endereço</FormLabel><FormControl>
                                <Input placeholder="Rua..." {...field} className="bg-slate-900/50 border-slate-700 text-white" />
                            </FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="hobby" render={({ field }) => (
                            <FormItem><FormLabel className="text-slate-300">Hobby (Opcional)</FormLabel><FormControl>
                                <Input placeholder="..." {...field} className="bg-slate-900/50 border-slate-700 text-white" />
                            </FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="chocolate_favorito" render={({ field }) => (
                            <FormItem><FormLabel className="text-slate-300">Chocolate (Opcional)</FormLabel><FormControl>
                                <Input placeholder="..." {...field} className="bg-slate-900/50 border-slate-700 text-white" />
                            </FormControl><FormMessage /></FormItem>
                        )} />
                        <FormField control={form.control} name="serie_filme_favorito" render={({ field }) => (
                            <FormItem className="md:col-span-3"><FormLabel className="text-slate-300">Série/Filme Favorito (Opcional)</FormLabel><FormControl>
                                <Input placeholder="..." {...field} className="bg-slate-900/50 border-slate-700 text-white" />
                            </FormControl><FormMessage /></FormItem>
                        )} />
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
