"use client"

import { Wallet, Zap } from "lucide-react"
import { PipjLaunchDialog } from "./pipj-launch-dialog"

export function PipjHeader() {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">
                    Painel de <span className="text-emerald-500">Gestão de PIPJ</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Gerencie lançamentos, retiradas e acompanhe o saldo PIPJ dos colaboradores.
                </p>
            </div>
            <PipjLaunchDialog />
        </div>
    )
}
