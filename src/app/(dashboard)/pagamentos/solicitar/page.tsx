import { ReceiptText } from "lucide-react"
import { VoltarPagamentos } from "../components/voltar-pagamentos"
import { FormularioMonday } from "./components/formulario-monday"
import { FormularioSolicitacao } from "./components/formulario-solicitacao"
import { formularioDaPagina } from "@/lib/pagamentos-server"

// Formulário próprio do portal (respostas e comprovantes ficam no banco do
// portal, não no Monday). Quem vê qual formulário (formularioDaPagina):
//   - servidor sem SUPABASE_SERVICE_ROLE_KEY ou
//     NEXT_PUBLIC_PAGAMENTOS_FORMULARIO=monday -> todos veem o Monday;
//   - fase de testes -> só Vice Presidência e administradores veem o próprio;
//   - PAGAMENTOS_FORMULARIO_LIBERADO=todos -> todos veem o próprio.
// Lido a cada acesso: basta mudar a variável no Coolify e publicar de novo.
export const dynamic = "force-dynamic"

export default async function SolicitarPagamentoPage() {
    const formulario = await formularioDaPagina()
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

            {formulario.emTeste && (
                <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                    <span className="font-semibold">Versão em teste.</span> Só a Vice Presidência e administradores veem este formulário;
                    os demais membros continuam usando o do Monday.
                </p>
            )}

            {formulario.tipo === "monday" ? <FormularioMonday /> : <FormularioSolicitacao />}
        </div>
    )
}
