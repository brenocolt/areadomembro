// Datas de calendário (AAAA-MM-DD) e formatação da aba Reconhecimentos.
// Todo cálculo de "hoje" e de instante->data usa o fuso America/Sao_Paulo, e a
// aritmética de dias é feita em UTC sobre a data de calendário — o resultado
// não depende do fuso do servidor nem do navegador.

export const FUSO = 'America/Sao_Paulo'

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

export function dataISOValida(valor: unknown): valor is string {
    if (typeof valor !== 'string') return false
    const m = ISO.exec(valor)
    if (!m) return false
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
    return d.toISOString().slice(0, 10) === valor
}

const fmtDataSP = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO, year: 'numeric', month: '2-digit', day: '2-digit',
})

// Data de calendário (no fuso de São Paulo) de um instante.
export function dataISODoInstante(instante: Date | string | number): string {
    return fmtDataSP.format(new Date(instante))
}

export function hojeISO(agora: Date = new Date()): string {
    return dataISODoInstante(agora)
}

export function adicionarDias(iso: string, dias: number): string {
    const m = ISO.exec(iso)
    if (!m) throw new Error(`Data inválida: ${iso}`)
    const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + dias))
    return d.toISOString().slice(0, 10)
}

// Dias de calendário entre duas datas (ate - de).
export function diferencaDias(deISO: string, ateISO: string): number {
    const a = ISO.exec(deISO)
    const b = ISO.exec(ateISO)
    if (!a || !b) throw new Error('Data inválida')
    const ms = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3])) - Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]))
    return Math.round(ms / 86400000)
}

// Aceita "AAAA-MM-DD" (data de calendário, sem deslocar fuso) ou um instante
// ISO/timestamp (convertido para a data em São Paulo). Devolve "dd/mm/aaaa".
export function formatarData(valor: string | Date | null | undefined): string {
    if (!valor) return ''
    const iso = typeof valor === 'string' && ISO.test(valor) ? valor : dataISODoInstante(valor)
    const [a, m, d] = iso.split('-')
    return `${d}/${m}/${a}`
}

export function formatarMoeda(valor: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
}

// Minúsculas e sem acento — usado em buscas e na detecção do tipo "Núcleo".
export function normalizar(texto: string | null | undefined): string {
    return (texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
