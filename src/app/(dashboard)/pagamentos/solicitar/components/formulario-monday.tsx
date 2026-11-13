import { Card } from "@/components/ui/card"

// Versão anterior (WorkForms do Monday por iframe), mantida para reversão até
// o formulário próprio ser validado. Para voltar a usá-la, defina
// NEXT_PUBLIC_PAGAMENTOS_FORMULARIO=monday no Coolify e publique de novo.
const MONDAY_FORM_URL = "https://forms.monday.com/forms/embed/462cabbf814a7fbaf9843c515585b281?r=use1"

export function FormularioMonday() {
    return (
        <>
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
        </>
    )
}
