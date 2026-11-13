import { ReceiptText } from "lucide-react"
import { VoltarPagamentos } from "../components/voltar-pagamentos"
import { FormularioMonday } from "./components/formulario-monday"
import { FormularioSolicitacao } from "./components/formulario-solicitacao"

// Formulário próprio do portal (respostas e comprovantes ficam no banco do
// portal, não no Monday). Reversão: NEXT_PUBLIC_PAGAMENTOS_FORMULARIO=monday
// volta a exibir o WorkForms do Monday no mesmo lugar.
const USAR_MONDAY = process.env.NEXT_PUBLIC_PAGAMENTOS_FORMULARIO === "monday"

export default function SolicitarPagamentoPage() {
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
