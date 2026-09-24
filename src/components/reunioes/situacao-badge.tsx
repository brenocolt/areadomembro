import { Badge } from "@/components/ui/badge"

const ESTILOS: Record<string, { rotulo: string, classe: string }> = {
    presente: { rotulo: 'Presente', classe: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
    atrasado: { rotulo: 'Atrasado', classe: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
    falta: { rotulo: 'Falta', classe: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' },
    justificado: { rotulo: 'Ausência justificada', classe: 'bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400' },
    pendente: { rotulo: 'Aguardando', classe: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
}

export function SituacaoBadge({ situacao }: { situacao: string }) {
    const estilo = ESTILOS[situacao] || ESTILOS.pendente
    return (
        <Badge className={`${estilo.classe} font-bold text-[10px] uppercase tracking-wider border-none`}>{estilo.rotulo}</Badge>
    )
}

const FASES: Record<string, { rotulo: string, classe: string }> = {
    qr: { rotulo: 'QR code aberto', classe: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' },
    codigo: { rotulo: 'Só com código', classe: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' },
    encerrada: { rotulo: 'Encerrada', classe: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
    cancelada: { rotulo: 'Cancelada', classe: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400' },
}

export function FaseBadge({ fase }: { fase: string }) {
    const estilo = FASES[fase] || FASES.encerrada
    return (
        <Badge className={`${estilo.classe} font-bold text-[10px] uppercase tracking-wider border-none`}>{estilo.rotulo}</Badge>
    )
}

export function formatarHorario(iso: string): string {
    return new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

export function formatarData(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })
}
