"use client"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ShoppingBag, Gift, Plus, Minus, Ticket, Headphones, Utensils, MonitorSpeaker, Camera, Home, BookOpen, Shirt } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useColaborador } from "@/hooks/use-supabase"

const PRODUCTS = [
    { id: 1, name: "-1 Ponto", price: 10, icon: Ticket, color: "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400" },
    { id: 2, name: "Vale iFood (R$ 30,00)", price: 30, icon: Utensils, color: "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400" },
    { id: 3, name: "2 ingressos comuns para o cinema", price: 35, icon: Ticket, color: "bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400" },
    { id: 4, name: "Camisa de evento MEJ", price: 50, icon: Shirt, color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400" },
    { id: 5, name: "Almoço camarões", price: 60, icon: Utensils, color: "bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400" },
    { id: 6, name: "Mouse", price: 70, icon: MonitorSpeaker, color: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400" },
    { id: 7, name: "Participação em evento sênior de valor", price: 100, icon: Ticket, color: "bg-indigo-100 text-indigo-600 dark:bg-indigo-500/20 dark:text-indigo-400" },
    { id: 8, name: "Day use em um hotel", price: 150, icon: Home, color: "bg-sky-100 text-sky-600 dark:bg-sky-500/20 dark:text-sky-400" },
    { id: 9, name: "R$ 200 em produtos amazon", price: 200, icon: ShoppingBag, color: "bg-yellow-100 text-yellow-600 dark:bg-yellow-500/20 dark:text-yellow-400" },
    { id: 10, name: "Fone de ouvido", price: 250, icon: Headphones, color: "bg-purple-100 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400" },
    { id: 11, name: "Alexa", price: 300, icon: MonitorSpeaker, color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-500/20 dark:text-cyan-400" },
    { id: 12, name: "Ingresso para show local", price: 400, icon: Ticket, color: "bg-pink-100 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400" },
    { id: 13, name: "Kindle", price: 600, icon: BookOpen, color: "bg-slate-100 text-slate-600 dark:bg-slate-500/20 dark:text-slate-400" },
]

export function RedeemRewardsDialog({ children }: { children: React.ReactNode }) {
    const { colaboradorId } = useColaborador()
    const [open, setOpen] = useState(false)
    const [saldo, setSaldo] = useState(0)
    const [cart, setCart] = useState<Record<number, number>>({})
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (!open || !colaboradorId) return;

        async function fetchSaldo() {
            const { data } = await supabase
                .from('milhas_saldo')
                .select('saldo_disponivel')
                .eq('colaborador_id', colaboradorId)
                .single()
            if (data) setSaldo(data.saldo_disponivel || 0)
        }
        fetchSaldo()
        setCart({}) // reset cart when opening
    }, [open, colaboradorId])

    const totalCart = Object.entries(cart).reduce((total, [id, qty]) => {
        const prod = PRODUCTS.find(p => p.id === parseInt(id))
        return total + (prod ? prod.price * qty : 0)
    }, 0)

    const handleAddToCart = (id: number) => {
        const prod = PRODUCTS.find(p => p.id === id)
        if (prod && totalCart + prod.price <= saldo) {
            setCart(prev => ({ ...prev, [id]: (prev[id] || 0) + 1 }))
        }
    }

    const handleRemoveFromCart = (id: number) => {
        setCart(prev => {
            const newCart = { ...prev }
            if (newCart[id] > 1) {
                newCart[id] -= 1
            } else {
                delete newCart[id]
            }
            return newCart
        })
    }

    const handleConfirm = async () => {
        if (totalCart === 0 || !colaboradorId) return;
        setIsSubmitting(true)

        try {
            // Create a request for each different item in the cart, repeated if qty > 1
            for (const [idStr, qty] of Object.entries(cart)) {
                const prod = PRODUCTS.find(p => p.id === parseInt(idStr))
                if (!prod) continue;

                for (let i = 0; i < qty; i++) {
                    await supabase.from('milhas_trocas').insert({
                        colaborador_id: colaboradorId,
                        item_nome: prod.name,
                        milhas_gastas: prod.price,
                        status: 'PENDENTE'
                    })
                }
            }

            setOpen(false)
            setCart({})
        } catch (e) {
            console.error(e)
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[700px] bg-slate-50 dark:bg-[#0f172a] rounded-[2rem] p-0 overflow-hidden border-none text-slate-900 dark:text-white">
                <DialogHeader className="px-6 py-4 bg-white dark:bg-[#1E293B] border-b border-slate-100 dark:border-white/5 flex flex-row items-center justify-between shadow-sm">
                    <DialogTitle className="flex items-center gap-2 text-lg">
                        <ShoppingBag className="h-5 w-5 text-[#00b4d8]" />
                        Loja de Milhas
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 pt-4 space-y-6">
                    {/* Headers (Saldo / Cart) */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Saldo Disponível</p>
                            <p className="text-2xl font-black text-slate-800 dark:text-white">
                                {new Intl.NumberFormat('pt-BR').format(saldo)} <span className="text-sm font-medium text-slate-400 normal-case">milhas</span>
                            </p>
                        </div>
                        <div className="bg-white dark:bg-[#1E293B] p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-white/5">
                            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Total do Carrinho</p>
                            <p className={`text-2xl font-black ${totalCart > 0 ? 'text-[#00b4d8]' : 'text-slate-800 dark:text-white'}`}>
                                {new Intl.NumberFormat('pt-BR').format(totalCart)} <span className="text-sm font-medium text-slate-400 normal-case">milhas</span>
                            </p>
                        </div>
                    </div>

                    {/* Products Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto px-1 pb-4 custom-scrollbar">
                        {PRODUCTS.map(product => {
                            const qty = cart[product.id] || 0
                            const canAfford = totalCart + product.price <= saldo

                            return (
                                <div key={product.id} className={`bg-white dark:bg-[#1E293B] rounded-2xl overflow-hidden border ${qty > 0 ? 'border-[#00b4d8] ring-1 ring-[#00b4d8]' : 'border-slate-100 dark:border-white/5'} shadow-sm relative group p-1 flex flex-col`}>
                                    <div className={`h-28 rounded-xl ${product.color} flex items-center justify-center relative transition-transform`}>
                                        <product.icon className="h-10 w-10 opacity-70" />

                                        {/* Plus/Minus Overlays */}
                                        <div className="absolute top-2 right-2 flex flex-col gap-1">
                                            <button
                                                disabled={!canAfford}
                                                onClick={() => handleAddToCart(product.id)}
                                                className={`h-6 w-6 rounded-full bg-white text-slate-900 shadow-md flex items-center justify-center ${canAfford ? 'hover:bg-slate-100' : 'opacity-50 cursor-not-allowed'}`}
                                            >
                                                <Plus className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="p-3 flex-1 flex flex-col justify-between">
                                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-2 leading-tight">
                                            {product.name}
                                        </p>
                                        <div className="mt-2 flex items-center justify-between">
                                            <p className="text-[10px] font-bold text-[#00b4d8]">
                                                {product.price} milhas
                                            </p>
                                            {qty > 0 && (
                                                <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 rounded-full px-2 py-0.5">
                                                    <button onClick={() => handleRemoveFromCart(product.id)} className="text-slate-500 hover:text-slate-800 dark:hover:text-white">
                                                        <Minus className="h-3 w-3" />
                                                    </button>
                                                    <span className="text-[10px] font-bold w-3 text-center">{qty}</span>
                                                    <button onClick={() => handleAddToCart(product.id)} disabled={!canAfford} className="text-slate-500 hover:text-slate-800 dark:hover:text-white disabled:opacity-50">
                                                        <Plus className="h-3 w-3" />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-3 pt-2">
                        <Button
                            className="w-full bg-[#00b4d8] hover:bg-[#0096b4] text-white font-bold h-12 rounded-xl text-md"
                            disabled={totalCart === 0 || isSubmitting || saldo < totalCart}
                            onClick={handleConfirm}
                        >
                            {isSubmitting ? "Processando..." : "Confirmar Resgate"}
                        </Button>
                        <Button
                            variant="ghost"
                            className="w-full text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            onClick={() => setOpen(false)}
                        >
                            Cancelar e voltar
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
