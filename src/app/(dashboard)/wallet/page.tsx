import { WalletCard } from "./components/wallet-card";
import { PerformanceCard } from "./components/performance-card";
import { TransactionHistory, PunishmentAlert } from "./components/transaction-history";
import { CriteriaCard } from "./components/criteria-card";
import { PipjForecastCard } from "./components/pipj-forecast-card";
import { FadeIn } from "./components/motion-wrapper";

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
                <PunishmentAlert />
            </FadeIn>
        </div>
    )
}
