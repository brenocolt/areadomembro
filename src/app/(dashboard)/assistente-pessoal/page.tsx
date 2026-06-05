"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useColaborador } from "@/hooks/use-supabase"
import { Button } from "@/components/ui/button"
import { Sparkles, Send, Bot, User as UserIcon, Loader2, AlertCircle, CalendarCheck, ListTodo, MessageSquareHeart } from "lucide-react"

const INIT_PROMPT = "Faça um resumo da minha rotina e me diga, de forma priorizada, o que devo focar hoje."

const SUGESTOES = [
    { icon: CalendarCheck, label: "Resumo do meu dia", prompt: INIT_PROMPT },
    { icon: ListTodo, label: "O que priorizar?", prompt: "Quais atividades devo priorizar agora? Leve em conta urgência, importância e o tempo estimado de cada uma." },
    { icon: MessageSquareHeart, label: "Resumo dos meus feedbacks", prompt: "Faça um resumo simples e anônimo dos feedbacks que recebi, com pontos fortes e pontos de atenção." },
]

type Msg = { role: "user" | "assistant"; content: string; error?: boolean }

// Renderizador leve de markdown (títulos, negrito, listas) — sem dependências.
function renderMarkdown(text: string) {
    const lines = text.split("\n")
    const out: React.ReactNode[] = []
    let list: React.ReactNode[] = []
    const flush = () => {
        if (list.length) {
            out.push(<ul key={`ul-${out.length}`} className="list-disc pl-5 space-y-1 my-2">{list}</ul>)
            list = []
        }
    }
    const inline = (s: string) => {
        const parts = s.split(/(\*\*[^*]+\*\*)/g)
        return parts.map((p, i) =>
            p.startsWith("**") && p.endsWith("**")
                ? <strong key={i} className="font-bold text-slate-900 dark:text-white">{p.slice(2, -2)}</strong>
                : <span key={i}>{p}</span>
        )
    }
    lines.forEach((raw, idx) => {
        const line = raw.trimEnd()
        if (/^###\s+/.test(line)) { flush(); out.push(<h4 key={idx} className="font-bold text-sm mt-3 mb-1 text-slate-900 dark:text-white">{inline(line.replace(/^###\s+/, ""))}</h4>); return }
        if (/^##\s+/.test(line)) { flush(); out.push(<h3 key={idx} className="font-bold text-base mt-4 mb-1.5 text-violet-600 dark:text-violet-400">{inline(line.replace(/^##\s+/, ""))}</h3>); return }
        if (/^#\s+/.test(line)) { flush(); out.push(<h2 key={idx} className="font-bold text-lg mt-4 mb-2 text-slate-900 dark:text-white">{inline(line.replace(/^#\s+/, ""))}</h2>); return }
        if (/^\s*[-*]\s+/.test(line)) { list.push(<li key={idx} className="text-sm leading-relaxed">{inline(line.replace(/^\s*[-*]\s+/, ""))}</li>); return }
        if (line.trim() === "") { flush(); return }
        flush()
        out.push(<p key={idx} className="text-sm leading-relaxed my-1.5">{inline(line)}</p>)
    })
    flush()
    return out
}

export default function AssistentePessoalPage() {
    const { colaborador, colaboradorId, loading: loadingUser } = useColaborador()
    const firstName = (colaborador?.nome || "").split(" ")[0] || ""

    const [messages, setMessages] = useState<Msg[]>([])
    const [input, setInput] = useState("")
    const [loading, setLoading] = useState(false)
    const scrollRef = useRef<HTMLDivElement>(null)

    const callAgent = useCallback(async (convo: Msg[]): Promise<Msg> => {
        const res = await fetch("/api/assistente-pessoal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: convo.map(m => ({ role: m.role, content: m.content })) }),
        })
        const data = await res.json()
        if (!res.ok) return { role: "assistant", content: data.error || "Erro ao gerar resposta.", error: true }
        return { role: "assistant", content: data.text }
    }, [])

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" })
    }, [messages, loading])

    const sendText = async (text: string) => {
        const value = text.trim()
        if (!value || loading) return
        const next = [...messages, { role: "user" as const, content: value }]
        setMessages(next)
        setInput("")
        setLoading(true)
        const reply = await callAgent(next)
        setMessages([...next, reply])
        setLoading(false)
    }

    const send = () => sendText(input)

    const visible = messages.filter((m, i) => !(i === 0 && m.role === "user" && m.content === INIT_PROMPT))

    return (
        <div className="space-y-6 max-w-3xl mx-auto w-full">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-2xl bg-violet-50 dark:bg-violet-500/10">
                        <Sparkles className="h-6 w-6 text-violet-500" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Assistente Pessoal</h1>
                        <p className="text-sm text-slate-500">Seu agente de rotina: prioridades, PDI, formulários e feedbacks — só seus.</p>
                    </div>
                </div>
                {firstName && (
                    <div className="hidden sm:flex items-center gap-2 text-sm text-slate-400">
                        <Bot className="h-4 w-4 text-violet-400" />
                        <span>Olá, {firstName}</span>
                    </div>
                )}
            </div>

            {/* Chat */}
            <div className="bg-white dark:bg-[#0F172A] rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800 flex flex-col h-[calc(100vh-260px)] min-h-[420px]">
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                    {visible.length === 0 && !loading && (
                        <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 px-6">
                            <Bot className="h-10 w-10 mb-3 text-violet-400" />
                            <p className="text-sm">{firstName ? `Olá, ${firstName}! ` : ""}Como posso te ajudar com a sua rotina hoje?</p>
                            <p className="text-xs mt-1">Escolha uma sugestão abaixo ou escreva a sua pergunta.</p>
                        </div>
                    )}
                    {visible.map((m, i) => (
                        <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                            <div className={`shrink-0 h-8 w-8 rounded-xl flex items-center justify-center ${m.role === "user" ? "bg-slate-100 dark:bg-slate-800" : m.error ? "bg-rose-50 dark:bg-rose-500/10" : "bg-violet-50 dark:bg-violet-500/10"}`}>
                                {m.role === "user" ? <UserIcon className="h-4 w-4 text-slate-500" /> : m.error ? <AlertCircle className="h-4 w-4 text-rose-500" /> : <Sparkles className="h-4 w-4 text-violet-500" />}
                            </div>
                            <div className={`rounded-2xl px-4 py-2.5 max-w-[85%] ${m.role === "user"
                                ? "bg-violet-500 text-white"
                                : m.error
                                    ? "bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-100 dark:border-rose-500/20"
                                    : "bg-slate-50 dark:bg-slate-800/50 text-slate-700 dark:text-slate-200"}`}>
                                {m.role === "user"
                                    ? <p className="text-sm leading-relaxed whitespace-pre-wrap">{m.content}</p>
                                    : <div className="text-slate-700 dark:text-slate-200">{renderMarkdown(m.content)}</div>}
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div className="flex gap-3">
                            <div className="shrink-0 h-8 w-8 rounded-xl flex items-center justify-center bg-violet-50 dark:bg-violet-500/10">
                                <Sparkles className="h-4 w-4 text-violet-500" />
                            </div>
                            <div className="rounded-2xl px-4 py-3 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2 text-slate-400">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                <span className="text-sm">Pensando…</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Sugestões rápidas */}
                {!loading && (
                    <div className="px-3 sm:px-4 pt-2 flex flex-wrap gap-2">
                        {SUGESTOES.map(s => (
                            <button
                                key={s.label}
                                onClick={() => sendText(s.prompt)}
                                className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 hover:bg-violet-50 dark:hover:bg-violet-500/10 hover:text-violet-600 dark:hover:text-violet-300 border border-slate-200 dark:border-slate-700 rounded-full px-3 py-1.5 transition-colors"
                            >
                                <s.icon className="h-3.5 w-3.5" />{s.label}
                            </button>
                        ))}
                    </div>
                )}

                {/* Input */}
                <div className="border-t border-slate-100 dark:border-slate-800 p-3 sm:p-4 mt-2">
                    <div className="flex items-end gap-2">
                        <textarea
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send() } }}
                            placeholder="Pergunte sobre sua rotina, prioridades, PDI ou feedbacks…"
                            rows={1}
                            disabled={loading}
                            className="flex-1 resize-none bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2.5 text-sm text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-violet-500/30 max-h-32"
                        />
                        <Button onClick={send} disabled={loading || !input.trim()} className="shrink-0 rounded-xl bg-violet-500 hover:bg-violet-600 h-10 w-10 p-0">
                            <Send className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    )
}
