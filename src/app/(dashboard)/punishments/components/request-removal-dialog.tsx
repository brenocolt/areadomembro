"use client"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { ShieldCheck, Upload, Loader2, Star, Users, Handshake, Flame, Building2, Briefcase, ThumbsUp, HeartHandshake, FileText, CalendarCheck, HandshakeIcon, PenTool, LineChart, Award } from "lucide-react"
import { supabase } from "@/lib/supabase"
import { useColaborador } from "@/hooks/use-supabase"

const ACTIVITY_GROUPS = [
    {
        label: "DESENVOLVIMENTO - RETIRADA DE 1 PONTO",
        points: 1,
        items: [
            { id: "curso_certificado", title: "Curso com certificado", dbValue: "Fazer um curso que agregue a sua formação e a Produtiva, com certificado", icon: Star },
            { id: "treinamento_interno", title: "Treinamento interno", dbValue: "Dar treinamento interno para Produtiva (Turbinar, Calcificar, PTPJ, Take Off, entre outros)", icon: Users },
            { id: "participar_bench", title: "Participar de um bench", dbValue: "Participar de um bench", icon: Handshake },
            { id: "indicar_lead_quente", title: "Indicar lead quente", dbValue: "Indicar um lead quente que seja convertido em reunião de proposta", icon: Flame },
            { id: "participacao_gt", title: "Participação de GT", dbValue: "Participação de GT (Grupo de Trabalho)", icon: Users }
        ]
    },
    {
        label: "CRESCIMENTO - RETIRADA DE 2 PONTOS",
        points: 2,
        items: [
            { id: "treinamento_outra_ej", title: "Treinamento outra EJ", dbValue: "Dar treinamento para outra EJ", icon: Building2 },
            { id: "consultoria_externa", title: "Consultoria externa", dbValue: "Dar treinamento em consultoria/assessoria desde que esse não esteja previsto em cronograma", icon: Briefcase },
            { id: "csat_ou_nps", title: "CSAT 5 ou NPS 10", dbValue: "Obter CSAT 5 ou NPS 10 em uma consultoria/assessoria", icon: ThumbsUp },
            { id: "fidelizar_projeto", title: "Fidelizar projeto", dbValue: "Fidelizar projeto que o membro faça parte da equipe de consultoria", icon: HeartHandshake },
            { id: "finalizar_edital", title: "Finalizar edital", dbValue: "Finalizar a participação em edital (PSC, PSGP, Edital de Coordenadorias do PTPJ Edital de Diretoria)", icon: FileText },
            { id: "finalizar_pdi", title: "Finalizar PDI no prazo", dbValue: "Finalizar um PDI no prazo", icon: CalendarCheck },
            { id: "concretizacao_parcerias", title: "Concretização parcerias", dbValue: "Auxiliar na concretização de parcerias em conjunto com o núcleo da presidência", icon: HandshakeIcon }
        ]
    },
    {
        label: "FORTALECIMENTO - RETIRADA DE 3 PONTOS",
        points: 3,
        items: [
            { id: "escrever_case", title: "Escrever um case", dbValue: "Escrever um case (mesmo que não tenha sido montado um edital, para ficar no banco de dados)", icon: PenTool },
            { id: "projeto_melhoria", title: "Projeto de melhoria", dbValue: "Desenvolver e finalizar um projeto de melhoria/iniciativa interna juntamente a algum dos núcleos", icon: LineChart }
        ]
    }
];

export function RequestRemovalDialog() {
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
        if (!selectedActivity || !descricao || !file || !colaboradorId) return;

        setLoading(true)

        try {
            let comprovante_url = null;

            // Upload the file to Supabase storage
            const fileExt = file.name.split('.').pop()
            const fileName = `remocao-${colaboradorId}-${Date.now()}.${fileExt}`
            const { data: uploadData, error: uploadError } = await supabase.storage
                .from('comprovantes')
                .upload(fileName, file)

            if (uploadError) throw uploadError;

            if (uploadData) {
                const { data } = supabase.storage.from('comprovantes').getPublicUrl(uploadData.path)
                comprovante_url = data.publicUrl
            }

            // Insert request
            const { error: insertError } = await supabase
                .from('solicitacoes_remocao')
                .insert({
                    colaborador_id: colaboradorId,
                    motivo: `${selectedActivity} - ${descricao}`,
                    pontos_solicitados: selectedPoints,
                    comprovante_url: comprovante_url,
                    status: 'PENDENTE'
                })

            if (insertError) throw insertError;

            // Success
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
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Solicitar Remoção de Pontos
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[750px] bg-white dark:bg-[#0f172a] border-slate-200 dark:border-white/10 rounded-2xl p-0 overflow-hidden shadow-2xl">
                <DialogHeader className="p-6 border-b border-slate-100 dark:border-white/5 pb-4">
                    <DialogTitle className="text-xl font-display font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <div className="bg-sky-100 dark:bg-sky-900/30 p-1.5 rounded-full text-sky-500">
                            <Award className="h-5 w-5" />
                        </div>
                        Retirada de Pontos
                    </DialogTitle>
                </DialogHeader>

                <div className="p-6 max-h-[65vh] overflow-y-auto space-y-8 bg-slate-50/50 dark:bg-transparent">
                    {ACTIVITY_GROUPS.map((group) => (
                        <div key={group.label} className="space-y-4">
                            <h4 className="text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">{group.label}</h4>
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                                {group.items.map((item) => {
                                    const isSelected = selectedActivity === item.dbValue;
                                    return (
                                        <button
                                            key={item.id}
                                            type="button"
                                            onClick={() => setSelectedActivity(item.dbValue)}
                                            className={`flex flex-col items-center justify-center p-3 sm:p-4 rounded-xl border transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900 ${isSelected
                                                    ? 'border-sky-500 bg-sky-50 dark:bg-sky-500/10 shadow-sm shadow-sky-500/10 scale-[0.98]'
                                                    : 'border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900/50 hover:border-sky-300 dark:hover:border-sky-500/50 hover:bg-slate-50 dark:hover:bg-white/5 hover:scale-[1.02]'
                                                }`}
                                        >
                                            <item.icon className={`w-8 h-8 mb-3 transition-colors duration-200 ${isSelected
                                                    ? 'text-sky-500'
                                                    : 'text-slate-400 dark:text-slate-500'
                                                }`} strokeWidth={2} />

                                            <span className={`text-xs text-center leading-tight ${isSelected
                                                    ? 'text-sky-700 dark:text-sky-300 font-bold'
                                                    : 'text-slate-600 dark:text-slate-400 font-medium'
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
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Descrição Detalhada</label>
                            <Textarea
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                                placeholder="Descreva brevemente os detalhes..."
                                className="bg-white dark:bg-[#0f172a] border-slate-200 dark:border-white/10 rounded-xl resize-none min-h-[100px]"
                            />
                        </div>

                        <div className="flex flex-col gap-2 pb-2">
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300">Comprovante</label>
                            <div className="flex items-center justify-center w-full">
                                <label htmlFor="dropzone-file-punishments" className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 dark:border-slate-700 border-dashed rounded-xl cursor-pointer bg-white dark:bg-[#0f172a] hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <Upload className="w-8 h-8 mb-3 text-slate-400" />
                                        <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                                            <span className="font-bold text-sky-500">Clique para enviar</span> ou arraste o arquivo
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">PNG, JPG ou PDF (Máx. 5MB)</p>
                                    </div>
                                    <input id="dropzone-file-punishments" type="file" className="hidden" accept="image/png, image/jpeg, application/pdf" onChange={handleFileChange} />
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
                    <div className="flex items-center gap-3 w-full sm:w-auto">
                        <span className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Saldo a retirar:</span>
                        <div className="bg-sky-100 dark:bg-sky-900/30 text-sky-600 dark:text-sky-400 px-3 py-1 rounded-full text-sm font-bold">
                            {selectedPoints} {selectedPoints === 1 ? 'ponto' : 'pontos'}
                        </div>
                    </div>

                    <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
                        <Button variant="ghost" type="button" onClick={() => setOpen(false)} className="text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 font-medium">
                            Cancelar
                        </Button>
                        <Button
                            disabled={loading || !selectedActivity || !descricao || !file}
                            onClick={handleSubmit}
                            className="bg-[#00b4d8] hover:bg-[#0096c7] disabled:opacity-50 text-white font-bold rounded-lg px-6 w-full sm:w-auto shadow-md"
                        >
                            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Confirmar Retirada
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
