'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Upload, FileUp, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';
import { importNpsData } from '@/lib/nps-actions';

export function ImportNPSDialog() {
    const [open, setOpen] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            setFile(e.target.files[0]);
        }
    };

    const handleImport = async () => {
        if (!file) {
            toast.error("Por favor, selecione um arquivo CSV.");
            return;
        }

        setLoading(true);

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                try {
                    const data = results.data as Record<string, unknown>[];
                    // Expected format has columns like: Tipo, Nome, Período, NPS, Comunicação, Suporte, Relacionamento, Resolutividade, Liderança, Dedicação, Confiança, Pontualidade, Organização, Proatividade, Qualidade Entregas, Domínio Técnico
                    
                    const res = await importNpsData(data);
                    
                    if (res.success) {
                        toast.success(`NPS importado com sucesso! ${res.updatedCount} registros atualizados.`);
                        setOpen(false);
                        setFile(null);
                    } else {
                        toast.error("Erro ao importar NPS: " + res.error);
                    }
                } catch (err: unknown) {
                    toast.error("Erro ao importar: " + (err as Error).message);
                } finally {
                    setLoading(false);
                }
            },
            error: (error) => {
                toast.error("Erro ao ler o arquivo CSV: " + error.message);
                setLoading(false);
            }
        });
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="gap-2">
                    <FileUp className="w-4 h-4" />
                    Importar NPS (CSV)
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Importar Avaliações NPS</DialogTitle>
                    <DialogDescription>
                        Faça o upload da planilha de NPS em formato CSV. 
                        As informações serão mescladas aos membros pré-cadastrados.
                    </DialogDescription>
                </DialogHeader>
                
                <div className="grid gap-4 py-4">
                    <div className="grid w-full max-w-sm items-center gap-1.5">
                        <label htmlFor="csv" className="text-sm font-medium">Arquivo CSV</label>
                        <input 
                            id="csv" 
                            type="file" 
                            accept=".csv" 
                            onChange={handleFileChange}
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-slate-900 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 dark:text-slate-100"
                        />
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
                        Cancelar
                    </Button>
                    <Button onClick={handleImport} disabled={loading || !file} className="gap-2">
                        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                        Importar Dados
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
