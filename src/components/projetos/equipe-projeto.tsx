import type { ProjetoComEquipe } from "@/lib/projetos-equipe"

// "Gerente: Ana · Consultores: Bia, Caio" — a equipe de um projeto em duas
// linhas curtas. Mesmo formato em todas as telas que citam projetos.
export function EquipeProjeto({ equipe, className = "" }: { equipe: Pick<ProjetoComEquipe, 'gerentes' | 'consultores'> | undefined, className?: string }) {
    if (!equipe) return null
    const gerentes = equipe.gerentes.map(m => m.nome).join(', ')
    const consultores = equipe.consultores.map(m => m.nome).join(', ')
    return (
        <span className={`block text-[11px] leading-snug text-slate-500 dark:text-slate-400 ${className}`}>
            <span><strong className="font-semibold text-slate-600 dark:text-slate-300">Gerente:</strong> {gerentes || 'não informado'}</span>
            <span className="mx-1.5 text-slate-300">·</span>
            <span><strong className="font-semibold text-slate-600 dark:text-slate-300">Consultores:</strong> {consultores || 'não informado'}</span>
        </span>
    )
}
