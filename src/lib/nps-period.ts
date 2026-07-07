// Toda avaliação (NPS Projeto, NPS Interno, etc.) é sempre sobre o mês
// imediatamente anterior ao mês em que foi respondida/enviada.
export function mesReferenciaFromDate(date: Date | string): { mes: number; ano: number } {
    const d = typeof date === 'string' ? new Date(date) : date
    const mesEnvio = d.getMonth() + 1
    const anoEnvio = d.getFullYear()
    return mesEnvio === 1
        ? { mes: 12, ano: anoEnvio - 1 }
        : { mes: mesEnvio - 1, ano: anoEnvio }
}
