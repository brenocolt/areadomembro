"use client"

import { useMemo, useRef, useState } from "react"
import { CheckCircle2, FileText, Loader2, Paperclip, Send, UserRound, X } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useColaborador } from "@/hooks/use-supabase"
import {
    ANEXO_EXTENSOES_ACEITAS, ANEXO_QTD_MAX, ANEXO_TAMANHO_MAX, CENTROS_CUSTO, FORMAS_PAGAMENTO, SIM_NAO,
    TIPOS_SOLICITACAO, camposVisiveis, centroPorNome, validarSolicitacao,
    type ErrosFormulario, type RespostasFormulario,
} from "@/lib/pagamentos-formulario"

const CARD = "border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl p-5 sm:p-6 gap-5"

function novaChave() {
    return typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c => (+c ^ (Math.random() * 16) >> (+c / 4)).toString(16))
}

function Erro({ texto }: { texto?: string }) {
    if (!texto) return null
    return <p className="text-xs font-medium text-red-600 dark:text-red-400">{texto}</p>
}

function Campo({ id, rotulo, obrigatorio, erro, ajuda, children }: {
    id?: string, rotulo: string, obrigatorio?: boolean, erro?: string, ajuda?: string, children: React.ReactNode
}) {
    return (
        <div className="space-y-1.5" data-campo={id}>
            <Label htmlFor={id}>{rotulo}{obrigatorio && <span className="text-amber-600"> *</span>}</Label>
            {children}
            {ajuda && !erro && <p className="text-xs text-slate-400 dark:text-slate-500">{ajuda}</p>}
            <Erro texto={erro} />
        </div>
    )
}

// Botões de escolha única (mesmo visual do seletor da Visão geral da gasolina).
function Escolha({ nome, opcoes, valor, onChange, invalido }: {
    nome: string, opcoes: readonly string[], valor?: string, onChange: (v: string) => void, invalido?: boolean
}) {
    return (
        <div role="radiogroup" aria-label={nome}
            className={`inline-flex flex-wrap gap-1 rounded-lg bg-slate-100 dark:bg-slate-800/50 p-1 ${invalido ? "ring-1 ring-red-400" : ""}`}>
            {opcoes.map(o => (
                <button key={o} type="button" role="radio" aria-checked={valor === o} onClick={() => onChange(o)}
                    className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-colors ${valor === o
                        ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                        : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
                    {o}
                </button>
            ))}
        </div>
    )
}

function formatarTamanho(bytes: number) {
    return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function SeletorArquivos({ id, arquivos, onChange, invalido }: {
    id: string, arquivos: File[], onChange: (f: File[]) => void, invalido?: boolean
}) {
    const ref = useRef<HTMLInputElement>(null)
    const [aviso, setAviso] = useState<string | null>(null)
    const adicionar = (lista: FileList | null) => {
        if (!lista) return
        const novos: File[] = []
        let recusados = 0
        for (const f of Array.from(lista)) {
            if (f.size > ANEXO_TAMANHO_MAX) { recusados++; continue }
            novos.push(f)
        }
        const total = [...arquivos, ...novos].slice(0, ANEXO_QTD_MAX)
        setAviso(recusados ? `${recusados} arquivo(s) acima de 10 MB não foram adicionados.`
            : arquivos.length + novos.length > ANEXO_QTD_MAX ? `Máximo de ${ANEXO_QTD_MAX} arquivos.` : null)
        onChange(total)
        if (ref.current) ref.current.value = ""
    }
    return (
        <div className="space-y-2">
            <input ref={ref} id={id} type="file" multiple accept={ANEXO_EXTENSOES_ACEITAS} className="sr-only"
                onChange={e => adicionar(e.target.files)} />
            <button type="button" onClick={() => ref.current?.click()}
                className={`flex w-full items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-5 text-sm font-medium transition-colors
                    ${invalido ? "border-red-400 text-red-600" : "border-slate-300 dark:border-white/15 text-slate-500 hover:border-amber-400 hover:text-amber-600"}`}>
                <Paperclip className="h-4 w-4" /> Escolher arquivos (PDF ou imagem, até 10 MB)
            </button>
            {arquivos.length > 0 && (
                <ul className="space-y-1.5">
                    {arquivos.map((f, i) => (
                        <li key={`${f.name}-${i}`} className="flex items-center gap-2 rounded-lg bg-slate-50 dark:bg-slate-800/50 px-3 py-2 text-sm">
                            <FileText className="h-4 w-4 shrink-0 text-amber-500" />
                            <span className="truncate flex-1 text-slate-700 dark:text-slate-200">{f.name}</span>
                            <span className="shrink-0 text-xs text-slate-400">{formatarTamanho(f.size)}</span>
                            <button type="button" aria-label={`Remover ${f.name}`} onClick={() => onChange(arquivos.filter((_, j) => j !== i))}
                                className="shrink-0 rounded p-1 text-slate-400 hover:text-red-500 hover:bg-red-500/10">
                                <X className="h-3.5 w-3.5" />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
            {aviso && <p className="text-xs text-amber-600">{aviso}</p>}
        </div>
    )
}

export function FormularioSolicitacao() {
    const { colaborador, loading } = useColaborador()
    const [r, setR] = useState<RespostasFormulario>({})
    const [pixTocado, setPixTocado] = useState(false)
    const [comprovantes, setComprovantes] = useState<File[]>([])
    const [anexosWorkday, setAnexosWorkday] = useState<File[]>([])
    const [erros, setErros] = useState<ErrosFormulario>({})
    const [erroGeral, setErroGeral] = useState<string | null>(null)
    const [enviando, setEnviando] = useState(false)
    const [enviada, setEnviada] = useState<{ numero: number } | null>(null)
    // Mesma chave enquanto for o mesmo preenchimento: reenviar (clique duplo,
    // rede caiu) não duplica a solicitação.
    const chave = useRef(novaChave())

    const vis = useMemo(() => camposVisiveis(r), [r])
    const centro = centroPorNome(r.centro_custo)
    // Chave Pix: sugere a do cadastro (mesma usada no reembolso de gasolina).
    const chavePix = pixTocado ? (r.chave_pix ?? "") : (r.chave_pix ?? colaborador?.chave_pix ?? "")

    const set = (campo: keyof RespostasFormulario, valor: string) => {
        setR(prev => {
            const prox = { ...prev, [campo]: valor }
            // Trocou o centro de custo: a categoria anterior não vale mais.
            if (campo === "centro_custo" && prev.centro_custo !== valor) {
                delete prox.categoria; delete prox.categoria_execucao; delete prox.outra_categoria; delete prox.evento_mej
            }
            return prox
        })
        setErros(prev => ({ ...prev, [campo]: undefined }))
        setErroGeral(null)
    }

    const respostasFinais = (): RespostasFormulario => ({ ...r, chave_pix: chavePix })

    const enviar = async (e: React.FormEvent) => {
        e.preventDefault()
        setErroGeral(null)
        const respostas = respostasFinais()
        const workday = vis.anexo_workday ? anexosWorkday : []
        const local = validarSolicitacao(respostas, { comprovantes: comprovantes.length, workday: workday.length })
        if (!local.ok) {
            setErros(local.erros)
            setErroGeral("Confira os campos destacados.")
            requestAnimationFrame(() => {
                const primeiro = document.querySelector("[data-campo] .text-red-600")
                primeiro?.closest("[data-campo]")?.scrollIntoView({ behavior: "smooth", block: "center" })
            })
            return
        }

        const corpo = new FormData()
        corpo.append("dados", JSON.stringify(respostas))
        corpo.append("chave_idempotencia", chave.current)
        comprovantes.forEach(f => corpo.append("comprovantes", f))
        workday.forEach(f => corpo.append("anexos_workday", f))

        setEnviando(true)
        try {
            const res = await fetch("/api/pagamentos/solicitacoes", { method: "POST", body: corpo })
            const json = await res.json().catch(() => ({}))
            if (!res.ok) {
                if (json.erros) setErros(json.erros)
                setErroGeral(json.error || "Não foi possível enviar. Tente de novo.")
                return
            }
            setEnviada({ numero: json.numero })
            window.scrollTo({ top: 0, behavior: "smooth" })
        } catch {
            setErroGeral("Sem conexão com o portal. Verifique a internet e clique em Enviar de novo (não vai duplicar).")
        } finally {
            setEnviando(false)
        }
    }

    const recomecar = () => {
        setR({}); setPixTocado(false); setComprovantes([]); setAnexosWorkday([])
        setErros({}); setErroGeral(null); setEnviada(null)
        chave.current = novaChave()
    }

    if (enviada) {
        return (
            <Card className={`${CARD} items-center text-center py-10`}>
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-500/10">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <div className="space-y-1">
                    <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">Solicitação enviada!</h2>
                    <p className="text-slate-500 dark:text-slate-400">
                        Protocolo <span className="font-semibold text-amber-600">#{enviada.numero}</span>. Guarde este número para acompanhar.
                    </p>
                </div>
                <Button onClick={recomecar} variant="outline" className="font-semibold">Fazer outra solicitação</Button>
            </Card>
        )
    }

    const categoria = centro?.categoria

    return (
        <form onSubmit={enviar} noValidate className="space-y-6">
            {/* Quem está solicitando: vem do cadastro, não é digitado. */}
            <Card className={CARD}>
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/10">
                        <UserRound className="h-5 w-5 text-amber-500" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs text-slate-400">Solicitante</p>
                        <p className="font-semibold text-slate-900 dark:text-white truncate">
                            {loading ? "Carregando..." : colaborador?.nome || "—"}
                        </p>
                        <p className="text-sm text-slate-500 dark:text-slate-400 truncate">
                            {colaborador?.email_corporativo || colaborador?.email_pessoal || ""}
                        </p>
                    </div>
                </div>
            </Card>

            <Card className={CARD}>
                <Campo id="tipo" rotulo="Tipo de solicitação" obrigatorio erro={erros.tipo}>
                    <div><Escolha nome="Tipo de solicitação" opcoes={TIPOS_SOLICITACAO} valor={r.tipo} onChange={v => set("tipo", v)} invalido={!!erros.tipo} /></div>
                </Campo>

                {vis.forma_pagamento && (
                    <Campo id="forma_pagamento" rotulo="Forma de pagamento" obrigatorio erro={erros.forma_pagamento}>
                        <div><Escolha nome="Forma de pagamento" opcoes={FORMAS_PAGAMENTO} valor={r.forma_pagamento} onChange={v => set("forma_pagamento", v)} invalido={!!erros.forma_pagamento} /></div>
                    </Campo>
                )}
                {vis.dados_bancarios && (
                    <Campo id="dados_bancarios" rotulo="Dados bancários" obrigatorio={r.forma_pagamento !== "Boleto"} erro={erros.dados_bancarios}
                        ajuda="Banco, agência, conta, titular e CPF/CNPJ (ou chave Pix do fornecedor).">
                        <Textarea id="dados_bancarios" value={r.dados_bancarios ?? ""} onChange={e => set("dados_bancarios", e.target.value)}
                            aria-invalid={!!erros.dados_bancarios} rows={3} />
                    </Campo>
                )}

                <Campo id="descricao" rotulo="Descrição do pagamento" obrigatorio erro={erros.descricao}>
                    {/* Padrões de descrição combinados com a VP (lidos pelas automações). */}
                    <ul className="space-y-0.5 rounded-lg bg-amber-50/60 dark:bg-amber-500/5 px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                        <li>Se for gasolina: <span className="font-semibold">Reembolso Gasolina (Nome do projeto como está na planilha de gasolina)</span></li>
                        <li>Se for auxílio alimentação: <span className="font-semibold">Auxílio alimentação - (XX/YY/ZZZZ)</span></li>
                    </ul>
                    <Textarea id="descricao" value={r.descricao ?? ""} onChange={e => set("descricao", e.target.value)}
                        aria-invalid={!!erros.descricao} rows={3} />
                </Campo>

                <div className="grid gap-5 sm:grid-cols-2">
                    <Campo id="fornecedor" rotulo="Fornecedor" obrigatorio erro={erros.fornecedor}>
                        <Input id="fornecedor" value={r.fornecedor ?? ""} onChange={e => set("fornecedor", e.target.value)} aria-invalid={!!erros.fornecedor} />
                    </Campo>
                    <Campo id="valor" rotulo="Valor (R$)" obrigatorio erro={erros.valor}>
                        <div className="relative">
                            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">R$</span>
                            <Input id="valor" inputMode="decimal" placeholder="0,00" className="pl-9" value={r.valor ?? ""}
                                onChange={e => set("valor", e.target.value.replace(/[^\d.,]/g, ""))} aria-invalid={!!erros.valor} />
                        </div>
                    </Campo>
                </div>
            </Card>

            <Card className={CARD}>
                <Campo id="centro_custo" rotulo="Centro de custo" obrigatorio erro={erros.centro_custo}>
                    <Select value={r.centro_custo ?? ""} onValueChange={v => set("centro_custo", v)}>
                        <SelectTrigger id="centro_custo" className="w-full" aria-invalid={!!erros.centro_custo}><SelectValue placeholder="Escolha" /></SelectTrigger>
                        <SelectContent>
                            {CENTROS_CUSTO.map(c => <SelectItem key={c.nome} value={c.nome}>{c.nome}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </Campo>

                {vis.evento_mej && (
                    <Campo id="evento_mej" rotulo="Evento MEJ" obrigatorio erro={erros.evento_mej}>
                        <Input id="evento_mej" value={r.evento_mej ?? ""} onChange={e => set("evento_mej", e.target.value)} aria-invalid={!!erros.evento_mej} />
                    </Campo>
                )}

                {vis.categoria && categoria?.opcoes && (
                    <Campo id="categoria" rotulo={categoria.rotulo} obrigatorio erro={erros.categoria}>
                        <Select value={r.categoria ?? ""} onValueChange={v => set("categoria", v)}>
                            <SelectTrigger id="categoria" className="w-full" aria-invalid={!!erros.categoria}><SelectValue placeholder="Escolha" /></SelectTrigger>
                            <SelectContent>
                                {categoria.opcoes.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </Campo>
                )}
                {vis.categoria_execucao && (
                    <Campo id="categoria_execucao" rotulo="Categoria de execução de projetos" erro={erros.categoria_execucao}>
                        <Input id="categoria_execucao" value={r.categoria_execucao ?? ""} onChange={e => set("categoria_execucao", e.target.value)} />
                    </Campo>
                )}
                {vis.outra_categoria && (
                    <Campo id="outra_categoria" rotulo="Outra categoria" erro={erros.outra_categoria}>
                        <Input id="outra_categoria" value={r.outra_categoria ?? ""} onChange={e => set("outra_categoria", e.target.value)} />
                    </Campo>
                )}

                {vis.chave_pix && (
                    <Campo id="chave_pix" rotulo="Chave Pix para reembolso" obrigatorio erro={erros.chave_pix}
                        ajuda="CPF, CNPJ, e-mail, celular (+55...) ou chave aleatória.">
                        <Input id="chave_pix" value={chavePix} onChange={e => { setPixTocado(true); set("chave_pix", e.target.value) }} aria-invalid={!!erros.chave_pix} />
                    </Campo>
                )}

                <div className="grid gap-5 sm:grid-cols-2">
                    <Campo id="eh_pipj" rotulo="É PIPJ?" obrigatorio erro={erros.eh_pipj}>
                        <div><Escolha nome="É PIPJ?" opcoes={SIM_NAO} valor={r.eh_pipj} onChange={v => set("eh_pipj", v)} invalido={!!erros.eh_pipj} /></div>
                    </Campo>
                    <Campo id="eh_retirada_milha" rotulo="É retirada por milha?" obrigatorio erro={erros.eh_retirada_milha}>
                        <div><Escolha nome="É retirada por milha?" opcoes={SIM_NAO} valor={r.eh_retirada_milha} onChange={v => set("eh_retirada_milha", v)} invalido={!!erros.eh_retirada_milha} /></div>
                    </Campo>
                </div>
                {vis.tipo_retirada_milha && (
                    <Campo id="tipo_retirada_milha" rotulo="Tipo de retirada por milha" obrigatorio erro={erros.tipo_retirada_milha}>
                        <Input id="tipo_retirada_milha" value={r.tipo_retirada_milha ?? ""} onChange={e => set("tipo_retirada_milha", e.target.value)} aria-invalid={!!erros.tipo_retirada_milha} />
                    </Campo>
                )}
            </Card>

            <Card className={CARD}>
                <Campo id="comprovantes" rotulo="Anexe o comprovante" obrigatorio erro={erros.comprovantes}>
                    <SeletorArquivos id="comprovantes" arquivos={comprovantes} invalido={!!erros.comprovantes}
                        onChange={f => { setComprovantes(f); setErros(p => ({ ...p, comprovantes: undefined })) }} />
                </Campo>
                {vis.anexo_workday && (
                    <Campo id="anexos_workday" rotulo="Anexo de Workday/SDR" erro={erros.anexos_workday}>
                        <SeletorArquivos id="anexos_workday" arquivos={anexosWorkday} invalido={!!erros.anexos_workday}
                            onChange={f => { setAnexosWorkday(f); setErros(p => ({ ...p, anexos_workday: undefined })) }} />
                    </Campo>
                )}
            </Card>

            {erroGeral && (
                <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                    {erroGeral}
                </p>
            )}

            <div className="flex justify-end">
                <Button type="submit" disabled={enviando || loading} className="bg-amber-500 hover:bg-amber-600 text-white font-semibold w-full sm:w-auto">
                    {enviando ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</> : <><Send className="h-4 w-4" /> Enviar solicitação</>}
                </Button>
            </div>
        </form>
    )
}
