"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Upload, Loader2, FileSpreadsheet } from "lucide-react"
import { supabase } from "@/lib/supabase"
import Papa from 'papaparse'
import { toast } from "sonner"

export function ImportNpsDialog() {
    const [open, setOpen] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [preview, setPreview] = useState<any>(null)
    const [fileOptions, setFileOptions] = useState<any>(null)

    const parseNumber = (str: string) => {
        if (!str) return null;
        const s = String(str).replace(',', '.').trim();
        const n = parseFloat(s);
        return isNaN(n) ? null : n;
    }

    const monthMap: Record<string, number> = {
        'janeiro': 1, 'fevereiro': 2, 'março': 3, 'marco': 3, 'abril': 4,
        'maio': 5, 'junho': 6, 'julho': 7, 'agosto': 8,
        'setembro': 9, 'outubro': 10, 'novembro': 11, 'dezembro': 12
    }

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        Papa.parse(file, {
            complete: async (results) => {
                const rows = results.data as string[][]
                
                let foundYear = new Date().getFullYear()
                let foundName = ''
                
                // Attempt to find Year and Name
                for (let r = 0; r < Math.min(rows.length, 10); r++) {
                    const row = rows[r] || []
                    for (let c = 0; c < row.length; c++) {
                        const cell = row[c] || ''
                        const m = cell.match(/NPS (\d{4})/i)
                        if (m) foundYear = parseInt(m[1], 10)
                    }
                    if (r === 5 && row.length > 14) {
                        const cell = row[14]
                        if (cell && cell !== 'i') foundName = cell.trim()
                    }
                }

                if (!foundName) {
                    toast.error('Não foi possível encontrar o nome do colaborador na célula O6.')
                    return
                }

                // Check if user exists
                const { data: users } = await supabase.from('colaboradores').select('id, nome')
                const matchedUser = users?.find(u => u.nome.toLowerCase() === foundName.toLowerCase())
                
                if (!matchedUser) {
                    toast.error(`Colaborador "${foundName}" não encontrado no sistema.`)
                    return
                }

                const npsData: Record<number, any> = {}

                // Extract NPS GERAL
                for (let r = 0; r < rows.length; r++) {
                    const row = rows[r] || []
                    const npsIndex = row.indexOf('NPS GERAL')
                    const mesIndex = row.indexOf('MÊS')
                    
                    if (npsIndex !== -1 && mesIndex !== -1) {
                        // it expects months after a gap or immediately
                        for (let i = r + 1; i <= r + 15; i++) {
                            if (!rows[i]) continue
                            const mesName = String(rows[i][mesIndex]).trim().toLowerCase()
                            const mesNum = monthMap[mesName]
                            if (mesNum) {
                                const npsVal = parseNumber(rows[i][npsIndex])
                                if (npsVal !== null) {
                                    if (!npsData[mesNum]) npsData[mesNum] = {}
                                    npsData[mesNum].nps_geral = npsVal
                                }
                            }
                        }
                    }
                }

                // Extract Detailed Criteria
                for (let r = 0; r < rows.length; r++) {
                    const row = rows[r] || []
                    const mesIdx = row.findIndex(c => String(c).trim().toUpperCase() === 'MÊS')
                    const comIdx = row.findIndex(c => String(c).trim().toUpperCase() === 'COMUNICAÇÃO')
                    const dedIdx = row.findIndex(c => String(c).trim().toUpperCase() === 'DEDICAÇÃO')
                    const conIdx = row.findIndex(c => String(c).trim().toUpperCase() === 'CONFIANÇA')
                    const ponIdx = row.findIndex(c => String(c).trim().toUpperCase() === 'PONTUALIDADE')
                    const orgIdx = row.findIndex(c => String(c).trim().toUpperCase() === 'ORGANIZAÇÃO')
                    const proIdx = row.findIndex(c => String(c).trim().toUpperCase() === 'PROATIVIDADE')
                    const quaIdx = row.findIndex(c => String(c).trim().toUpperCase() === 'QUALIDADE NAS ENTREGAS')
                    const domIdx = row.findIndex(c => String(c).trim().toUpperCase() === 'DOMÍNIO TÉCNICO')

                    const supIdx = row.findIndex(c => String(c).trim().toUpperCase().includes('SUPORTE'))
                    const lidIdx = row.findIndex(c => String(c).trim().toUpperCase() === 'LIDERANÇA')
                    const relIdx = row.findIndex(c => String(c).trim().toUpperCase().includes('RELACIONAMENTO'))
                    const resIdx = row.findIndex(c => String(c).trim().toUpperCase() === 'RESOLUTIVIDADE')

                    if (mesIdx !== -1 && (dedIdx !== -1 || supIdx !== -1)) {
                        for (let i = r + 1; i <= r + 15; i++) {
                            if (!rows[i]) continue
                            const mesName = String(rows[i][mesIdx]).trim().toLowerCase()
                            const mesNum = monthMap[mesName]
                            if (mesNum) {
                                if (!npsData[mesNum]) npsData[mesNum] = {}
                                
                                const getVal = (idx: number) => idx !== -1 ? parseNumber(rows[i][idx]) : null
                                
                                const mapped = {
                                    comunicacao: getVal(comIdx),
                                    dedicacao: getVal(dedIdx),
                                    confianca: getVal(conIdx),
                                    pontualidade: getVal(ponIdx),
                                    organizacao: getVal(orgIdx),
                                    proatividade: getVal(proIdx),
                                    qualidade_entregas: getVal(quaIdx),
                                    dominio_tecnico: getVal(domIdx),
                                    suporte: getVal(supIdx),
                                    lideranca: getVal(lidIdx),
                                    relacionamento: getVal(relIdx),
                                    resolutividade: getVal(resIdx)
                                }

                                Object.entries(mapped).forEach(([k, v]) => {
                                    if (v !== null) npsData[mesNum][k] = v
                                })
                            }
                        }
                        break;
                    }
                }

                const records = Object.entries(npsData).filter(([_, data]) => Object.keys(data).length > 0).map(([m, data]) => ({
                    mes: parseInt(m),
                    ano: foundYear,
                    colaborador_id: matchedUser.id,
                    ...data
                }))

                if (records.length === 0) {
                    toast('Nenhum dado válido de NPS encontrado no CSV.')
                    return
                }

                setPreview({
                    name: matchedUser.nome,
                    year: foundYear,
                    count: records.length,
                    records
                })
            }
        })
    }

    const processImport = async () => {
        if (!preview) return
        setUploading(true)
        
        let successCount = 0
        for (const record of preview.records) {
            // Upsert based on colaborador_id, mes, ano
            const { error } = await supabase
                .from('avaliacoes_nps')
                .upsert(record, { onConflict: 'colaborador_id, mes, ano' })
            
            if (!error) successCount++
        }

        setUploading(false)
        setOpen(false)
        setPreview(null)
        toast.success(`${successCount} avaliações importadas/atualizadas com sucesso!`)
        setTimeout(() => window.location.reload(), 1000)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 font-bold bg-white dark:bg-[#0f172a]">
                    <FileSpreadsheet className="h-4 w-4" />
                    Importar NPS (CSV)
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <DialogHeader>
                    <DialogTitle className="text-xl font-display">Importar NPS</DialogTitle>
                </DialogHeader>
                
                <div className="py-4">
                    {!preview ? (
                        <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl relative hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                            <Upload className="h-8 w-8 text-slate-400 mb-3" />
                            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Clique para anexar arquivo</p>
                            <p className="text-xs text-slate-500 mt-1">Apenas formato CSV padronizado</p>
                            <input 
                                type="file" 
                                accept=".csv" 
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={handleFile}
                            />
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl">
                                <h4 className="font-bold text-emerald-900 dark:text-emerald-100 mb-2">Dados Detectados</h4>
                                <div className="space-y-1 text-sm text-emerald-700 dark:text-emerald-300">
                                    <p><strong>Colaborador:</strong> {preview.name}</p>
                                    <p><strong>Ano:</strong> {preview.year}</p>
                                    <p><strong>Avaliações:</strong> {preview.count} meses encontrados</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex gap-2">
                    <Button variant="ghost" onClick={() => { setPreview(null); setOpen(false) }}>Cancelar</Button>
                    <Button 
                        disabled={!preview || uploading} 
                        onClick={processImport}
                        className="bg-primary hover:bg-primary/90 text-white font-bold"
                    >
                        {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Confirmar Importação
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
