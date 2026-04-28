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
import { resetPasswordLocal } from '@/lib/actions';
import { useState, useTransition } from 'react';
import { Loader2, ArrowLeft, MailCheck } from 'lucide-react';
import Link from 'next/link';
import { toast } from 'sonner';

const formSchema = z.object({
    email: z.string().email({ message: 'E-mail inválido' }),
    cpf: z.string().min(11, { message: 'Informe o CPF completo' }),
    data_nascimento: z.string().min(10, { message: 'Informe a data (DD/MM/AAAA)' }),
});

export default function RecuperarSenhaPage() {
    const [isPending, startTransition] = useTransition();
    const [isSent, setIsSent] = useState(false);
    const [tempPassword, setTempPassword] = useState<string | null>(null);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: '',
            cpf: '',
            data_nascimento: '',
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        startTransition(async () => {
            const result = await resetPasswordLocal(values.email, values.data_nascimento, values.cpf);
            
            if (!result.success) {
                toast.error(result.message);
            } else {
                setTempPassword(result.tempPassword || null);
                setIsSent(true);
                toast.success('Senha redefinida com sucesso!');
            }
        });
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-[#020617] p-4">
            <div className="w-full max-w-md p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
                <div className="mb-8 text-center">
                    <h1 className="text-3xl font-display font-bold text-white mb-2">Produtiva Júnior</h1>
                    <p className="text-slate-400">Recuperação de Senha</p>
                </div>

                {!isSent ? (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                            <FormField
                                control={form.control}
                                name="email"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className="text-slate-300 uppercase text-xs font-bold tracking-wider">E-mail Corporativo</FormLabel>
                                        <FormControl>
                                            <Input
                                                placeholder="nome@produtivajunior.com.br"
                                                {...field}
                                                className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-600 h-12 rounded-xl focus-visible:ring-accent"
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                    control={form.control}
                                    name="cpf"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-slate-300 uppercase text-xs font-bold tracking-wider">CPF</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    placeholder="000.000.000-00" 
                                                    {...field} 
                                                    maxLength={14} 
                                                    onChange={(e) => {
                                                        let v = e.target.value.replace(/\D/g, '');
                                                        if (v.length > 11) v = v.slice(0, 11);
                                                        let formatted = v;
                                                        if (v.length > 3) formatted = `${v.slice(0, 3)}.${v.slice(3)}`;
                                                        if (v.length > 6) formatted = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6)}`;
                                                        if (v.length > 9) formatted = `${v.slice(0, 3)}.${v.slice(3, 6)}.${v.slice(6, 9)}-${v.slice(9)}`;
                                                        field.onChange(formatted);
                                                    }} 
                                                    className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-600 h-12 rounded-xl focus-visible:ring-accent" 
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="data_nascimento"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel className="text-slate-300 uppercase text-xs font-bold tracking-wider">Data de Nascimento</FormLabel>
                                            <FormControl>
                                                <Input 
                                                    placeholder="DD/MM/AAAA" 
                                                    {...field} 
                                                    maxLength={10} 
                                                    onChange={(e) => {
                                                        let v = e.target.value.replace(/\D/g, '');
                                                        if (v.length > 8) v = v.slice(0, 8);
                                                        let formatted = v;
                                                        if (v.length > 2) formatted = `${v.slice(0, 2)}/${v.slice(2)}`;
                                                        if (v.length > 4) formatted = `${v.slice(0, 2)}/${v.slice(2, 4)}/${v.slice(4)}`;
                                                        field.onChange(formatted);
                                                    }} 
                                                    className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-600 h-12 rounded-xl focus-visible:ring-accent" 
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            </div>

                            <div className="flex flex-col gap-4">
                                <Button
                                    type="submit"
                                    disabled={isPending}
                                    className="w-full h-12 bg-accent hover:bg-accent/90 text-primary font-bold text-base rounded-xl transition-all"
                                >
                                    {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Redefinir e Gerar Senha Temporária'}
                                </Button>
                                
                                <Link href="/login" className="flex items-center justify-center gap-2 text-sm text-slate-400 hover:text-white transition-colors">
                                    <ArrowLeft className="h-4 w-4" />
                                    Voltar para o Login
                                </Link>
                            </div>
                        </form>
                    </Form>
                ) : (
                    <div className="text-center space-y-6">
                        <div className="flex justify-center">
                            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
                                <MailCheck className="h-10 w-10 text-emerald-400" />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <h2 className="text-xl font-bold text-white">Senha Redefinida!</h2>
                            <p className="text-slate-400 text-sm">
                                Como o envio de e-mails não está configurado neste ambiente, sua conta foi atualizada com uma senha provisória.
                            </p>
                            
                            <div className="mt-4 p-4 bg-slate-900 border border-slate-700 rounded-xl">
                                <p className="text-xs text-slate-400 uppercase font-bold mb-1">Sua nova senha provisória</p>
                                <p className="text-2xl font-mono text-accent select-all">{tempPassword}</p>
                            </div>
                            
                            <p className="text-slate-400 text-xs mt-4">
                                Copie a senha acima, faça o login e não se esqueça de alterá-la depois caso desejado!
                            </p>
                        </div>
                        <Button asChild variant="outline" className="w-full border-slate-700 text-slate-300 hover:bg-slate-800">
                            <Link href="/login">Voltar para o Login</Link>
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
