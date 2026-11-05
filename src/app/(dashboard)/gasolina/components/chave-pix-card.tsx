"use client"

import { useEffect, useState } from "react"
import { KeyRound, Loader2, Pencil, Save } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { gasolinaApi } from "./api"

// Chave Pix cadastrada uma vez — vai sozinha no card do Monday a cada
// solicitação de reembolso.
export function ChavePixCard() {
    const [chave, setChave] = useState<string | null>(null)
    const [editando, setEditando] = useState(false)
    const [valor, setValor] = useState("")
    const [carregando, setCarregando] = useState(true)
    const [salvando, setSalvando] = useState(false)

    useEffect(() => {
        gasolinaApi<{ chave_pix: string | null }>("/api/gasolina/pix")
            .then(r => { setChave(r.chave_pix); setEditando(!r.chave_pix) })
            .catch(e => toast.error(e.message))
            .finally(() => setCarregando(false))
    }, [])

    async function salvar() {
        setSalvando(true)
        try {
            const r = await gasolinaApi<{ chave_pix: string, tipo: string }>("/api/gasolina/pix", {
                method: "PATCH",
                body: JSON.stringify({ chave_pix: valor }),
            })
            setChave(r.chave_pix)
            setEditando(false)
            toast.success(`Chave Pix salva (${r.tipo}).`)
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setSalvando(false)
        }
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <KeyRound className="h-5 w-5 text-amber-500" />
                    Chave Pix para reembolso
                </CardTitle>
                <CardDescription>
                    É para esta chave que o financeiro envia o reembolso. CPF, CNPJ, e-mail, celular (+55...) ou chave aleatória.
                </CardDescription>
            </CardHeader>
            <CardContent>
                {carregando ? (
                    <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                ) : editando ? (
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Input
                            value={valor}
                            onChange={e => setValor(e.target.value)}
                            placeholder="Sua chave Pix"
                            className="sm:max-w-sm"
                            onKeyDown={e => { if (e.key === "Enter") salvar() }}
                        />
                        <div className="flex gap-2">
                            <Button onClick={salvar} disabled={salvando || !valor.trim()}>
                                {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Salvar
                            </Button>
                            {chave && <Button variant="outline" onClick={() => setEditando(false)}>Cancelar</Button>}
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-3">
                        <span className="font-mono text-slate-800 dark:text-slate-100">{chave}</span>
                        <Button variant="outline" size="sm" onClick={() => { setValor(chave ?? ""); setEditando(true) }}>
                            <Pencil className="h-4 w-4" /> Alterar
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
