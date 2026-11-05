// Leitura da planilha antiga "REEMBOLSO GASOLINA" (uma aba por membro) para a
// importação na Área do Membro. Roda no navegador: só o resultado estruturado
// (sem o arquivo) vai para /api/gasolina/importacao.
//
// As colunas são achadas pelo texto do cabeçalho (linha com "LOCAL DE SAÍDA"
// e "STATUS"), porque as abas antigas têm outro layout (sem MÊS/PREÇO/VALOR).
import * as XLSX from 'xlsx'

export const DATA_CORTE_IMPORTACAO = '2026-01-01'

export interface CarroPlanilha {
    nome: string
    autonomia: number
}

export interface ViagemPlanilha {
    linha: number
    origem: string
    destino: string
    motivo: string
    carro: string
    distancia_km: number | null
    litros: number | null
    data: string | null          // AAAA-MM-DD
    preco_litro: number | null   // coluna PREÇO MÊS, quando existe
    status: string
}

export interface AbaPlanilha {
    nome: string
    oculta: boolean
    carros: CarroPlanilha[]
    viagens: ViagemPlanilha[]           // só data >= DATA_CORTE_IMPORTACAO
    sem_data: number                    // linhas com km mas sem data válida (qualquer ano)
    anteriores_ao_corte: number
}

export interface PlanilhaGasolina {
    precos: { mes: string, preco_litro: number }[]   // mes = AAAA-MM-01
    abas: AbaPlanilha[]
}

export function normalizarTexto(v: unknown): string {
    return String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

function numero(v: unknown): number | null {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null
    if (typeof v !== 'string' || !v.trim()) return null
    const s = v.replace(/r\$/i, '').replace(/\s/g, '')
    const n = Number(s.includes(',') ? s.replace(/\./g, '').replace(',', '.') : s)
    return Number.isFinite(n) ? n : null
}

const dois = (n: number) => String(n).padStart(2, '0')

// Data da célula: número de série do Excel, Date ou texto dd/mm/aaaa.
function dataISO(v: unknown): string | null {
    if (typeof v === 'number' && v > 20000 && v < 80000) {
        const d = XLSX.SSF.parse_date_code(v)
        if (d && d.y) return `${d.y}-${dois(d.m)}-${dois(d.d)}`
    }
    if (v instanceof Date && !Number.isNaN(v.getTime())) {
        return `${v.getFullYear()}-${dois(v.getMonth() + 1)}-${dois(v.getDate())}`
    }
    if (typeof v === 'string') {
        const m = v.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
        if (m) return `${m[3]}-${dois(Number(m[2]))}-${dois(Number(m[1]))}`
    }
    return null
}

type Linha = unknown[]

function acharColunas(cabecalho: Linha, nomes: Record<string, string[]>): Record<string, number> {
    const cols: Record<string, number> = {}
    cabecalho.forEach((celula, i) => {
        const t = normalizarTexto(celula)
        for (const [chave, opcoes] of Object.entries(nomes)) {
            if (cols[chave] === undefined && opcoes.includes(t)) cols[chave] = i
        }
    })
    return cols
}

const CABECALHO_VIAGENS = {
    origem: ['LOCAL DE SAIDA'],
    destino: ['LOCAL DE CHEGADA'],
    motivo: ['MOTIVO'],
    carro: ['CARRO'],
    km: ['DISTANCIA (KM)'],
    litros: ['TOTAL EM LITROS'],
    data: ['DATA'],
    preco: ['PRECO MES'],
    status: ['STATUS'],
}

function lerAba(nome: string, oculta: boolean, linhas: Linha[]): AbaPlanilha | null {
    const iCab = linhas.findIndex(l => {
        const t = l.map(normalizarTexto)
        return t.includes('LOCAL DE SAIDA') && t.includes('STATUS')
    })
    if (iCab < 0) return null
    const col = acharColunas(linhas[iCab], CABECALHO_VIAGENS)
    if (col.km === undefined || col.data === undefined || col.status === undefined) return null

    // Carros: linhas logo abaixo do cabeçalho "CARRO | AUTONOMIA" (acima da tabela).
    const carros: CarroPlanilha[] = []
    const iCarro = linhas.slice(0, iCab).findIndex(l => {
        const t = l.map(normalizarTexto)
        return t.includes('CARRO') && t.includes('AUTONOMIA')
    })
    if (iCarro >= 0) {
        const c = acharColunas(linhas[iCarro], { nome: ['CARRO'], autonomia: ['AUTONOMIA'] })
        for (let i = iCarro + 1; i < iCab; i++) {
            const nomeCarro = String(linhas[i]?.[c.nome] ?? '').trim()
            const autonomia = numero(linhas[i]?.[c.autonomia])
            if (nomeCarro && autonomia && autonomia > 0) carros.push({ nome: nomeCarro, autonomia })
        }
    }

    const viagens: ViagemPlanilha[] = []
    let semData = 0
    let anteriores = 0
    for (let i = iCab + 1; i < linhas.length; i++) {
        const l = linhas[i] ?? []
        const km = numero(l[col.km])
        if (km === null || km <= 0) continue
        const data = dataISO(l[col.data])
        if (!data) { semData++; continue }
        if (data < DATA_CORTE_IMPORTACAO) { anteriores++; continue }
        viagens.push({
            linha: i + 1,
            origem: String(l[col.origem] ?? '').trim(),
            destino: String(l[col.destino] ?? '').trim(),
            motivo: String(l[col.motivo] ?? '').trim(),
            carro: String(l[col.carro] ?? '').trim(),
            distancia_km: km,
            litros: numero(l[col.litros]),
            data,
            preco_litro: col.preco !== undefined ? numero(l[col.preco]) : null,
            status: String(l[col.status] ?? '').trim(),
        })
    }
    return { nome, oculta, carros, viagens, sem_data: semData, anteriores_ao_corte: anteriores }
}

export function lerPlanilhaGasolina(workbook: XLSX.WorkBook): PlanilhaGasolina {
    const abas: AbaPlanilha[] = []
    const precos: { mes: string, preco_litro: number }[] = []
    const ocultas = new Set(
        (workbook.Workbook?.Sheets ?? []).filter(s => s.Hidden).map(s => s.name)
    )

    for (const nome of workbook.SheetNames) {
        const linhas = XLSX.utils.sheet_to_json<Linha>(workbook.Sheets[nome], { header: 1, raw: true, defval: null, blankrows: true })
        const n = normalizarTexto(nome)
        if (n === 'HISTORICO DE PRECOS') {
            const iCab = linhas.findIndex(l => l.map(normalizarTexto).includes('MESES'))
            if (iCab < 0) continue
            const c = acharColunas(linhas[iCab], { mes: ['MESES'], preco: ['PRECO'] })
            for (const l of linhas.slice(iCab + 1)) {
                const data = dataISO(l[c.mes])
                const preco = numero(l[c.preco])
                if (data && preco && preco > 0) precos.push({ mes: `${data.slice(0, 7)}-01`, preco_litro: preco })
            }
            continue
        }
        if (n.startsWith('EXEMPLO')) continue
        const aba = lerAba(nome, ocultas.has(nome), linhas)
        if (aba) abas.push(aba)
    }
    return { precos, abas }
}
