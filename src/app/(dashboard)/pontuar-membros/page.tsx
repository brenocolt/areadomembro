import { AddPointsDialog } from "../points-management/components/add-points-dialog"
import { AlertTriangle, ShieldAlert } from "lucide-react"

export default function PontuarMembrosPage() {
    return (
        <div className="space-y-6 max-w-2xl mx-auto w-full">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">
                    Pontuar <span className="text-primary">Membros</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Lance ocorrências e pontos negativos para um colaborador.
                </p>
            </div>

            {/* Card central com a ação */}
            <div className="bg-white dark:bg-[#0F172A] rounded-3xl p-8 shadow-sm border border-slate-100 dark:border-slate-800/50 flex flex-col items-center text-center gap-5">
                <div className="h-16 w-16 rounded-2xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center">
                    <ShieldAlert className="h-8 w-8 text-amber-500" />
                </div>
                <div className="space-y-1.5 max-w-md">
                    <h2 className="text-xl font-display font-bold text-slate-900 dark:text-white">
                        Registrar pontuação de punição
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                        Selecione o núcleo, o colaborador e o motivo da ocorrência. A pontuação é
                        somada automaticamente ao saldo de pontos negativos do membro.
                    </p>
                </div>

                <AddPointsDialog />

                <div className="grid sm:grid-cols-3 gap-3 w-full pt-4 mt-2 border-t border-slate-100 dark:border-slate-800/50">
                    <div className="flex flex-col items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold">1</span>
                        Núcleo
                    </div>
                    <div className="flex flex-col items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold">2</span>
                        Colaborador
                    </div>
                    <div className="flex flex-col items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="h-8 w-8 rounded-lg bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold">3</span>
                        Motivo
                    </div>
                </div>
            </div>

            {/* Aviso */}
            <div className="flex items-start gap-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800/50 p-4">
                <AlertTriangle className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                <p className="text-xs text-slate-500 dark:text-slate-400">
                    A pontuação fica registrada no histórico do colaborador e é visível para ele.
                    Use a descrição para explicar o motivo de forma clara.
                </p>
            </div>
        </div>
    )
}
