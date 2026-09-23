import { WalletCard } from "./components/wallet-card";
import { PerformanceCard } from "./components/performance-card";
import { TransactionHistory, PunishmentAlert } from "./components/transaction-history";
import { CriteriaCard } from "./components/criteria-card";
import { PipjForecastCard } from "./components/pipj-forecast-card";
import { PipjSolicitacoesCard } from "./components/pipj-solicitacoes-card";
import { FadeIn } from "./components/motion-wrapper";
import { CalendarClock } from "lucide-react";

export default function WalletPage() {
    return (
        <div className="space-y-6">
            <FadeIn direction="down" duration={0.6}>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">Carteira <span className="text-primary">PIPJ</span></h1>
                        <p className="text-slate-500 dark:text-slate-400">Gerencie seu saldo, benefícios e reembolsos.</p>
                    </div>
                </div>
            </FadeIn>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 flex flex-col gap-6">
                    <FadeIn delay={0.1} direction="up">
                        <WalletCard />
                    </FadeIn>
                    <FadeIn delay={0.15} direction="up">
                        <CriteriaCard />
                    </FadeIn>
                    <FadeIn delay={0.18} direction="up">
                        <div className="flex items-start gap-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4">
                            <CalendarClock className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                            <p className="text-sm text-blue-800 dark:text-blue-200">
                                <strong>Contagem de projetos por quinzena:</strong> um projeto que começa na segunda quinzena do mês (a partir do dia 16) só entra na sua contagem de PIPJ a partir do lançamento do mês seguinte. Por exemplo, um projeto iniciado em 20/08 conta a partir do PIPJ de setembro, não do de agosto.
                            </p>
                        </div>
                    </FadeIn>
                </div>
                <div className="lg:col-span-1 flex flex-col gap-6">
                    <FadeIn delay={0.1} direction="left">
                        <PerformanceCard />
                    </FadeIn>
                    <FadeIn delay={0.2} direction="left">
                        <PipjForecastCard />
                    </FadeIn>
                </div>
            </div>

            <FadeIn delay={0} direction="up">
                <TransactionHistory />
            </FadeIn>

            <FadeIn delay={0} direction="up">
                <PipjSolicitacoesCard />
            </FadeIn>

            <FadeIn delay={0} direction="up">
                <PunishmentAlert />
            </FadeIn>
        </div>
    )
}
