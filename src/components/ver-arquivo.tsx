"use client"

import { useState, type MouseEvent, type ReactNode } from "react"
import { Download, FileWarning } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cn } from "@/lib/utils"
import { FotoSegura } from "@/components/foto-segura"

type TipoArquivo = "imagem" | "pdf" | "desconhecido"

const EXT_IMAGEM = ["jpg", "jpeg", "png", "gif", "webp", "bmp", "svg", "avif", "heic", "heif"]

function tipoDoArquivo(url: string): TipoArquivo {
    let caminho = url
    try { caminho = new URL(url).pathname } catch { /* usa a string como veio */ }
    const ext = caminho.split(".").pop()?.toLowerCase() ?? ""
    if (EXT_IMAGEM.includes(ext)) return "imagem"
    if (ext === "pdf") return "pdf"
    return "desconhecido"
}

/**
 * Abre fotos e comprovantes numa janela por cima da própria área do membro,
 * em vez de mandar o usuário para outra aba.
 *
 * Uso: <VerArquivo url={url} className="...">Ver comprovante</VerArquivo>
 */
export function VerArquivo({
    url,
    children,
    className,
    titulo = "Visualizar arquivo",
}: {
    url: string | null | undefined
    children: ReactNode
    className?: string
    titulo?: string
}) {
    const [aberto, setAberto] = useState(false)
    const [falhou, setFalhou] = useState(false)

    if (!url || !/^https?:\/\//i.test(url)) return null

    const tipo = tipoDoArquivo(url)

    function abrir(e: MouseEvent) {
        // Evita enviar formulários ou disparar cliques de elementos "pais".
        e.preventDefault()
        e.stopPropagation()
        setFalhou(false)
        setAberto(true)
    }

    return (
        <>
            <button type="button" onClick={abrir} title={titulo} className={cn("cursor-pointer text-left", className)}>
                {children}
            </button>
            <Dialog open={aberto} onOpenChange={setAberto}>
                <DialogContent className="sm:max-w-4xl w-full p-4 gap-3">
                    <DialogHeader>
                        <DialogTitle>{titulo}</DialogTitle>
                        <DialogDescription className="sr-only">Pré-visualização do arquivo</DialogDescription>
                    </DialogHeader>

                    <div className="flex items-center justify-center rounded-lg bg-slate-100 dark:bg-white/5 overflow-hidden min-h-[200px]">
                        {tipo === "pdf" ? (
                            <iframe src={url} title={titulo} className="w-full h-[75vh] bg-white" />
                        ) : !falhou ? (
                            <FotoSegura
                                src={url}
                                alt={titulo}
                                className="max-h-[75vh] w-auto max-w-full object-contain"
                                onFalha={() => setFalhou(true)}
                            />
                        ) : (
                            <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-slate-500">
                                <FileWarning className="h-8 w-8" />
                                <p>Este tipo de arquivo não pode ser exibido aqui.</p>
                                <p>Use o botão &quot;Baixar arquivo&quot; abaixo para abri-lo.</p>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end">
                        <a
                            href={url}
                            download
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300 hover:underline"
                        >
                            <Download className="h-3.5 w-3.5" /> Baixar arquivo
                        </a>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
