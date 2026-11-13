import { ReceiptText } from "lucide-react"
import { Card } from "@/components/ui/card"
import { VoltarPagamentos } from "../components/voltar-pagamentos"

// Formulário oficial do Monday WorkForms, incorporado sem alterações: as
// perguntas, o envio e a integração com o quadro do Monday continuam sendo
// feitos pelo próprio WorkForms (o portal não grava nada, então não há
// risco de registro duplicado).
const MONDAY_FORM_URL = "https://forms.monday.com/forms/embed/462cabbf814a7fbaf9843c515585b281?r=use1"

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

            <Card className="border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl p-2 sm:p-4 overflow-hidden">
                <iframe
                    src={MONDAY_FORM_URL}
                    width="100%"
                    height={900}
                    title="Solicitação de Pagamentos e Reembolsos"
                    loading="lazy"
                    className="block w-full border-0 rounded-xl bg-white h-[1100px] sm:h-[900px]"
                />
            </Card>

            <p className="text-xs text-slate-400 dark:text-slate-500">
                Se o formulário não carregar,{" "}
                <a
                    href={MONDAY_FORM_URL.replace("/forms/embed/", "/forms/")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-amber-600"
                >
                    abra-o em uma nova aba
                </a>
                .
            </p>
        </div>
    )
}
