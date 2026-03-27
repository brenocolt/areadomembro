import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"
import { MilhasHero } from "./components/milhas-hero"
import { ExchangeHistory } from "./components/exchange-history"
import { RequestMilesDialog } from "./components/request-miles-dialog"

export default function MilhasPage() {
    return (
        <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>Dashboard</span>
                    <span>/</span>
                    <span className="font-bold text-foreground">Gestão e Resgate de Milhas</span>
                </div>
                <RequestMilesDialog />
            </div>

            <MilhasHero />

            <div className="h-full">
                <ExchangeHistory />
            </div>
        </div>
    )
}
