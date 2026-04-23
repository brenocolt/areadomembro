import { Button } from "@/components/ui/button"
import { AddPointsDialog } from "./add-points-dialog"
import { AddFlagDialog } from "./add-flag-dialog"

export function PointsHeader() {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">
                    Painel de <span className="text-primary">Gestão de Pontos</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Gerencie punições, recursos e analytics comportamental da equipe.
                </p>
            </div>
            <div className="flex items-center gap-3">
                <AddFlagDialog />
                <AddPointsDialog />
            </div>
        </div>
    )
}
