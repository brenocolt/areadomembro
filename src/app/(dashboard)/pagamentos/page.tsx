import Link from "next/link"
import { ArrowRight, Fuel, HandCoins, ReceiptText, type LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"

const OPCOES: { titulo: string; descricao: string; href: string; icon: LucideIcon }[] = [
    {
        titulo: "Solicitar Pagamento ou Reembolso",
        descricao: "Preencha o formulário para solicitar pagamentos, reembolsos e outras despesas relacionadas às atividades da Produtiva Júnior.",
        href: "/pagamentos/solicitar",
        icon: ReceiptText,
    },
    {
        titulo: "Reembolso de Gasolina",
        descricao: "Cadastre seus veículos, registre viagens e acompanhe seus reembolsos de combustível.",
        // Módulo de gasolina continua no mesmo endereço de antes.
        href: "/gasolina",
        icon: Fuel,
    },
]

export default function PagamentosPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <HandCoins className="h-7 w-7 shrink-0 text-amber-500" />
                    <span>Pagamentos e <span className="text-amber-500">Reembolsos</span></span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Gerencie suas solicitações de pagamentos e reembolsos em um só lugar.
                </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {OPCOES.map(({ titulo, descricao, href, icon: Icon }) => (
                    <Link
                        key={href}
                        href={href}
                        className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2"
                    >
                        <Card className="h-full border-none shadow-sm bg-white dark:bg-[#0F172A] rounded-2xl p-6 gap-4 transition-all group-hover:shadow-md group-hover:-translate-y-0.5">
                            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-500/10">
                                <Icon className="h-6 w-6 text-amber-500" />
                            </div>
                            <div className="space-y-1.5 flex-1">
                                <h2 className="text-lg font-display font-bold text-slate-900 dark:text-white">{titulo}</h2>
                                <p className="text-sm text-slate-500 dark:text-slate-400">{descricao}</p>
                            </div>
                            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-amber-600 dark:text-amber-400">
                                Acessar
                                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                            </span>
                        </Card>
                    </Link>
                ))}
            </div>
        </div>
    )
}
