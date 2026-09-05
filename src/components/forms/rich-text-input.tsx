"use client"
import { useEffect, useRef } from "react"

interface RichTextInputProps {
    id?: string
    value: string
    onChange: (html: string) => void
    placeholder?: string
    className?: string
    multiline?: boolean
}

// Campo de texto com negrito/itálico exibidos DE VERDADE enquanto se edita
// (não a tag <b>/<i> literal) — troca o <Input>/<Textarea> comum por um
// contentEditable estilizado do mesmo jeito. O valor gravado continua sendo
// HTML simples (<b>, <i>), o mesmo formato já usado em todo o resto do
// sistema (dangerouslySetInnerHTML na tela de resposta, no dashboard etc.),
// então nada mais precisa mudar para ler esse campo.
//
// Negrito/Itálico são aplicados com document.execCommand a partir de um
// botão externo (ver `aplicarFormatoRichText` abaixo) — o próprio browser já
// resolve seleção parcial, desfazer/refazer e teclas de atalho (Ctrl+B/I).
export function RichTextInput({ id, value, onChange, placeholder, className, multiline }: RichTextInputProps) {
    const ref = useRef<HTMLDivElement>(null)

    // Sincroniza o valor vindo de fora (troca de formulário, desfazer externo
    // etc.) para o DOM — mas só quando é DIFERENTE do que já está lá. Sem essa
    // checagem, todo re-render (inclusive o causado pelo próprio onInput)
    // reescreveria o innerHTML e jogaria o cursor para o início do campo.
    useEffect(() => {
        const el = ref.current
        if (el && el.innerHTML !== (value || '')) {
            el.innerHTML = value || ''
        }
    }, [value])

    return (
        <div
            id={id}
            ref={ref}
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => onChange((e.target as HTMLDivElement).innerHTML)}
            onPaste={(e) => {
                // Cola sempre como texto puro — colar HTML de fora (Word, um
                // site etc.) poderia trazer estilos/tags que a tela de
                // resposta não espera e não sabe renderizar direito.
                e.preventDefault()
                const texto = e.clipboardData.getData('text/plain')
                document.execCommand('insertText', false, texto)
            }}
            data-placeholder={placeholder}
            className={`rich-text-input outline-none ${multiline ? 'whitespace-pre-wrap' : 'whitespace-nowrap overflow-hidden'} ${className || ''}`}
        />
    )
}

// Aplica negrito/itálico ao texto selecionado dentro do campo `id` (chamado
// pelos botões B/I da barra de formatação). Precisa focar o campo antes:
// execCommand atua sobre a seleção ativa do documento, e o clique no botão
// (fora do contentEditable) já teria limpado essa seleção.
export function aplicarFormatoRichText(id: string, formato: 'bold' | 'italic') {
    const el = document.getElementById(id)
    if (!el) return
    el.focus()
    document.execCommand(formato === 'bold' ? 'bold' : 'italic')
}
