"use client"
import { useState, useEffect } from "react"
import { normalizeUrl } from "@/lib/utils/normalize-url"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ArrowLeft, PlayCircle, BookOpen, CheckSquare, FileText, Link as LinkIcon, CheckCircle2, Clock } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { supabase } from "@/lib/supabase"
import { useColaborador } from "@/hooks/use-supabase"
import { Progress } from "@/components/ui/progress"
import confetti from "canvas-confetti"

export default function PdiDetailsPage() {
    const params = useParams()
    const router = useRouter()
    const { colaboradorId } = useColaborador()
    const [plan, setPlan] = useState<any>(null)
    const [tasks, setTasks] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        async function fetchData() {
            setLoading(true)
            const { data: planData } = await supabase
                .from('pdi_planos')
                .select('*')
                .eq('id', params.id)
                .single()

            const { data: tasksData } = await supabase
                .from('pdi_tarefas')
                .select('*')
                .eq('plano_id', params.id)
                .order('created_at', { ascending: true })

            setPlan(planData)
            if (tasksData) setTasks(tasksData)
            setLoading(false)
        }

        if (params.id) fetchData()

        const sub = supabase.channel('pdi_updates')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pdi_tarefas', filter: `plano_id=eq.${params.id}` }, fetchData)
            .on('postgres_changes', { event: '*', schema: 'public', table: 'pdi_planos', filter: `id=eq.${params.id}` }, fetchData)
            .subscribe()

        return () => {
            supabase.removeChannel(sub)
        }
    }, [params.id])

    const handleUpdateTaskStatus = async (taskId: string, newStatus: string) => {
        const updateData: any = { status: newStatus };
        if (newStatus === 'CONCLUIDO') {
            updateData.data_conclusao = new Date().toISOString();
        } else {
            updateData.data_conclusao = null;
        }

        // Optimistic update for tasks
        const updatedTasks = tasks.map(t => t.id === taskId ? { ...t, ...updateData } : t);
        setTasks(updatedTasks);

        // Optimistic update for plan progress
        const completedTasks = updatedTasks.filter(t => t.status === 'CONCLUIDO').length;
        const totalTasks = updatedTasks.length;
        const newProgress = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

        if (newProgress === 100 && plan.progresso < 100) {
            confetti({
                particleCount: 150,
                spread: 80,
                origin: { y: 0.6 },
                colors: ['#06b6d4', '#10b981', '#ffffff']
            });
        }

        setPlan((prev: any) => prev ? { ...prev, progresso: newProgress } : prev);

        await supabase.from('pdi_tarefas').update(updateData).eq('id', taskId);
    }

    if (loading) {
        return <div className="animate-pulse space-y-6 p-8"><div className="h-8 bg-slate-100 dark:bg-slate-800 rounded w-1/3" /><div className="h-32 bg-slate-100 dark:bg-slate-800 rounded-3xl" /></div>
    }

    if (!plan) {
        return <div className="p-8 text-center text-slate-500">PDI não encontrado.</div>
    }

    const progresso = Math.round(plan.progresso || 0);

    return (
        <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-12">
            <div className="flex flex-col gap-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <button onClick={() => router.back()} className="hover:text-slate-900 dark:hover:text-white flex items-center transition-colors">
                            <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
                        </button>
                        <span>›</span>
                        <span className="font-bold text-slate-900 dark:text-white capitalize-first">{plan.titulo.toLowerCase()}</span>
                    </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white mb-3 uppercase tracking-tight">{plan.titulo}</h1>
                        <p className="text-base text-slate-500 dark:text-slate-400 leading-relaxed max-w-2xl">
                            {plan.descricao}
                        </p>
                    </div>
                </div>
            </div>

            {/* Highlighted Progress Card */}
            <div className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 md:p-8 shadow-sm">
                <div className="flex justify-between items-end mb-4">
                    <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-600 dark:text-cyan-400 block mb-1">Progresso do Módulo</span>
                        <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                            {progresso === 100 ? 'Concluído' : 'Em Andamento'}
                        </h2>
                    </div>
                    <span className="text-4xl font-extrabold text-cyan-600 dark:text-cyan-400">{progresso}%</span>
                </div>
                <Progress value={progresso} className="h-4 bg-slate-100 dark:bg-slate-800 mb-4" indicatorClassName="bg-cyan-500 transition-all duration-1000 ease-out" />

                {progresso === 100 ? (
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-4 h-4" />
                        Parabéns! Você completou todas as etapas deste módulo.
                    </div>
                ) : (
                    <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
                        Continue assim! Você está indo muito bem.
                    </div>
                )}
            </div>

            {/* Task List */}
            <div className="space-y-4">
                {tasks.map((task) => {
                    const isCompleted = task.status === 'CONCLUIDO';
                    let Icon = FileText;
                    if (task.tipo === 'video') Icon = PlayCircle;
                    if (task.tipo === 'leitura') Icon = BookOpen;
                    if (task.tipo === 'atividade') Icon = CheckSquare;

                    return (
                        <div key={task.id} className="bg-white dark:bg-[#0F172A] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 flex flex-col md:flex-row gap-6 items-start md:items-center shadow-sm">
                            <div className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl shrink-0 border border-slate-100 dark:border-white/10">
                                <Icon className="w-8 h-8 text-slate-700 dark:text-white" />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-2 mb-2">
                                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                                        {task.titulo}
                                    </h3>

                                    <Select
                                        value={task.status === 'PENDENTE' ? 'Não Iniciada' : task.status}
                                        onValueChange={(val) => handleUpdateTaskStatus(task.id, val)}
                                    >
                                        <SelectTrigger className="w-[160px] bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-slate-800 rounded-xl h-9 text-xs font-bold focus:ring-0">
                                            <SelectValue placeholder="Status" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-white dark:bg-[#0F172A] border-slate-200 dark:border-slate-800 rounded-xl">
                                            <SelectItem value="Não Iniciada" className="text-xs font-medium cursor-pointer">Não Iniciada</SelectItem>
                                            <SelectItem value="Em Progresso" className="text-xs font-medium cursor-pointer text-blue-600 dark:text-blue-400">Em Progresso</SelectItem>
                                            <SelectItem value="Parada" className="text-xs font-medium cursor-pointer text-amber-600 dark:text-amber-400">Parada</SelectItem>
                                            <SelectItem value="CONCLUIDO" className="text-xs font-medium cursor-pointer text-emerald-600 dark:text-emerald-400">Concluída</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                {task.data_conclusao && isCompleted ? (
                                    <p className="text-xs text-slate-500 font-medium mb-4 flex items-center gap-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        Concluído em {new Date(task.data_conclusao).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-500 font-medium mb-4">{task.descricao}</p>
                                )}

                                <div className="flex flex-wrap gap-3">
                                    {(task.anexos || []).map((anexo: any, idx: number) => (
                                        <a key={idx} href={normalizeUrl(anexo.url)} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-xs font-bold text-cyan-600 dark:text-cyan-400 bg-cyan-50 dark:bg-cyan-500/10 px-3 py-2 rounded-xl hover:bg-cyan-100 dark:hover:bg-cyan-500/20 transition-colors">
                                            {anexo.tipo === 'link' || anexo.tipo === 'video' ? <LinkIcon className="w-3.5 h-3.5" /> : <FileText className="w-3.5 h-3.5" />}
                                            {anexo.nome}
                                        </a>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )
                })}
            </div>
        </div>
    )
}
