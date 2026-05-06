"use client"

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Upload, Loader2, FileSpreadsheet, AlertTriangle } from "lucide-react"
import { supabase } from "@/lib/supabase"
import Papa from 'papaparse'
import * as XLSX from 'xlsx'
import { toast } from "sonner"

export function ImportNpsDialog() {
    const [open, setOpen] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [preview, setPreview] = useState<any>(null)
    const [parseError, setParseError] = useState<string | null>(null)
    const [rawRows, setRawRows] = useState<string[][] | null>(null)
    const [manualName, setManualName] = useState('')
    const [allColaboradores, setAllColaboradores] = useState<any[]>([])

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

    const processRows = async (rows: string[][], overrideName?: string) => {
        setParseError(null)
        let foundYear = new Date().getFullYear()
        let foundName = overrideName || ''

        // Attempt to find Year and Name from spreadsheet
        for (let r = 0; r < Math.min(rows.length, 15); r++) {
            const row = rows[r] || []
            for (let c = 0; c < row.length; c++) {
                const cell = String(row[c] || '').trim()
                // Find year in NPS YYYY pattern
                const m = cell.match(/NPS\s*(\d{4})/i)
                if (m) foundYear = parseInt(m[1], 10)
            }
        }

        // Try multiple strategies to find the name
        if (!foundName) {
            // Strategy 1: Check row 5 (0-indexed), column 14 (O6 in spreadsheet)
            if (rows[5]?.length > 14 && rows[5][14] && rows[5][14].trim() !== '' && rows[5][14] !== 'i') {
                foundName = rows[5][14].trim()
            }
            // Strategy 2: Check around rows 3-8, columns 12-16 for a name
            if (!foundName) {
                const { data: allUsers } = await supabase.from('colaboradores').select('id, nome')
                setAllColaboradores(allUsers || [])
                const userNames = (allUsers || []).map(u => u.nome.toLowerCase())

                for (let r = 2; r < Math.min(rows.length, 10); r++) {
                    const row = rows[r] || []
                    for (let c = 0; c < row.length; c++) {
                        const cell = String(row[c] || '').trim()
                        if (cell && cell.length > 3 && userNames.includes(cell.toLowerCase())) {
                            foundName = cell
                            break
                        }
                    }
                    if (foundName) break
                }
            }
        }

        if (!foundName) {
            // Can't find name — ask user to select manually
            const { data: allUsers } = await supabase.from('colaboradores').select('id, nome')
            setAllColaboradores(allUsers || [])
            setRawRows(rows)
            setParseError('Não foi possível detectar automaticamente o nome do colaborador. Selecione manualmente abaixo.')
            return
        }

        // Check if user exists
        let users = allColaboradores
        if (users.length === 0) {
            const { data } = await supabase.from('colaboradores').select('id, nome')
            users = data || []
            setAllColaboradores(users)
        }
        const matchedUser = users.find(u => u.nome.toLowerCase() === foundName.toLowerCase())

        if (!matchedUser) {
            setRawRows(rows)
            setParseError(`Colaborador "${foundName}" não encontrado no sistema. Selecione manualmente.`)
            return
        }

        // Extract NPS data
        const npsData: Record<number, any> = {}

        // Extract NPS GERAL
        for (let r = 0; r < rows.length; r++) {
            const row = rows[r] || []
            const npsIndex = row.findIndex(c => String(c).trim().toUpperCase() === 'NPS GERAL')
            const mesIndex = row.findIndex(c => String(c).trim().toUpperCase() === 'MÊS')

            if (npsIndex !== -1 && mesIndex !== -1) {
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
            avaliador_id: matchedUser.id, // Set to self to allow upsert to work properly with new unique constraint
            tipo_avaliacao: 'gerente',
            ...data
        }))

        if (records.length === 0) {
            toast.error('Nenhum dado válido de NPS encontrado no arquivo. Verifique se as colunas "MÊS" e "NPS GERAL" existem.')
            return
        }

        setParseError(null)
        setRawRows(null)
        setPreview({
            name: matchedUser.nome,
            year: foundYear,
            count: records.length,
            records
        })
    }

    const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setPreview(null)
        setParseError(null)
        setRawRows(null)

        const ext = file.name.split('.').pop()?.toLowerCase()

        if (ext === 'xlsx' || ext === 'xls') {
            const reader = new FileReader()
            reader.onload = async (evt) => {
                try {
                    const data = evt.target?.result
                    const workbook = XLSX.read(data, { type: 'array' })
                    const firstSheetName = workbook.SheetNames[0]
                    const worksheet = workbook.Sheets[firstSheetName]
                    const rows: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' })
                    const stringRows = rows.map(row => (row as any[]).map(cell => String(cell ?? '')))
                    await processRows(stringRows)
                } catch (err) {
                    toast.error('Erro ao processar arquivo Excel. Verifique o formato.')
                    console.error('XLSX parse error:', err)
                }
            }
            reader.readAsArrayBuffer(file)
        } else {
            Papa.parse(file, {
                complete: async (results) => {
                    const rows = results.data as string[][]
                    await processRows(rows)
                },
                error: (err) => {
                    toast.error('Erro ao processar CSV.')
                    console.error('CSV parse error:', err)
                }
            })
        }
    }

    const handleManualSelect = async () => {
        if (!manualName || !rawRows) return
        await processRows(rawRows, manualName)
    }

    const processImport = async () => {
        if (!preview) return
        setUploading(true)

        let successCount = 0
        for (const record of preview.records) {
            const { error } = await supabase
                .from('avaliacoes_nps')
                .upsert(record, { onConflict: 'colaborador_id, mes, ano, avaliador_id' })

            if (!error) successCount++
            else console.error('Import error:', error)
        }

        setUploading(false)
        setOpen(false)
        setPreview(null)
        setParseError(null)
        setRawRows(null)
        toast.success(`${successCount} avaliações importadas/atualizadas com sucesso!`)
        setTimeout(() => window.location.reload(), 1000)
    }

    return (
        <Dialog open={open} onOpenChange={(o) => {
            setOpen(o)
            if (!o) { setPreview(null); setParseError(null); setRawRows(null); setManualName('') }
        }}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2 font-bold bg-white dark:bg-[#0f172a]">
                    <FileSpreadsheet className="h-4 w-4" />
                    Importar NPS (CSV/Excel)
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[480px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
                <DialogHeader>
                    <DialogTitle className="text-xl font-display">Importar NPS</DialogTitle>
                </DialogHeader>

                <div className="py-4 space-y-4">
                    {/* File upload area */}
                    <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-xl relative hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <Upload className="h-8 w-8 text-slate-400 mb-3" />
                        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                            {preview ? '✓ Arquivo carregado' : 'Clique para anexar arquivo'}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">Formatos aceitos: CSV, XLSX, XLS</p>
                        <input
                            type="file"
                            accept=".csv,.xlsx,.xls"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={handleFile}
                        />
                    </div>

                    {/* Manual name selection fallback */}
                    {parseError && (
                        <div className="p-4 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-xl space-y-3">
                            <div className="flex items-start gap-2">
                                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                                <p className="text-sm text-amber-800 dark:text-amber-200">{parseError}</p>
                            </div>
                            <select
                                value={manualName}
                                onChange={e => setManualName(e.target.value)}
                                className="w-full px-3 py-2 text-sm rounded-lg border border-amber-200 dark:border-amber-500/30 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                            >
                                <option value="">Selecione o colaborador...</option>
                                {allColaboradores.sort((a, b) => a.nome.localeCompare(b.nome)).map(c => (
                                    <option key={c.id} value={c.nome}>{c.nome}</option>
                                ))}
                            </select>
                            <Button
                                size="sm"
                                disabled={!manualName}
                                onClick={handleManualSelect}
                                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold"
                            >
                                Processar com este colaborador
                            </Button>
                        </div>
                    )}

                    {/* Preview */}
                    {preview && (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl">
                            <h4 className="font-bold text-emerald-900 dark:text-emerald-100 mb-2">Dados Detectados</h4>
                            <div className="space-y-1 text-sm text-emerald-700 dark:text-emerald-300">
                                <p><strong>Colaborador:</strong> {preview.name}</p>
                                <p><strong>Ano:</strong> {preview.year}</p>
                                <p><strong>Avaliações:</strong> {preview.count} meses encontrados</p>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex gap-2">
                    <Button variant="ghost" onClick={() => { setPreview(null); setParseError(null); setRawRows(null); setOpen(false) }}>Cancelar</Button>
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
