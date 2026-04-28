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
import { authenticate } from '@/lib/actions';
import { useState, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

const formSchema = z.object({
    email: z.string().email({ message: 'E-mail inválido' }),
    password: z.string().min(1, { message: 'Informe sua senha' }),
});

export function LoginForm() {
    const [isPending, startTransition] = useTransition();
    const [errorMessage, setErrorMessage] = useState<string | undefined>();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            email: '',
            password: '',
        },
    });

    async function onSubmit(values: z.infer<typeof formSchema>) {
        setErrorMessage(undefined);
        startTransition(async () => {
            const formData = new FormData();
            formData.append('email', values.email);
            formData.append('password', values.password);
            const result = await authenticate(undefined, formData);
            if (result) {
                setErrorMessage(result);
            }
        });
    }

    return (
        <div className="w-full max-w-md p-8 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl shadow-2xl">
            <div className="mb-8 text-center">
                <h1 className="text-3xl font-display font-bold text-white mb-2">Produtiva Júnior</h1>
                <p className="text-slate-400">Portal do Membro</p>
            </div>

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
                    <FormField
                        control={form.control}
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormControl>
                                    <Input
                                        type="password"
                                        placeholder="••••••••"
                                        {...field}
                                        className="bg-slate-900/50 border-slate-700 text-white placeholder:text-slate-600 h-12 rounded-xl focus-visible:ring-accent"
                                    />
                                </FormControl>
                                <div className="flex justify-end pt-1">
                                    <Link href="/recuperar-senha" className="text-xs text-slate-400 hover:text-accent transition-colors">
                                        Esqueci minha senha?
                                    </Link>
                                </div>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    {errorMessage && (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm text-center">
                            {errorMessage}
                        </div>
                    )}

                    <div className="flex flex-col gap-4">
                        <Button
                            type="submit"
                            disabled={isPending}
                            className="w-full h-12 bg-accent hover:bg-accent/90 text-primary font-bold text-base rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                        >
                            {isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : 'Entrar na Plataforma'}
                        </Button>
                    </div>
                </form>
            </Form>

            <div className="mt-6 text-center">
                <Link href="/signup" className="inline-block text-sm text-slate-400 hover:text-white transition-colors">
                    Ainda não tem conta? Solicite seu acesso
                </Link>
            </div>
        </div>
    );
}
