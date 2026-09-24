"use client"

// Tela que o organizador projeta na reunião. Fica fora do layout do
// dashboard (sem menu lateral) para ocupar a tela toda. O QR code muda a
// cada 30s (ver src/lib/reunioes.ts); depois do limite de chegada a tela
// troca o QR pelo código de atraso.
import { use, useCallback, useEffect, useRef, useState } from "react"
import QRCode from "qrcode"
import { Maximize, Minimize, Users } from "lucide-react"

interface EstadoApresentacao {
    reuniao: { titulo: string, local: string | null, inicio: string, limite_chegada: string, encerramento: string }
    fase: 'qr' | 'codigo' | 'encerrada' | 'cancelada'
    agora: number
    token: string | null
    tokenExpiraEm: number | null
    codigo: string | null
    totalParticipantes: number
    totalPresentes: number
    totalAtrasados: number
}

const INTERVALO_MS = 3000

function hora(iso: string) {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function contagem(ms: number) {
    const s = Math.max(0, Math.floor(ms / 1000))
    const h = Math.floor(s / 3600)
    const m = Math.floor((s % 3600) / 60)
    const seg = s % 60
    const mmss = `${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}`
    return h > 0 ? `${h}:${mmss}` : mmss
}

export default function ApresentacaoReuniaoPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)
    const [estado, setEstado] = useState<EstadoApresentacao | null>(null)
    const [erro, setErro] = useState<string | null>(null)
    const [qrDataUrl, setQrDataUrl] = useState<string | null>(null)
    const [telaCheia, setTelaCheia] = useState(false)
    // Diferença entre o relógio do servidor e o deste computador — a
    // contagem regressiva segue o servidor, que é quem decide o prazo.
    const [offset, setOffset] = useState(0)
    const [relogio, setRelogio] = useState(() => Date.now())
    const ultimoToken = useRef<string | null>(null)

    const atualizar = useCallback(async () => {
        const res = await fetch(`/api/reunioes/${id}/apresentacao`, { cache: 'no-store' })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
            setErro(json.error || 'Erro ao carregar a reunião.')
            return
        }
        setErro(null)
        setOffset(json.agora - Date.now())
        setEstado(json)
        if (json.token && json.token !== ultimoToken.current) {
            ultimoToken.current = json.token
            const url = `${window.location.origin}/presenca?r=${id}&t=${encodeURIComponent(json.token)}`
            setQrDataUrl(await QRCode.toDataURL(url, { width: 640, margin: 1, errorCorrectionLevel: 'M' }))
        }
        if (!json.token) {
            ultimoToken.current = null
            setQrDataUrl(null)
        }
    }, [id])

    useEffect(() => {
        atualizar()
        const poll = setInterval(atualizar, INTERVALO_MS)
        const tick = setInterval(() => setRelogio(Date.now()), 1000)
        return () => { clearInterval(poll); clearInterval(tick) }
    }, [atualizar])

    useEffect(() => {
        const onChange = () => setTelaCheia(!!document.fullscreenElement)
        document.addEventListener('fullscreenchange', onChange)
        return () => document.removeEventListener('fullscreenchange', onChange)
    }, [])

    const alternarTelaCheia = () => {
        if (document.fullscreenElement) document.exitFullscreen()
        else document.documentElement.requestFullscreen().catch(() => {})
    }

    const agora = relogio + offset

    if (erro && !estado) {
        return <div className="min-h-screen flex items-center justify-center bg-[#0B1120] text-rose-300 p-6 text-center">{erro}</div>
    }
    if (!estado) {
        return <div className="min-h-screen flex items-center justify-center bg-[#0B1120]"><div className="h-10 w-10 rounded-full border-2 border-violet-400 border-t-transparent animate-spin" /></div>
    }

    const { reuniao, fase } = estado
    const confirmados = estado.totalPresentes + estado.totalAtrasados

    return (
        <div className="min-h-screen bg-[#0B1120] text-white flex flex-col">
            <header className="flex items-center justify-between gap-4 px-6 md:px-10 py-5">
                <div className="flex items-center gap-3 min-w-0">
                    <img src="/logo-produtiva.png" alt="" className="h-9 w-9 object-contain" />
                    <div className="min-w-0">
                        <h1 className="text-xl md:text-2xl font-display font-bold truncate">{reuniao.titulo}</h1>
                        <p className="text-sm text-slate-400 truncate">
                            Início {hora(reuniao.inicio)} · limite de chegada {hora(reuniao.limite_chegada)}{reuniao.local ? ` · ${reuniao.local}` : ''}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                    <div className="flex items-center gap-2 text-slate-300">
                        <Users className="h-5 w-5" />
                        <span className="text-lg font-bold tabular-nums">{confirmados}/{estado.totalParticipantes}</span>
                    </div>
                    <button onClick={alternarTelaCheia} title="Tela cheia" className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/10">
                        {telaCheia ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                    </button>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center px-6 pb-10 text-center">
                {fase === 'qr' && (
                    <>
                        <p className="text-lg md:text-2xl text-slate-300 mb-6">
                            Abra a <strong className="text-white">Área do Membro → Presença em Reuniões</strong> ou aponte a câmera do celular
                        </p>
                        <div className="bg-white p-4 md:p-6 rounded-3xl shadow-2xl shadow-violet-500/20">
                            {qrDataUrl
                                ? <img src={qrDataUrl} alt="QR code de presença" className="w-[min(70vw,60vh)] h-[min(70vw,60vh)]" />
                                : <div className="w-[min(70vw,60vh)] h-[min(70vw,60vh)]" />}
                        </div>
                        <p className="mt-6 text-slate-400">Chegada no horário até <strong className="text-white">{hora(reuniao.limite_chegada)}</strong></p>
                        <p className="text-5xl md:text-7xl font-bold tabular-nums mt-2 text-emerald-400">
                            {contagem(new Date(reuniao.limite_chegada).getTime() - agora)}
                        </p>
                        {estado.tokenExpiraEm && (
                            <p className="text-xs text-slate-500 mt-3">O QR code muda em {contagem(estado.tokenExpiraEm - agora)}</p>
                        )}
                    </>
                )}

                {fase === 'codigo' && (
                    <>
                        <p className="text-amber-400 font-bold uppercase tracking-widest text-sm md:text-base">Horário limite de chegada encerrado</p>
                        <p className="text-lg md:text-2xl text-slate-300 mt-4">Chegou agora? Confirme sua presença em <strong className="text-white">Presença em Reuniões</strong> com o código:</p>
                        <p className="font-mono font-bold tracking-[0.2em] text-[min(18vw,11rem)] leading-none mt-6 text-white">
                            {estado.codigo}
                        </p>
                        <p className="text-slate-400 mt-8">A confirmação por código registra atraso. Disponível até {hora(reuniao.encerramento)} ({contagem(new Date(reuniao.encerramento).getTime() - agora)}).</p>
                    </>
                )}

                {fase === 'encerrada' && (
                    <>
                        <p className="text-3xl md:text-5xl font-display font-bold">Reunião encerrada</p>
                        <p className="text-slate-400 mt-4">{estado.totalPresentes} presentes · {estado.totalAtrasados} atrasados · {estado.totalParticipantes - confirmados} sem confirmação</p>
                    </>
                )}

                {fase === 'cancelada' && (
                    <p className="text-3xl md:text-5xl font-display font-bold text-rose-400">Reunião cancelada</p>
                )}

                {erro && <p className="text-rose-300 text-sm mt-6">{erro} — tentando de novo...</p>}
            </main>
        </div>
    )
}
