"use client"

import { useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { lerPlanilhaGasolina, type PlanilhaGasolina } from "@/lib/gasolina-planilha"
import type { RelatorioImportacao, SituacaoAba } from "@/lib/gasolina-importacao"
import { gasolinaApi } from "./api"

const SITUACAO: Record<SituacaoAba, { texto: string, cor: string }> = {
    importar: { texto: "Vai importar", cor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
    ambiguo: { texto: "Escolha o membro", cor: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
    nao_encontrado: { texto: "Sem cadastro — fica de fora", cor: "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400" },
    nao_importar: { texto: "Não importar", cor: "bg-slate-200 text-slate-600 dark:bg-white/10 dark:text-slate-400" },
    ja_importado: { texto: "Já importado", cor: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300" },
    sem_viagens: { texto: "Sem viagens desde 01/01/2026", cor: "bg-slate-100 text-slate-500 dark:bg-white/5 dark:text-slate-500" },
}

// Fase 4: traz para o app as viagens da planilha antiga (desde 01/01/2026),
// só de quem tem cadastro. Primeiro simula (relatório), depois grava.
export function ImportarPlanilha() {
    const [planilha, setPlanilha] = useState<PlanilhaGasolina | null>(null)
    const [relatorio, setRelatorio] = useState<RelatorioImportacao | null>(null)
    const [mapeamento, setMapeamento] = useState<Record<string, string | null>>({})
    const [carregando, setCarregando] = useState(false)
    const [concluido, setConcluido] = useState<RelatorioImportacao | null>(null)

    async function simular(dados: PlanilhaGasolina, mapa?: Record<string, string | null>) {
        setCarregando(true)
        try {
            const r = await gasolinaApi<RelatorioImportacao>("/api/gasolina/importacao?modo=simular", {
                method: "POST",
                body: JSON.stringify({ planilha: dados, mapeamento: mapa }),
            })
            setRelatorio(r)
            if (!mapa) setMapeamento(Object.fromEntries(r.abas.filter(a => a.situacao !== "sem_viagens").map(a => [a.aba, a.colaborador?.id ?? null])))
        } catch (e) {
            toast.error((e as Error).message)
        } finally {
            setCarregando(false)
        }
    }

    function escolherArquivo(e: React.ChangeEvent<HTMLInputElement>) {
        const arquivo = e.target.files?.[0]
        if (!arquivo) return
        setRelatorio(null); setConcluido(null); setPlanilha(null)
        const leitor = new FileReader()
        leitor.onload = evt => {
            try {
                const dados = lerPlanilhaGasolina(XLSX.read(evt.target?.result, { type: "array" }))
                if (!dados.abas.length) { toast.error("Não encontrei abas de membros nesse arquivo."); return }
                setPlanilha(dados)
                simular(dados)
            } catch (err) {
                console.error("Erro ao ler a planilha:", err)
                toast.error("Não foi possível ler o arquivo. Use o download em .xlsx da planilha de gasolina.")
            }
        }
        leitor.readAsArrayBuffer(arquivo)
    }

    async function importar() {
        if (!planilha || !relatorio) return
        const n = relatorio.totais
        if (!confirm(`Importar ${n.viagens} viagens de ${n.membros} membros? Isso grava no sistema.`)) return
        setCarregando(true)
        try {
            const r = await gasolinaApi<RelatorioImportacao>("/api/gasolina/importacao?modo=gravar", {
                method: "POST",
                body: JSON.stringify({ planilha, mapeamento }),
            })
            setConcluido(r)
            setRelatorio(null)
            toast.success(`Importação concluída: ${r.totais.viagens} viagens de ${r.totais.membros} membros.`)
        } catch (e) {
            toast.error((e as Error).message + " Você pode tentar de novo: quem já entrou é pulado.")
        } finally {
            setCarregando(false)
        }
    }

    function trocarMembro(aba: string, id: string) {
        if (!planilha) return
        const novo = { ...mapeamento, [aba]: id || null }
        setMapeamento(novo)
        simular(planilha, novo)
    }

    const resumo = useMemo(() => {
        if (!relatorio) return null
        const fora = relatorio.abas.filter(a => a.situacao === "nao_encontrado" || a.situacao === "ambiguo" || a.situacao === "nao_importar")
        return {
            fora,
            semData: relatorio.abas.reduce((s, a) => s + (a.situacao === "importar" ? a.sem_data : 0), 0),
            projetos: relatorio.abas.filter(a => a.situacao === "importar" && a.projetos_fora_do_monday.length),
        }
    }, [relatorio])

    return (
        <Card>
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-emerald-600" /> Importar a planilha antiga</CardTitle>
                <CardDescription>
                    Traz as viagens desde 01/01/2026 da planilha &quot;REEMBOLSO GASOLINA&quot;, só de quem tem cadastro na Área do Membro.
                    Primeiro aparece uma simulação; nada é gravado até você clicar em &quot;Importar&quot;. Pode rodar de novo: quem já foi importado é pulado.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                <div className="space-y-1.5">
                    <p className="text-sm">No Google Planilhas: <b>Arquivo → Fazer download → Microsoft Excel (.xlsx)</b>, depois escolha o arquivo aqui.</p>
                    <Input type="file" accept=".xlsx" onChange={escolherArquivo} disabled={carregando} className="sm:max-w-sm" />
                </div>

                {carregando && <p className="text-sm text-slate-500 flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Processando...</p>}

                {concluido && (
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-500/10 p-4 text-sm space-y-1">
                        <p className="font-semibold flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Importação concluída</p>
                        <p>{concluido.totais.viagens} viagens de {concluido.totais.membros} membros, {concluido.totais.carros} carros e {concluido.precos_novos} preços de mês.</p>
                        <p className="text-slate-500">Os carros importados ficam sem foto do painel — os membros podem cadastrar de novo com foto quando quiserem.</p>
                    </div>
                )}

                {relatorio && resumo && !carregando && (
                    <div className="space-y-4">
                        <div className="rounded-xl bg-slate-50 dark:bg-white/5 p-4 text-sm space-y-1">
                            <p className="font-semibold">Simulação</p>
                            <p>Vão entrar <b>{relatorio.totais.viagens} viagens</b> de <b>{relatorio.totais.membros} membros</b>, {relatorio.totais.carros} carros e {relatorio.precos_novos} preços de mês que ainda não estavam lançados.</p>
                            {resumo.fora.length > 0 && <p>{resumo.fora.length} aba(s) com viagens ficam de fora (sem cadastro ou sem membro escolhido) — veja na tabela.</p>}
                            {resumo.semData > 0 && <p>{resumo.semData} viagem(ns) sem data na planilha não entram (não dá para saber o ano).</p>}
                            {relatorio.aviso_monday && <p className="text-amber-700 flex items-start gap-1"><AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" /> {relatorio.aviso_monday}</p>}
                            {resumo.projetos.length > 0 && (
                                <p className="text-amber-700 flex items-start gap-1">
                                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                                    Algumas viagens pendentes têm projeto que não existe na lista do Monday. Elas entram, mas o membro precisa editar a viagem e escolher o projeto certo antes de solicitar.
                                </p>
                            )}
                        </div>

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Aba da planilha</TableHead>
                                    <TableHead>Membro na Área do Membro</TableHead>
                                    <TableHead>Viagens</TableHead>
                                    <TableHead className="hidden md:table-cell">Observações</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {relatorio.abas.filter(a => a.situacao !== "sem_viagens").map(a => (
                                    <TableRow key={a.aba}>
                                        <TableCell className="font-medium">
                                            {a.aba}
                                            {a.oculta && <span className="block text-xs text-slate-500">aba oculta</span>}
                                        </TableCell>
                                        <TableCell>
                                            {a.situacao === "ja_importado" ? (
                                                <span className="text-sm">{a.colaborador?.nome}</span>
                                            ) : (
                                                <select
                                                    className="w-full max-w-56 rounded-md border border-slate-200 dark:border-white/10 bg-transparent px-2 py-1 text-sm"
                                                    value={mapeamento[a.aba] ?? ""}
                                                    onChange={e => trocarMembro(a.aba, e.target.value)}
                                                >
                                                    <option value="">— não importar —</option>
                                                    {a.candidatos.length > 0 && (
                                                        <optgroup label="Sugestões">
                                                            {a.candidatos.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                                        </optgroup>
                                                    )}
                                                    <optgroup label="Todos">
                                                        {relatorio.colaboradores.map(c => <option key={c.id} value={c.id}>{c.nome}</option>)}
                                                    </optgroup>
                                                </select>
                                            )}
                                            <Badge variant="secondary" className={`mt-1 border-none ${SITUACAO[a.situacao].cor}`}>{SITUACAO[a.situacao].texto}</Badge>
                                        </TableCell>
                                        <TableCell className="text-sm whitespace-nowrap">
                                            {a.situacao === "importar" ? (
                                                <>
                                                    {a.viagens.Pendente} pend. · {a.viagens.Reembolsado} reemb. · {a.viagens.Vencido} venc.
                                                </>
                                            ) : "—"}
                                        </TableCell>
                                        <TableCell className="hidden md:table-cell text-xs text-slate-500">
                                            {[
                                                a.carros_novos.length ? `Carros novos: ${a.carros_novos.join(", ")}` : "",
                                                a.sem_data ? `${a.sem_data} sem data` : "",
                                                a.sem_litros ? `${a.sem_litros} sem litros` : "",
                                                a.projetos_fora_do_monday.length ? `Projeto fora do Monday: ${a.projetos_fora_do_monday.join(", ")}` : "",
                                            ].filter(Boolean).join(" · ")}
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>

                        <Button onClick={importar} disabled={carregando || !relatorio.totais.viagens} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                            <Upload className="h-4 w-4" /> Importar {relatorio.totais.viagens} viagens
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    )
}
