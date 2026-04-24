"use client"

import {
    Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion"
import { Card } from "@/components/ui/card"
import { Info, Phone, Heart } from "lucide-react"
import { useColaborador } from "@/hooks/use-supabase"

export function InfoSection() {
    const { colaborador, loading } = useColaborador()

    if (loading) return <Card className="h-48 animate-pulse bg-slate-100 dark:bg-slate-800 rounded-2xl border-none" />

    const birthday = (() => {
        if (!colaborador?.data_nascimento) return '---'
        // Parse date parts manually to avoid UTC timezone offset shifting the day
        const parts = colaborador.data_nascimento.split('-')
        if (parts.length >= 3) {
            const day = parts[2].substring(0, 2).padStart(2, '0')
            const month = parts[1].padStart(2, '0')
            return `${day}/${month}`
        }
        return '---'
    })()

    return (
        <Card className="p-2 border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl">
            <Accordion type="single" collapsible defaultValue="geral" className="w-full">
                <AccordionItem value="geral" className="border-b-0 px-2">
                    <AccordionTrigger className="hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg px-2 py-3">
                        <div className="flex items-center gap-3">
                            <Info className="h-4 w-4 text-primary" />
                            <span className="font-bold uppercase text-xs tracking-wider text-slate-700 dark:text-slate-300">Informações Gerais</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-2 pt-2 pb-4 space-y-4">
                        <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-xs font-bold text-slate-400 uppercase">Aniversário</span>
                            <span className="text-sm font-medium">{birthday}</span>
                        </div>
                        <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-slate-800">
                            <span className="text-xs font-bold text-slate-400 uppercase">CPF</span>
                            <span className="text-sm font-medium">{colaborador?.cpf || '---'}</span>
                        </div>
                        <div className="py-1">
                            <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Endereço</span>
                            <span className="text-sm font-medium">{colaborador?.endereco || '---'}</span>
                        </div>
                        <div className="flex justify-between items-center py-1">
                            <span className="text-xs font-bold text-slate-400 uppercase">Matrícula</span>
                            <span className="text-sm font-medium text-muted-foreground">{colaborador?.matricula || '---'}</span>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="contato" className="border-b-0 px-2">
                    <AccordionTrigger className="hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg px-2 py-3">
                        <div className="flex items-center gap-3">
                            <Phone className="h-4 w-4 text-primary" />
                            <span className="font-bold uppercase text-xs tracking-wider text-slate-700 dark:text-slate-300">Contato</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-2 pt-2 pb-4 space-y-4">
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase block mb-1">Telefone</span>
                            <span className="text-sm font-medium">{colaborador?.telefone || '---'}</span>
                        </div>
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase block mb-1">E-mail Pessoal</span>
                            <span className="text-sm font-medium underline decoration-slate-300 underline-offset-4">{colaborador?.email_pessoal || '---'}</span>
                        </div>
                        <div>
                            <span className="text-xs font-bold text-slate-400 uppercase block mb-1">E-mail Corporativo</span>
                            <span className="text-sm font-medium underline decoration-slate-300 underline-offset-4">{colaborador?.email_corporativo}</span>
                        </div>
                    </AccordionContent>
                </AccordionItem>

                <AccordionItem value="hobbies" className="border-b-0 px-2">
                    <AccordionTrigger className="hover:no-underline hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg px-2 py-3">
                        <div className="flex items-center gap-3">
                            <Heart className="h-4 w-4 text-primary" />
                            <span className="font-bold uppercase text-xs tracking-wider text-slate-700 dark:text-slate-300">Adicionais & Hobbies</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-2 pt-2 pb-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Hobby</span>
                                <span className="text-sm font-medium">{colaborador?.hobby || 'Não informado'}</span>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Chocolate</span>
                                <span className="text-sm font-medium">{colaborador?.chocolate_favorito || 'Não informado'}</span>
                            </div>
                            <div className="col-span-2">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Série/Filme</span>
                                <span className={`text-sm font-medium ${!colaborador?.serie_filme_favorito ? 'text-muted-foreground italic' : ''}`}>
                                    {colaborador?.serie_filme_favorito || 'Não informado'}
                                </span>
                            </div>
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </Card>
    )
}
