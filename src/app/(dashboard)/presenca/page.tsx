"use client"

import { Suspense, useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { CheckCircle2, Clock, KeyRound, Loader2, MapPin, QrCode, ScanLine } from "lucide-react"
import { toast } from "sonner"
import { SituacaoBadge, formatarData, formatarHorario } from "@/components/reunioes/situacao-badge"
import { LeitorQr } from "./components/leitor-qr"

interface MinhaReuniao {
    id: string
    titulo: string
    descricao: string | null
    local: string | null
    inicio: string
    limite_chegada: string
    encerramento: string
    fase: 'qr' | 'codigo' | 'encerrada' | 'cancelada'
    situacao: string
    registrado_em: string | null
}

// O QR code aponta para /presenca?r=<reunião>&t=<token>.
function extrairQr(texto: string): { reuniaoId: string, token: string } | null {
    try {
        const url = new URL(texto, window.location.origin)
        const reuniaoId = url.searchParams.get('r')
        const token = url.searchParams.get('t')
        if (url.pathname === '/presenca' && reuniaoId && token) return { reuniaoId, token }
    } catch { /* texto não é uma URL */ }
    return null
}

function PresencaConteudo() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [reunioes, setReunioes] = useState<MinhaReuniao[]>([])
    const [loading, setLoading] = useState(true)
    const [erro, setErro] = useState<string | null>(null)
    const [lendo, setLendo] = useState(false)
    const [enviando, setEnviando] = useState<string | null>(null)
    const [agora, setAgora] = useState(0)
    const [codigos, setCodigos] = useState<Record<string, string>>({})
    // QR lido pela câmera do próprio celular (link aberto fora do app):
    // pede um toque para confirmar.
    const [qrPendente, setQrPendente] = useState<{ reuniaoId: string, token: string } | null>(null)

    const carregar = useCallback(async () => {
        const res = await fetch('/api/reunioes/minhas', { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        setLoading(false)
        if (!res.ok) {
            setErro(json.error || 'Erro ao carregar suas reuniões.')
            return
        }
        setErro(null)
        setReunioes(json.reunioes)
        setAgora(json.agora)
    }, [])

    useEffect(() => { carregar() }, [carregar])

    useEffect(() => {
        const r = searchParams.get('r')
        const t = searchParams.get('t')
        if (r && t) setQrPendente({ reuniaoId: r, token: t })
    }, [searchParams])

    const enviar = useCallback(async (reuniaoId: string, dados: { token?: string, codigo?: string }) => {
        setEnviando(reuniaoId)
        const res = await fetch('/api/reunioes/presenca', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reuniao_id: reuniaoId, ...dados }),
        })
        const json = await res.json().catch(() => ({}))
        setEnviando(null)
        if (!res.ok) {
            toast.error(json.error || 'Não foi possível confirmar a presença.')
            carregar()
            return false
        }
        if (json.jaRegistrada) toast.info('Sua presença já estava registrada.')
        else if (json.situacao === 'atrasado') toast.warning('Presença registrada com atraso. Você foi pré-pontuado — a gestão vai confirmar ou revogar.')
        else toast.success('Presença confirmada! Bom trabalho chegando no horário.')
        carregar()
        return true
    }, [carregar])

    const confirmarQrPendente = async () => {
        if (!qrPendente) return
        await enviar(qrPendente.reuniaoId, { token: qrPendente.token })
        setQrPendente(null)
        router.replace('/presenca')
    }

    const onLido = useCallback((texto: string) => {
        setLendo(false)
        const qr = extrairQr(texto)
        if (!qr) {
            toast.error('Esse QR code não é de presença em reunião.')
            return
        }
        enviar(qr.reuniaoId, { token: qr.token })
    }, [enviar])

    const emAndamento = reunioes.filter(r => r.fase === 'qr' || r.fase === 'codigo')
    const historico = reunioes.filter(r => r.fase === 'encerrada')
    const reuniaoDoQr = qrPendente ? reunioes.find(r => r.id === qrPendente.reuniaoId) : null

    return (
        <div className="space-y-6 max-w-3xl">
            <div>
                <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white">Presença em Reuniões</h1>
                <p className="text-sm text-slate-500">Leia o QR code exibido na reunião até o horário limite de chegada. Depois dele, confirme com o código mostrado na tela — nesse caso a presença conta como atraso.</p>
            </div>

            {qrPendente && (
                <Card className="border-2 border-emerald-300 dark:border-emerald-500/40 bg-emerald-50 dark:bg-emerald-500/10 rounded-3xl">
                    <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                        <div className="flex-1">
                            <p className="font-bold text-slate-900 dark:text-white">QR code lido{reuniaoDoQr ? `: ${reuniaoDoQr.titulo}` : ''}</p>
                            <p className="text-sm text-slate-600 dark:text-slate-300">Toque em confirmar para registrar sua presença.</p>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => { setQrPendente(null); router.replace('/presenca') }}>Agora não</Button>
                            <Button onClick={confirmarQrPendente} disabled={!!enviando} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                                {enviando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
                                Confirmar presença
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Button onClick={() => setLendo(true)} size="lg" className="w-full sm:w-auto h-14 text-base rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25">
                <ScanLine className="h-5 w-5 mr-2" /> Ler QR code da reunião
            </Button>

            {erro && <div className="rounded-2xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 p-4 text-sm text-rose-700 dark:text-rose-300">{erro}</div>}

            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none rounded-3xl shadow-sm">
                <CardHeader className="border-b border-slate-100 dark:border-white/5 pb-4">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Reuniões de agora e próximas</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-3">
                    {loading ? <p className="text-sm text-slate-400 italic text-center py-8">Carregando...</p>
                        : emAndamento.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Nenhuma reunião agendada para você.</p>
                        : emAndamento.slice().reverse().map(r => {
                            const confirmado = r.situacao === 'presente' || r.situacao === 'atrasado'
                            const comecou = agora >= new Date(r.inicio).getTime()
                            return (
                                <div key={r.id} className="rounded-2xl border border-slate-100 dark:border-white/5 p-4 space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-slate-900 dark:text-white">{r.titulo}</span>
                                                <SituacaoBadge situacao={r.situacao} />
                                            </div>
                                            <p className="text-xs text-slate-500 mt-1 flex items-center gap-3 flex-wrap">
                                                <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> {formatarData(r.inicio)} · {formatarHorario(r.inicio)} · chegada até {formatarHorario(r.limite_chegada)}</span>
                                                {r.local && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {r.local}</span>}
                                            </p>
                                            {r.registrado_em && <p className="text-xs text-slate-500 mt-1">Confirmado às {formatarHorario(r.registrado_em)}</p>}
                                        </div>
                                    </div>

                                    {!confirmado && r.fase === 'qr' && (
                                        <p className="text-xs text-slate-500 flex items-center gap-1.5">
                                            <QrCode className="h-3.5 w-3.5" />
                                            {comecou ? 'Em andamento — leia o QR code agora.' : 'Leia o QR code quando chegar na reunião.'}
                                        </p>
                                    )}

                                    {!confirmado && r.fase === 'codigo' && (
                                        <form
                                            className="flex flex-col sm:flex-row gap-2"
                                            onSubmit={async e => {
                                                e.preventDefault()
                                                const ok = await enviar(r.id, { codigo: codigos[r.id] || '' })
                                                if (ok) setCodigos(c => ({ ...c, [r.id]: '' }))
                                            }}
                                        >
                                            <div className="relative flex-1">
                                                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                                                <Input
                                                    inputMode="numeric"
                                                    autoComplete="one-time-code"
                                                    maxLength={6}
                                                    placeholder="Código de 6 dígitos"
                                                    value={codigos[r.id] || ''}
                                                    onChange={e => setCodigos(c => ({ ...c, [r.id]: e.target.value.replace(/\D/g, '') }))}
                                                    className="pl-9 h-11 font-mono tracking-widest"
                                                />
                                            </div>
                                            <Button type="submit" disabled={enviando === r.id || (codigos[r.id] || '').length !== 6} className="h-11">
                                                {enviando === r.id && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Confirmar com código
                                            </Button>
                                        </form>
                                    )}
                                    {!confirmado && r.fase === 'codigo' && (
                                        <p className="text-[11px] text-amber-600 dark:text-amber-400">O horário limite de chegada passou: confirmar com código registra atraso (pré-pontuação). Sem confirmar até {formatarHorario(r.encerramento)}, fica registrada falta.</p>
                                    )}
                                </div>
                            )
                        })}
                </CardContent>
            </Card>

            <Card className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-none rounded-3xl shadow-sm">
                <CardHeader className="border-b border-slate-100 dark:border-white/5 pb-4">
                    <CardTitle className="text-base font-bold text-slate-900 dark:text-white">Últimos 30 dias</CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-1">
                    {loading ? <p className="text-sm text-slate-400 italic text-center py-8">Carregando...</p>
                        : historico.length === 0 ? <p className="text-sm text-slate-400 text-center py-8">Nenhuma reunião encerrada.</p>
                        : historico.map(r => (
                            <div key={r.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-white/5">
                                <div className="min-w-0">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{r.titulo}</p>
                                    <p className="text-[11px] text-slate-500">{formatarData(r.inicio)} · {formatarHorario(r.inicio)}</p>
                                </div>
                                <SituacaoBadge situacao={r.situacao} />
                            </div>
                        ))}
                </CardContent>
            </Card>

            <LeitorQr open={lendo} onOpenChange={setLendo} onLido={onLido} />
        </div>
    )
}

export default function PresencaPage() {
    return (
        <Suspense fallback={null}>
            <PresencaConteudo />
        </Suspense>
    )
}
