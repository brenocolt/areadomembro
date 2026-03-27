import { Button } from "@/components/ui/button"
import { Gift } from "lucide-react"

export function MilesHeader() {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">
                    Painel de <span className="text-cyan-500">Gestão de Milhas</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Gerencie catálogos, resgates e acompanhe o fluxo de troca de milhas.
                </p>
            </div>
            <Button className="bg-cyan-500 hover:bg-cyan-600 text-white shadow-lg shadow-cyan-500/25">
                <Gift className="mr-2 h-4 w-4" />
                Gerenciar Catálogo
            </Button>
        </div>
    )
}
