import Link from "next/link"
import { ArrowLeft } from "lucide-react"

// Botão discreto usado nas duas páginas internas (formulário do Monday e
// módulo de gasolina). É um Link do Next: troca de página sem recarregar e
// entra no histórico normal do navegador.
export function VoltarPagamentos() {
    return (
        <Link
            href="/pagamentos"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400 transition-colors"
        >
            <ArrowLeft className="h-4 w-4" />
            Voltar para Pagamentos e Reembolsos
        </Link>
    )
}
