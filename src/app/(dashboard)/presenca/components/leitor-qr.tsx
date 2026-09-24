"use client"
import { useEffect, useRef, useState } from "react"
import jsQR from "jsqr"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"

// Lê o QR code pela câmera traseira e devolve o texto decodificado.
// A câmera só funciona em HTTPS (ou localhost).
export function LeitorQr({ open, onOpenChange, onLido }: {
    open: boolean
    onOpenChange: (open: boolean) => void
    onLido: (texto: string) => void
}) {
    const videoRef = useRef<HTMLVideoElement>(null)
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const [erro, setErro] = useState<string | null>(null)

    useEffect(() => {
        if (!open) return
        let stream: MediaStream | null = null
        let frame = 0
        let ativo = true
        setErro(null)

        const ler = () => {
            if (!ativo) return
            const video = videoRef.current
            const canvas = canvasRef.current
            if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
                canvas.width = video.videoWidth
                canvas.height = video.videoHeight
                const ctx = canvas.getContext('2d', { willReadFrequently: true })
                if (ctx) {
                    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
                    const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
                    const qr = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })
                    if (qr?.data) {
                        ativo = false
                        onLido(qr.data)
                        return
                    }
                }
            }
            frame = requestAnimationFrame(ler)
        }

        // Fora de HTTPS (ex.: acessando pelo IP da rede em desenvolvimento)
        // o navegador nem expõe a câmera — mas o QR é um link, então a
        // câmera nativa do celular resolve.
        if (!window.isSecureContext) {
            setErro('A câmera só pode ser usada aqui com conexão segura (HTTPS). Abra o app de câmera do celular e aponte para o QR code — o link abre esta página para você confirmar.')
            return
        }
        if (!navigator.mediaDevices?.getUserMedia) {
            setErro('Este navegador não permite usar a câmera aqui. Abra o app de câmera do celular e aponte para o QR code.')
            return
        }

        navigator.mediaDevices
            .getUserMedia({ video: { facingMode: 'environment' }, audio: false })
            .then(s => {
                if (!ativo) { s.getTracks().forEach(t => t.stop()); return }
                stream = s
                if (videoRef.current) {
                    videoRef.current.srcObject = s
                    videoRef.current.play().catch(() => {})
                }
                frame = requestAnimationFrame(ler)
            })
            .catch(() => setErro('Não foi possível acessar a câmera. Libere a permissão no navegador ou use a câmera do celular apontando para o QR code.'))

        return () => {
            ativo = false
            cancelAnimationFrame(frame)
            stream?.getTracks().forEach(t => t.stop())
        }
    }, [open, onLido])

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[440px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <DialogHeader>
                    <DialogTitle className="font-display">Ler QR code</DialogTitle>
                    <DialogDescription>Aponte a câmera para o QR code exibido na reunião.</DialogDescription>
                </DialogHeader>
                {erro ? (
                    <p className="text-sm text-rose-600 dark:text-rose-400 py-6 text-center">{erro}</p>
                ) : (
                    <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black">
                        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
                        <div className="pointer-events-none absolute inset-[15%] rounded-2xl border-2 border-white/80" />
                    </div>
                )}
                <canvas ref={canvasRef} className="hidden" />
            </DialogContent>
        </Dialog>
    )
}
