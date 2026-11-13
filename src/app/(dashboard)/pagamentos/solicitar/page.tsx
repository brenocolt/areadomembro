import { ReceiptText } from "lucide-react"
import { VoltarPagamentos } from "../components/voltar-pagamentos"
import { FormularioMonday } from "./components/formulario-monday"
import { FormularioSolicitacao } from "./components/formulario-solicitacao"

// Formulário próprio do portal (respostas e comprovantes ficam no banco do
// portal, não no Monday). Continua exibindo o WorkForms do Monday enquanto:
//   - o servidor não tiver SUPABASE_SERVICE_ROLE_KEY (sem ela o envio próprio
//     não funciona — os membros não podem ficar sem formulário); ou
//   - NEXT_PUBLIC_PAGAMENTOS_FORMULARIO=monday (reversão manual).
// Lido a cada acesso, então basta configurar a variável no Coolify.
export const dynamic = "force-dynamic"

function usarMonday(): boolean {
    return process.env.NEXT_PUBLIC_PAGAMENTOS_FORMULARIO === "monday" || !process.env.SUPABASE_SERVICE_ROLE_KEY
}

export default function SolicitarPagamentoPage() {
    const USAR_MONDAY = usarMonday()
    return (
        <div className="space-y-6">
            <VoltarPagamentos />

            <div>
                <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <ReceiptText className="h-7 w-7 shrink-0 text-amber-500" />
                    <span>Solicitar Pagamento ou <span className="text-amber-500">Reembolso</span></span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Preencha o formulário abaixo para registrar sua solicitação.
                </p>
            </div>

            {USAR_MONDAY ? <FormularioMonday /> : <FormularioSolicitacao />}
        </div>
    )
}
