"use client"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowRight, Ticket, Headphones, Utensils, Gift } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useState, useEffect } from "react"

const ICON_MAP: Record<string, any> = {
    'ticket': Ticket,
    'headphones': Headphones,
    'utensils': Utensils,
    'gift': Gift,
}

const COLOR_MAP: Record<string, string> = {
    'internacional': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
    'acessorios': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
    'nacional': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
    'voucher': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
    'geral': 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-400',
}

export function ProductsGrid() {
    const [products, setProducts] = useState<any[]>([])

    useEffect(() => {
        async function fetch() {
            const { data } = await supabase
                .from('milhas_produtos')
                .select('*')
                .eq('disponivel', true)
                .order('destaque', { ascending: false })
                .limit(8)
            if (data) setProducts(data)
        }
        fetch()
    }, [])

    if (products.length === 0) return null

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold flex items-center gap-2">
                    <span className="text-xl">🛍️</span> Produtos Disponíveis
                </h2>
                <Button variant="link" className="text-xs text-primary font-bold h-auto p-0 hover:no-underline hover:opacity-80">
                    Ver catálogo completo <ArrowRight className="ml-1 h-3 w-3" />
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {products.map((product) => {
                    const Icon = ICON_MAP[product.icone] || Gift
                    const color = COLOR_MAP[product.categoria?.toLowerCase()] || COLOR_MAP['geral']
                    return (
                        <Card key={product.id} className="overflow-hidden border-none shadow-sm hover:shadow-md transition-shadow group bg-white dark:bg-[#0F172A] rounded-2xl">
                            <div className={`h-32 w-full ${color} flex items-center justify-center relative`}>
                                <Badge className="absolute top-3 right-3 text-[10px] bg-black/20 hover:bg-black/30 border-none text-white backdrop-blur-sm">
                                    {(product.categoria || 'GERAL').toUpperCase()}
                                </Badge>
                                <Icon className="h-12 w-12 opacity-50 group-hover:scale-110 transition-transform duration-300" />
                            </div>
                            <CardHeader className="p-4 pb-2">
                                <h3 className="font-bold text-sm leading-tight group-hover:text-primary transition-colors">{product.nome}</h3>
                                <p className="text-xs text-slate-500 line-clamp-2">{product.descricao}</p>
                            </CardHeader>
                            <CardFooter className="p-4 pt-2 flex items-center justify-between">
                                <div className="flex flex-col">
                                    <span className="font-bold text-lg text-primary">{new Intl.NumberFormat('pt-BR').format(product.custo_milhas)}</span>
                                    <span className="text-[10px] font-bold text-slate-400 uppercase">milhas</span>
                                </div>
                                <Button size="sm" className="h-8 px-4 text-xs font-bold rounded-lg pointer-events-none group-hover:pointer-events-auto opacity-0 group-hover:opacity-100 transition-all translate-y-2 group-hover:translate-y-0">
                                    Resgatar
                                </Button>
                            </CardFooter>
                        </Card>
                    )
                })}
            </div>
        </div>
    )
}
