// Regras do reembolso de gasolina que valem igual no navegador e no servidor.
// Herdadas da planilha "REEMBOLSO GASOLINA" (ver
// supabase/migrations/20261105_gasolina.sql).

export const COMBUSTIVEIS = ['Gasolina', 'Etanol', 'Flex', 'Diesel', 'Híbrido', 'GNV'] as const

export interface GasolinaVeiculo {
    id: string
    colaborador_id: string
    modelo: string
    ano: number | null
    combustivel: string
    autonomia_informada: number
    autonomia_km_l: number
    foto_painel_url: string
    autonomia_alterada_por: string | null
    autonomia_alterada_em: string | null
    ativo: boolean
    criado_em: string
    // Invalidado pela VP (tentativa de fraude): não pode ser usado em viagens.
    invalidado_em?: string | null
    motivo_invalidacao?: string | null
    // Aprovado pela VP (carro novo só pode ser usado depois disso).
    aprovado_em?: string | null
}

export interface GasolinaPreco {
    mes: string
    preco_litro: number
    atualizado_por: string | null
    atualizado_em: string
}

export interface MondayColunaValor {
    coluna: string
    valor: string
}

export interface GasolinaCentroCusto {
    id: string
    nome: string
    tipo: 'projeto' | 'fixo'
    rotulo_fixo: string | null
    monday_centro_custo: string
    monday_coluna_projeto: string | null
    monday_colunas: MondayColunaValor[]
    ativo: boolean
    ordem: number
}

// "2026-03-17" -> "2026-03-01" (chave da tabela gasolina_precos).
export function inicioDoMes(data: string): string {
    return `${data.slice(0, 7)}-01`
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

// "2026-03-01" -> "março/2026" (mesmo formato da coluna MÊS da planilha).
export function formatarMes(mes: string): string {
    const [ano, m] = mes.split('-')
    return `${MESES[Number(m) - 1]}/${ano}`
}

export function formatarReais(valor: number | null | undefined): string {
    return (valor ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function formatarNumero(valor: number | null | undefined, casas = 2): string {
    return (valor ?? 0).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas })
}

// Aceita "8,5" e "8.5".
export function lerNumero(v: unknown): number | null {
    if (typeof v === 'number') return Number.isFinite(v) ? v : null
    if (typeof v !== 'string' || !v.trim()) return null
    const n = Number(v.trim().replace(',', '.'))
    return Number.isFinite(n) ? n : null
}

// litros = km ÷ autonomia (coluna TOTAL EM LITROS da planilha).
export function calcularLitros(distanciaKm: number, autonomiaKmL: number): number {
    return Math.round((distanciaKm / autonomiaKmL) * 1000) / 1000
}

// Chave Pix: CPF, CNPJ, e-mail, celular (+55) ou chave aleatória (EVP).
// Devolve a chave normalizada do jeito que o banco a aceita.
export function validarChavePix(entrada: string):
    { ok: true, chave: string, tipo: 'CPF' | 'CNPJ' | 'E-mail' | 'Celular' | 'Aleatória' } | { ok: false, error: string } {
    const v = entrada.trim()
    if (!v) return { ok: false, error: 'Informe a chave Pix.' }

    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 77) return { ok: true, chave: v.toLowerCase(), tipo: 'E-mail' }
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return { ok: true, chave: v.toLowerCase(), tipo: 'Aleatória' }

    const digitos = v.replace(/\D/g, '')
    if (v.startsWith('+')) {
        if (/^55\d{10,11}$/.test(digitos)) return { ok: true, chave: `+${digitos}`, tipo: 'Celular' }
        return { ok: false, error: 'Celular inválido — use o formato +55 DDD número.' }
    }
    if (digitos.length === 11 && cpfValido(digitos)) return { ok: true, chave: digitos, tipo: 'CPF' }
    if (digitos.length === 14 && cnpjValido(digitos)) return { ok: true, chave: digitos, tipo: 'CNPJ' }
    if (digitos.length === 11 || digitos.length === 10) {
        return { ok: false, error: 'CPF inválido. Se for celular, escreva com +55 na frente (ex.: +5584999998888).' }
    }
    return { ok: false, error: 'Chave Pix inválida. Use CPF, CNPJ, e-mail, celular (+55...) ou chave aleatória.' }
}

function cpfValido(cpf: string): boolean {
    if (/^(\d)\1{10}$/.test(cpf)) return false
    const dv = (base: string, pesoInicial: number) => {
        let soma = 0
        for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (pesoInicial - i)
        const resto = (soma * 10) % 11
        return resto === 10 ? 0 : resto
    }
    return dv(cpf.slice(0, 9), 10) === Number(cpf[9]) && dv(cpf.slice(0, 10), 11) === Number(cpf[10])
}

function cnpjValido(cnpj: string): boolean {
    if (/^(\d)\1{13}$/.test(cnpj)) return false
    const dv = (base: string) => {
        const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        const soma = base.split('').reduce((acc, d, i) => acc + Number(d) * pesos[i], 0)
        const resto = soma % 11
        return resto < 2 ? 0 : 11 - resto
    }
    return dv(cnpj.slice(0, 12)) === Number(cnpj[12]) && dv(cnpj.slice(0, 13)) === Number(cnpj[13])
}

export const STATUS_VIAGEM = ['Pendente', 'Em solicitação', 'Reembolsado', 'Vencido'] as const
export type StatusViagem = typeof STATUS_VIAGEM[number]

export interface GasolinaViagem {
    id: string
    colaborador_id: string
    veiculo_id: string | null
    centro_custo_id: string | null
    projeto: string
    projeto_original: string | null
    origem_local: string
    destino_local: string
    paradas: string[]
    distancia_km: number
    data_viagem: string
    autonomia_usada: number | null
    litros: number | null
    preco_litro: number | null
    valor: number | null
    status: StatusViagem
    solicitacao_id: string | null
    origem: 'app' | 'planilha'
    rota: RotaViagem | null
    criado_em: string
    solicitacao?: { id: string, status: string, motivo_recusa: string | null } | null
}

// Viagem de uma solicitação recusada que o membro ainda não retomou: no banco
// continua "Em solicitação" (vinculada), na tela aparece como "Recusada".
export function viagemRecusada(v: Pick<GasolinaViagem, 'status' | 'solicitacao'>): boolean {
    return v.status === 'Em solicitação' && v.solicitacao?.status === 'Recusado'
}

// Rota calculada pelo Google Maps ao salvar (fase 5). Os km que valem para o
// reembolso são sempre os de distancia_km; a rota serve de conferência.
export interface RotaViagem {
    distancia_km: number
    duracao_min: number
    km_google?: boolean         // os km da viagem vieram do cálculo do Google (campo travado)
    pontos: string[]
    ida_e_volta: boolean
    calculado_em: string
}

// Km informados bem diferentes da rota do Maps (mais de 15% e de 3 km).
export function kmDivergente(viagem: { distancia_km: number, rota: RotaViagem | null }): boolean {
    if (!viagem.rota) return false
    const diferenca = Math.abs(Number(viagem.distancia_km) - viagem.rota.distancia_km)
    return diferenca > 3 && diferenca > viagem.rota.distancia_km * 0.15
}

// Prazo da planilha: a viagem pode ser reembolsada até 2 meses depois do dia
// em que aconteceu; depois disso vira "Vencido".
export const PRAZO_MESES = 2

// Datas como "AAAA-MM-DD", no fuso de Brasília (o servidor roda em UTC e o
// dia vira 3h antes por lá).
export function hojeBrasil(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date())
}

function somarMeses(data: string, meses: number): string {
    const [a, m, d] = data.split('-').map(Number)
    const alvo = new Date(Date.UTC(a, m - 1 + meses, 1))
    // Mantém o dia, limitado ao último dia do mês (31/12 + 2 meses = 28 ou 29/02).
    const ultimoDia = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
    alvo.setUTCDate(Math.min(d, ultimoDia))
    return alvo.toISOString().slice(0, 10)
}

// Último dia em que a viagem ainda pode ser solicitada.
export function prazoDaViagem(dataViagem: string): string {
    return somarMeses(dataViagem, PRAZO_MESES)
}

// Viagens com data ANTERIOR a este dia já venceram.
export function dataMaisAntigaPermitida(hoje = hojeBrasil()): string {
    return somarMeses(hoje, -PRAZO_MESES)
}

export function diasAte(data: string, hoje = hojeBrasil()): number {
    const ms = Date.parse(`${data}T00:00:00Z`) - Date.parse(`${hoje}T00:00:00Z`)
    return Math.round(ms / 86400000)
}

export function formatarData(data: string): string {
    const [a, m, d] = data.slice(0, 10).split('-')
    return `${d}/${m}/${a}`
}
