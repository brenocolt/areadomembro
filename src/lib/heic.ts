// Fotos de iPhone costumam vir no formato HEIC, que o Chrome/Windows não
// conseguem exibir. Aqui ficam as funções que convertem HEIC para JPEG no
// próprio navegador (a biblioteca só é baixada quando realmente precisa).

const EXT_HEIC = /\.(heic|heif)$/i

/** Diz se um arquivo enviado (ou um endereço de arquivo) é HEIC/HEIF. */
export function ehHeic(arquivoOuUrl: File | string): boolean {
    if (typeof arquivoOuUrl === "string") {
        let caminho = arquivoOuUrl
        try { caminho = new URL(arquivoOuUrl).pathname } catch { /* usa como veio */ }
        return EXT_HEIC.test(caminho)
    }
    const tipo = arquivoOuUrl.type.toLowerCase()
    return tipo === "image/heic" || tipo === "image/heif" || EXT_HEIC.test(arquivoOuUrl.name)
}

/** Converte um HEIC (Blob) em JPEG. */
export async function heicParaJpeg(blob: Blob): Promise<Blob> {
    const { default: heic2any } = await import("heic2any")
    const resultado = await heic2any({ blob, toType: "image/jpeg", quality: 0.85 })
    return Array.isArray(resultado) ? resultado[0] : resultado
}

/**
 * Antes de enviar uma foto: se for HEIC, devolve uma cópia em JPEG
 * (com o nome terminando em .jpg). Qualquer outro arquivo volta igual.
 */
export async function prepararImagemParaEnvio(arquivo: File): Promise<File> {
    if (!ehHeic(arquivo)) return arquivo
    const jpeg = await heicParaJpeg(arquivo)
    const nome = arquivo.name.replace(EXT_HEIC, "") + ".jpg"
    return new File([jpeg], nome, { type: "image/jpeg" })
}

const cacheConvertidas = new Map<string, Promise<string>>()

/**
 * Para fotos HEIC que já estão salvas: baixa e converte para JPEG, devolvendo
 * um endereço temporário que o navegador consegue mostrar.
 */
export function urlExibivelDeHeic(url: string): Promise<string> {
    let pronto = cacheConvertidas.get(url)
    if (!pronto) {
        pronto = fetch(url)
            .then(r => {
                if (!r.ok) throw new Error(`Falha ao baixar a foto (${r.status})`)
                return r.blob()
            })
            .then(heicParaJpeg)
            .then(jpeg => URL.createObjectURL(jpeg))
        pronto.catch(() => cacheConvertidas.delete(url))
        cacheConvertidas.set(url, pronto)
    }
    return pronto
}
