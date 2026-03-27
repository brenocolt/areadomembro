import { ImportNPSDialog } from "./import-nps-dialog"

export function UsersHeader() {
    return (
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
                <h1 className="text-3xl font-display font-bold text-slate-900 dark:text-white">
                    Gestão de <span className="text-primary">Usuários</span>
                </h1>
                <p className="text-slate-500 dark:text-slate-400 mt-1">
                    Crie, edite e aprove o acesso de membros na plataforma.
                </p>
            </div>
            
            <div className="flex items-center gap-2">
                <ImportNPSDialog />
            </div>
        </div>
    )
}
