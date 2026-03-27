"use client"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Plane, Star, Users, Megaphone, Rocket, Share2, Medal, FileText, UserPlus, TrendingUp, CheckCircle2, ThumbsUp, Award, Loader2, PlusCircle, Upload } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useColaborador } from "@/hooks/use-supabase"

const ACTIVITY_GROUPS = [
    {
        label: "GANHE 6 MILHAS",
        points: 6,
        items: [
            { id: "lider_de_voo", title: "Líder de Voo", dbValue: "Conquistar o reconhecimento formal de Líder de Voo", icon: Plane },
            { id: "piloto_de_elite", title: "Piloto de Elite", dbValue: "Conquistar o reconhecimento formal de Piloto de Elite", icon: Star },
            { id: "grupos_trabalho", title: "Grupos de Trabalho", dbValue: "Participar de GT’s (Grupos de Trabalho)", icon: Users },
            { id: "endomarketing", title: "Endomarketing", dbValue: "Participar em Ações de Endomarketing", icon: Megaphone }
        ]
    },
    {
        label: "GANHE 8 MILHAS",
        points: 8,
        items: [
            { id: "consultor_mes", title: "Consultor do Mês", dbValue: "Conquistar o reconhecimento formal de Consultor do Mês", initials: "C.M." },
            { id: "gerente_mes", title: "Gerente do Mês", dbValue: "Conquistar o reconhecimento formal de Gerente do Mês", initials: "G.M." },
            { id: "sdr_mes", title: "SDR do Mês", dbValue: "Conquistar o reconhecimento formal de SDR do Mês", initials: "S.M." },
            { id: "projeto_impacto", title: "Projeto Impacto", dbValue: "Conquistar o reconhecimento formal de Projeto de Impacto", icon: Rocket },
            { id: "nucleo_impacto", title: "Núcleo Impacto", dbValue: "Conquistar o reconhecimento formal de Núcleo de Impacto", icon: Share2 },
            { id: "patente_alta", title: "Patente Alta", dbValue: "Conquistar o reconhecimento formal de Trainee Patente Alta", icon: Medal },
            { id: "editais", title: "Editais", dbValue: "Participação em editais", icon: FileText },
            { id: "indicar_leads", title: "Indicar 15+ Leads", dbValue: "Indicar 15 ou mais leads", icon: UserPlus }
        ]
    },
    {
        label: "GANHE 10 MILHAS",
        points: 10,
        items: [
            { id: "cem_desempenho", title: "100% Desempenho", dbValue: "Alcançar o desempenho interno de 100% no mês", icon: TrendingUp },
            { id: "entregas_prazo", title: "Entregas no Prazo", dbValue: "Ter 100% das entregas concluidas sem atraso, sendo estas definidas para um período delimitado", icon: CheckCircle2 },
            { id: "nota_maxima", title: "Nota Máxima CSAT", dbValue: "Alcançar a nota máxima em CSAT ou NPS", icon: ThumbsUp }
        ]
    }
];

export function RequestMilesDialog() {
    const { colaboradorId } = useColaborador()
    const [open, setOpen] = useState(false)
    const [loading, setLoading] = useState(false)
    const [selectedActivity, setSelectedActivity] = useState<string | null>(null)
    const [descricao, setDescricao] = useState("")
    const [file, setFile] = useState<File | null>(null)

    const selectedPoints = ACTIVITY_GROUPS.find(g => g.items.some(i => i.dbValue === selectedActivity))?.points || 0;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0])
        }
    }

    const handleSubmit = async () => {
        if (!selectedActivity || !colaboradorId || !file) return;

        setLoading(true)

        try {
            let comprovante_url = null;

            // Upload the file to Supabase storage
            const fileExt = file.name.split('.').pop()
            const fileName = `${colaboradorId}-${Date.now()}.${fileExt}`
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('comprovantes')
                .upload(fileName, file)

            if (uploadError) throw uploadError;

            if (uploadData) {
                const { data } = supabase.storage.from('comprovantes').getPublicUrl(uploadData.path)
                comprovante_url = data.publicUrl
            }

            const { error: insertError } = await supabase
                .from('solicitacoes_saque')
                .insert({
                    colaborador_id: colaboradorId,
                    quantidade: selectedPoints,
                    atividade: selectedActivity,
                    descricao: descricao,
                    comprovante_url: comprovante_url,
                    status: 'PENDENTE',
                    tipo: 'adicao_milhas'
                })

            if (insertError) throw insertError;

            setOpen(false)
            setSelectedActivity(null)
            setDescricao("")
            setFile(null)

            window.location.reload();

        } catch (error) {
            console.error("Error submitting request:", error)
            alert("Erro ao enviar solicitação.")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-sky-500 hover:bg-sky-600 text-white font-bold shadow-lg shadow-sky-500/20">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Solicitar Adição de Milhas
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[750px] bg-white dark:bg-[#0f172a] border-slate-200 dark:border-white/10 rounded-2xl p-0 overflow-hidden shadow-2xl">
                <DialogHeader className="p-6 border-b border-slate-100 dark:border-white/5 pb-4">
                    <DialogTitle className="text-xl font-display font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <Award className="h-6 w-6 text-sky-500" />
                        Solicitar Milhas Adicionais
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 max-h-[60vh] overflow-y-auto space-y-8 bg-slate-50/50 dark:bg-transparent">
                    {ACTIVITY_GROUPS.map((group) => (
                        <div key={group.label} className="space-y-4">
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                                <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{group.label}</h4>
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {group.items.map((item) => {
                                    const isSelected = selectedActivity === item.dbValue;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setSelectedActivity(item.dbValue)}
                                            className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${isSelected
                                                ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/10 shadow-sm shadow-sky-500/10 scale-[0.98]'
                                                : 'border-slate-100 dark:border-white/10 bg-white dark:bg-slate-900/50 hover:border-sky-300 dark:hover:border-sky-500/50 hover:bg-slate-50 dark:hover:bg-white/5 hover:scale-[1.02]'
                                                }`}
                                        >
                                            <div className={`flex items-center justify-center w-10 h-10 rounded-full mb-3 ${isSelected
                                                ? 'bg-sky-500 text-white shadow-inner shadow-black/10'
                                                : 'bg-sky-50 dark:bg-sky-500/20 text-sky-500 dark:text-sky-400'
                                                } transition-colors duration-200`}>
                                                {item.icon ? <item.icon className="w-5 h-5" strokeWidth={2.5} /> : <span className="font-black text-sm">{item.initials}</span>}
                                            </div>
                                            <span className={`text-xs font-medium text-center leading-tight ${isSelected
                                                ? 'text-sky-700 dark:text-sky-300 font-bold'
                                                : 'text-slate-600 dark:text-slate-300'
                                                }`}>
                                                {item.title}
                                            </span>
                                        </button>
                                    )
                                })}
                            </div>
                        </div>
                    ))}

                    <div className="pt-4 border-t border-slate-100 dark:border-white/5 space-y-6">
                        <div className="flex flex-col gap-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Descrição (Opcional/Contexto)</label>
                            <Textarea
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                                placeholder="Descreva brevemente os detalhes..."
                                className="bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-xl resize-none min-h-[100px]"
                            />
                        </div>

                        <div className="flex flex-col gap-2 pb-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Comprovante</label>
                            <div className="flex items-center justify-center w-full">
                                <label htmlFor="dropzone-file-milhas" className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 dark:border-slate-700 border-dashed rounded-xl cursor-pointer bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 transition-colors">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Upload className="w-8 h-8 mb-3 text-sky-400" />
                                        <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                                            <span className="font-bold">Clique para enviar</span> ou arraste o arquivo
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">PNG, JPG ou PDF (Máx. 5MB)</p>
                                    </div>
                                    <input id="dropzone-file-milhas" type="file" className="hidden" accept="image/png, image/jpeg, application/pdf" onChange={handleFileChange} />
                                </label>
                            </div>
                            {file && (
                                <p className="text-xs text-emerald-600 font-bold mt-1 text-center">Arquivo selecionado: {file.name}</p>
                            )}
                            {!file && (
                                <p className="text-xs text-rose-500 font-bold mt-1 text-center">O envio do comprovante é obrigatório.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="p-4 px-6 bg-slate-50 dark:bg-[#0f172a] border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex flex-col items-start w-full sm:w-auto">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">Saldo a resgatar</span>
                        <div className="flex items-baseline gap-1.5">
                            <span className="text-2xl font-black text-sky-500">{selectedPoints}</span>
                            <span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase">Milhas</span>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <Button variant="ghost" type="button" onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
                            Cancelar
                        </Button>
                        <Button
                            disabled={loading || !selectedActivity || !file}
                            onClick={handleSubmit}
                            className="bg-sky-500 hover:bg-sky-600 disabled:opacity-50 disabled:bg-sky-500 text-white font-bold rounded-lg px-6 w-full sm:w-auto shadow-md shadow-sky-500/20"
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirmar Solicitação
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
