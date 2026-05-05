"use client"
import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Gift, Plus, Pencil, Trash2, Check, X, Eye, EyeOff, Loader2, Package } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"

interface CatalogProduct {
    id: string
    name: string
    price: number
    disponivel: boolean
    isNew?: boolean
    isEditing?: boolean
}

// Default products matching the PRODUCTS list from the redeem dialog
const DEFAULT_PRODUCTS: CatalogProduct[] = [
    { id: '1', name: "-1 Ponto", price: 10, disponivel: true },
    { id: '2', name: "Vale iFood (R$ 30,00)", price: 30, disponivel: true },
    { id: '3', name: "2 ingressos comuns para o cinema", price: 35, disponivel: true },
    { id: '4', name: "Camisa de evento MEJ", price: 50, disponivel: true },
    { id: '5', name: "Almoço camarões", price: 60, disponivel: true },
    { id: '6', name: "Mouse", price: 70, disponivel: true },
    { id: '7', name: "Participação em evento sênior de valor", price: 100, disponivel: true },
    { id: '8', name: "Day use em um hotel", price: 150, disponivel: true },
    { id: '9', name: "R$ 200 em produtos amazon", price: 200, disponivel: true },
    { id: '10', name: "Fone de ouvido", price: 250, disponivel: true },
    { id: '11', name: "Alexa", price: 300, disponivel: true },
    { id: '12', name: "Ingresso para show local", price: 400, disponivel: true },
    { id: '13', name: "Kindle", price: 600, disponivel: true },
]

export function ManageCatalogDialog() {
    const [open, setOpen] = useState(false)
    const [products, setProducts] = useState<CatalogProduct[]>([])
    const [loading, setLoading] = useState(false)
    const [saving, setSaving] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editName, setEditName] = useState("")
    const [editPrice, setEditPrice] = useState("")

    // New product state
    const [showAddNew, setShowAddNew] = useState(false)
    const [newName, setNewName] = useState("")
    const [newPrice, setNewPrice] = useState("")

    useEffect(() => {
        if (open) {
            loadProducts()
        }
    }, [open])

    const loadProducts = async () => {
        setLoading(true)
        const { data } = await supabase
            .from('milhas_catalogo')
            .select('*')
            .order('preco', { ascending: true })

        if (data && data.length > 0) {
            setProducts(data.map((p: any) => ({
                id: p.id,
                name: p.nome,
                price: p.preco,
                disponivel: p.disponivel ?? true
            })))
        } else {
            // If no catalog table exists yet, use defaults
            setProducts(DEFAULT_PRODUCTS)
        }
        setLoading(false)
    }

    const handleToggleAvailability = async (product: CatalogProduct) => {
        const newDisponivel = !product.disponivel
        setProducts(prev => prev.map(p => p.id === product.id ? { ...p, disponivel: newDisponivel } : p))
        
        // Try to update in DB
        const { error } = await supabase
            .from('milhas_catalogo')
            .update({ disponivel: newDisponivel })
            .eq('id', product.id)

        if (error) {
            // If table doesn't exist, revert state change silently
            console.log('DB update skipped (catalog may be local only)')
        }
    }

    const startEdit = (product: CatalogProduct) => {
        setEditingId(product.id)
        setEditName(product.name)
        setEditPrice(product.price.toString())
    }

    const cancelEdit = () => {
        setEditingId(null)
        setEditName("")
        setEditPrice("")
    }

    const saveEdit = async () => {
        if (!editName || !editPrice) return
        const priceNum = parseFloat(editPrice)
        if (isNaN(priceNum) || priceNum <= 0) {
            toast.error('Preço inválido.')
            return
        }

        setProducts(prev => prev.map(p => p.id === editingId ? { ...p, name: editName, price: priceNum } : p))

        // Try to update in DB
        await supabase
            .from('milhas_catalogo')
            .update({ nome: editName, preco: priceNum })
            .eq('id', editingId)

        setEditingId(null)
        toast.success('Produto atualizado!')
    }

    const handleAddProduct = async () => {
        if (!newName || !newPrice) {
            toast.error('Preencha todos os campos.')
            return
        }
        const priceNum = parseFloat(newPrice)
        if (isNaN(priceNum) || priceNum <= 0) {
            toast.error('Preço inválido.')
            return
        }

        const newProduct: CatalogProduct = {
            id: Math.random().toString(36).slice(2),
            name: newName,
            price: priceNum,
            disponivel: true,
            isNew: true
        }

        // Try to insert in DB
        const { data } = await supabase
            .from('milhas_catalogo')
            .insert({ nome: newName, preco: priceNum, disponivel: true })
            .select()
            .single()

        if (data) {
            newProduct.id = data.id
        }

        setProducts(prev => [...prev, newProduct].sort((a, b) => a.price - b.price))
        setNewName("")
        setNewPrice("")
        setShowAddNew(false)
        toast.success('Produto adicionado!')
    }

    const handleDeleteProduct = async (product: CatalogProduct) => {
        setProducts(prev => prev.filter(p => p.id !== product.id))
        
        await supabase
            .from('milhas_catalogo')
            .delete()
            .eq('id', product.id)

        toast.success('Produto removido!')
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/25">
                    <Gift className="mr-2 h-4 w-4" />
                    Gerenciar Catálogo
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[650px] bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-3xl p-0 overflow-hidden text-slate-900 dark:text-white">
                <div className="px-6 pt-6 pb-4">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-bold flex items-center gap-2">
                            <div className="bg-cyan-50 dark:bg-cyan-500/10 p-2 rounded-xl border border-cyan-100 dark:border-cyan-500/20">
                                <Package className="h-5 w-5 text-cyan-600 dark:text-cyan-400" />
                            </div>
                            Gerenciar Catálogo de Milhas
                        </DialogTitle>
                    </DialogHeader>
                </div>

                <div className="px-6 pb-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
                    {loading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="h-6 w-6 animate-spin text-cyan-500" />
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {/* Header */}
                            <div className="grid grid-cols-[1fr_100px_80px_60px] gap-3 text-[10px] uppercase font-bold text-slate-500 tracking-wider pb-2 border-b border-slate-100 dark:border-white/10 px-3">
                                <span>Produto</span>
                                <span className="text-center">Preço (milhas)</span>
                                <span className="text-center">Status</span>
                                <span className="text-right">Ações</span>
                            </div>

                            {products.map((product) => (
                                <div key={product.id} className={`grid grid-cols-[1fr_100px_80px_60px] gap-3 items-center p-3 rounded-xl transition-all ${!product.disponivel ? 'opacity-50 bg-slate-50 dark:bg-white/5' : 'hover:bg-slate-50 dark:hover:bg-white/5'}`}>
                                    {editingId === product.id ? (
                                        <>
                                            <Input
                                                value={editName}
                                                onChange={(e) => setEditName(e.target.value)}
                                                className="h-8 text-sm bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg"
                                            />
                                            <Input
                                                type="number"
                                                value={editPrice}
                                                onChange={(e) => setEditPrice(e.target.value)}
                                                className="h-8 text-sm text-center bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg"
                                            />
                                            <div />
                                            <div className="flex justify-end gap-1">
                                                <button onClick={saveEdit} className="h-7 w-7 flex items-center justify-center rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20">
                                                    <Check className="h-3.5 w-3.5" />
                                                </button>
                                                <button onClick={cancelEdit} className="h-7 w-7 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/10 text-slate-500 hover:bg-slate-200 dark:hover:bg-white/20">
                                                    <X className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{product.name}</span>
                                            <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400 text-center">{product.price}</span>
                                            <div className="flex justify-center">
                                                <Badge
                                                    variant="outline"
                                                    className={`text-[10px] border-0 cursor-pointer select-none ${product.disponivel
                                                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                                        : 'bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-slate-400'
                                                    }`}
                                                    onClick={() => handleToggleAvailability(product)}
                                                >
                                                    {product.disponivel ? 'Ativo' : 'Inativo'}
                                                </Badge>
                                            </div>
                                            <div className="flex justify-end gap-1">
                                                <button onClick={() => startEdit(product)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-cyan-600 hover:bg-cyan-50 dark:hover:bg-cyan-500/10">
                                                    <Pencil className="h-3.5 w-3.5" />
                                                </button>
                                                <button onClick={() => handleDeleteProduct(product)} className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10">
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </button>
                                            </div>
                                        </>
                                    )}
                                </div>
                            ))}

                            {/* Add New Product */}
                            {showAddNew ? (
                                <div className="border border-cyan-200 dark:border-cyan-500/20 bg-cyan-50/50 dark:bg-cyan-500/5 rounded-2xl p-4 space-y-3">
                                    <p className="text-xs font-bold text-cyan-600 dark:text-cyan-400 uppercase tracking-wider">Novo Produto</p>
                                    <div className="grid grid-cols-[1fr_120px] gap-3">
                                        <Input
                                            placeholder="Nome do produto..."
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            className="h-9 text-sm bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg"
                                        />
                                        <Input
                                            type="number"
                                            placeholder="Milhas"
                                            value={newPrice}
                                            onChange={(e) => setNewPrice(e.target.value)}
                                            className="h-9 text-sm bg-white dark:bg-[#0f172a] border-slate-200 dark:border-slate-700 rounded-lg"
                                        />
                                    </div>
                                    <div className="flex gap-2 justify-end">
                                        <Button variant="ghost" size="sm" onClick={() => { setShowAddNew(false); setNewName(""); setNewPrice("") }} className="h-8 text-slate-500 rounded-lg">
                                            Cancelar
                                        </Button>
                                        <Button size="sm" onClick={handleAddProduct} className="h-8 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg px-4">
                                            <Plus className="h-3.5 w-3.5 mr-1" />
                                            Adicionar
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    onClick={() => setShowAddNew(true)}
                                    className="w-full flex items-center justify-center gap-2 p-3 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10 text-slate-500 hover:border-cyan-300 hover:text-cyan-600 dark:hover:border-cyan-500/30 dark:hover:text-cyan-400 transition-colors"
                                >
                                    <Plus className="h-4 w-4" />
                                    <span className="text-sm font-medium">Adicionar Novo Produto</span>
                                </button>
                            )}
                        </div>
                    )}
                </div>

                <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex justify-end bg-slate-50/50 dark:bg-black/10">
                    <Button variant="ghost" onClick={() => setOpen(false)} className="rounded-xl font-bold h-10 text-slate-700 dark:text-slate-300">
                        Fechar
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
