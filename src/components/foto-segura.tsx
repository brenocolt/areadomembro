"use client"

import { useState, type ImgHTMLAttributes } from "react"
import { ehHeic, urlExibivelDeHeic } from "@/lib/heic"

/**
 * Igual a uma <img>, mas se a foto for HEIC (iPhone) e o navegador não
 * conseguir mostrar, converte para JPEG na hora e exibe.
 * `onFalha` é chamado quando a foto não pode ser exibida de jeito nenhum.
 */
export function FotoSegura({
    src,
    onFalha,
    className,
    ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> & { src: string; onFalha?: () => void }) {
    // Guarda de qual endereço veio a versão convertida, para não misturar
    // caso o componente passe a mostrar outra foto.
    const [convertida, setConvertida] = useState<{ de: string; para: string } | null>(null)
    const [convertendo, setConvertendo] = useState(false)
    const exibir = convertida?.de === src ? convertida.para : src

    function aoFalhar() {
        if (exibir === src && ehHeic(src) && !convertendo) {
            setConvertendo(true)
            urlExibivelDeHeic(src)
                .then(para => setConvertida({ de: src, para }))
                .catch(() => onFalha?.())
                .finally(() => setConvertendo(false))
        } else {
            onFalha?.()
        }
    }

    return (
        // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
        <img {...props} src={exibir} onError={aoFalhar} className={[className, convertendo ? "animate-pulse" : ""].filter(Boolean).join(" ")} />
    )
}
