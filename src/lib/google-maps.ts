// Google Maps no servidor (fase 5 do reembolso de gasolina): sugestão de
// endereços (Places API New — Autocomplete) e distância de carro com paradas
// (Routes API — Compute Routes). A chave fica só no servidor
// (GOOGLE_MAPS_API_KEY); sem ela, tudo fica desligado e o membro digita os km
// como antes.
//
// Custos: as duas APIs têm 10.000 usos grátis por mês (faixa Essentials).
// Até 10 paradas a rota continua na faixa básica — por isso o limite de
// pontos abaixo. Limites de uso por pessoa e cache seguram cliques repetidos.

const CHAVE = () => process.env.GOOGLE_MAPS_API_KEY ?? ''

export function mapsAtivo(): boolean {
    return CHAVE().length > 0
}

// Natal/RN: as sugestões priorizam a região da Produtiva (sem excluir o resto do Brasil).
const CENTRO_BIAS = { latitude: -5.7945, longitude: -35.211 }
const MAX_INTERMEDIARIOS = 10

// --- limite simples por pessoa (memória do servidor) -----------------------
const usos = new Map<string, number[]>()
export function dentroDoLimite(chave: string, maxPorMinuto: number): boolean {
    const agora = Date.now()
    const recentes = (usos.get(chave) ?? []).filter(t => agora - t < 60_000)
    if (recentes.length >= maxPorMinuto) { usos.set(chave, recentes); return false }
    recentes.push(agora)
    usos.set(chave, recentes)
    return true
}

async function chamarGoogle(url: string, corpo: unknown, fieldMask?: string): Promise<unknown> {
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': CHAVE(),
            ...(fieldMask ? { 'X-Goog-FieldMask': fieldMask } : {}),
        },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(10_000),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
        // A mensagem do Google não traz a chave; ajuda a VP a diagnosticar (API não ativada, cota...).
        const msg = (json as { error?: { message?: string } })?.error?.message ?? `HTTP ${res.status}`
        throw new Error(msg.slice(0, 300))
    }
    return json
}

export interface SugestaoEndereco {
    texto: string        // texto completo, vai para o campo
    principal: string    // ex.: "UFRN"
    secundario: string   // ex.: "Lagoa Nova, Natal - RN, Brasil"
}

export async function sugerirEnderecos(entrada: string): Promise<SugestaoEndereco[]> {
    const json = await chamarGoogle('https://places.googleapis.com/v1/places:autocomplete', {
        input: entrada,
        languageCode: 'pt-BR',
        includedRegionCodes: ['br'],
        locationBias: { circle: { center: CENTRO_BIAS, radius: 50_000 } },
    }) as { suggestions?: { placePrediction?: { text?: { text?: string }, structuredFormat?: { mainText?: { text?: string }, secondaryText?: { text?: string } } } }[] }

    return (json.suggestions ?? [])
        .map(s => s.placePrediction)
        .filter(p => p?.text?.text)
        .map(p => ({
            texto: p!.text!.text!,
            principal: p!.structuredFormat?.mainText?.text ?? p!.text!.text!,
            secundario: p!.structuredFormat?.secondaryText?.text ?? '',
        }))
        .slice(0, 5)
}

export interface OpcaoRota {
    distancia_km: number
    duracao_min: number
    descricao: string     // ex.: "BR-101" (o Google diz por onde a rota passa)
    polyline?: string     // desenho do trajeto (polyline codificada do Google)
}

export interface RotaCalculada {
    distancia_km: number  // da rota escolhida pelo membro
    duracao_min: number
    melhor_km: number     // menor distância entre as opções do Google ("melhor caminho")
    escolhida: number     // índice em `opcoes`
    opcoes: OpcaoRota[]
    pontos: string[]      // saída, paradas, chegada (e a saída de novo, se ida e volta)
    ida_e_volta: boolean
    calculado_em: string
}

interface OpcoesCalculadas { pontos: string[], ida_e_volta: boolean, opcoes: OpcaoRota[], calculado_em: string }

// Mesma rota pedida de novo (formulário e depois ao salvar) não gasta outra chamada.
const cacheRotas = new Map<string, { em: number, valor: OpcoesCalculadas }>()
const CACHE_MS = 60 * 60_000

export function pontosDaRota(origem: string, paradas: string[], destino: string, idaEVolta: boolean): string[] {
    return [origem, ...paradas, destino, ...(idaEVolta ? [origem] : [])].map(p => p.trim()).filter(Boolean)
}

type RespostaRotas = { routes?: { distanceMeters?: number, duration?: string, description?: string, polyline?: { encodedPolyline?: string } }[] }

// Opções de caminho do Google. Sem paradas, pede rotas alternativas (o Google
// só oferece alternativas sem paradas intermediárias); ida e volta sem
// paradas = mesma rota duas vezes. Com paradas, uma rota só.
async function calcularOpcoes(origem: string, paradas: string[], destino: string, idaEVolta: boolean): Promise<OpcoesCalculadas | null> {
    const pontos = pontosDaRota(origem, paradas, destino, idaEVolta)
    if (pontos.length < 2) return null
    if (pontos.length - 2 > MAX_INTERMEDIARIOS) throw new Error(`No máximo ${MAX_INTERMEDIARIOS} paradas no trajeto (contando a volta).`)

    const chave = JSON.stringify(pontos)
    const emCache = cacheRotas.get(chave)
    if (emCache && Date.now() - emCache.em < CACHE_MS) return emCache.valor

    const semParadas = paradas.filter(p => p.trim()).length === 0
    const trecho = semParadas ? [origem.trim(), destino.trim()] : pontos
    const fator = semParadas && idaEVolta ? 2 : 1

    const json = await chamarGoogle('https://routes.googleapis.com/directions/v2:computeRoutes', {
        origin: { address: trecho[0] },
        destination: { address: trecho[trecho.length - 1] },
        intermediates: trecho.slice(1, -1).map(address => ({ address })),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
        computeAlternativeRoutes: semParadas,
        languageCode: 'pt-BR',
        regionCode: 'BR',
        units: 'METRIC',
    }, 'routes.distanceMeters,routes.duration,routes.description,routes.polyline.encodedPolyline') as RespostaRotas

    const opcoes: OpcaoRota[] = (json.routes ?? [])
        .filter(r => r.distanceMeters)
        .slice(0, 3)
        .map(r => ({
            distancia_km: Math.round((r.distanceMeters! * fator) / 100) / 10,
            duracao_min: Math.round((parseInt(r.duration ?? '0', 10) * fator) / 60),
            descricao: (r.description ?? '').slice(0, 120),
            polyline: r.polyline?.encodedPolyline,
        }))
    if (!opcoes.length) return null

    const valor = { pontos, ida_e_volta: idaEVolta, opcoes, calculado_em: new Date().toISOString() }
    if (cacheRotas.size > 500) cacheRotas.clear()
    cacheRotas.set(chave, { em: Date.now(), valor })
    return valor
}

// `escolhida`: índice da opção que o membro marcou (padrão: a primeira, a
// recomendada pelo Google). `paraGuardar`: sem os desenhos das opções não
// escolhidas, para não pesar o registro no banco.
export async function calcularRota(origem: string, paradas: string[], destino: string, idaEVolta: boolean, escolhida = 0, paraGuardar = false): Promise<RotaCalculada | null> {
    const calc = await calcularOpcoes(origem, paradas, destino, idaEVolta)
    if (!calc) return null
    const i = Number.isInteger(escolhida) && escolhida >= 0 && escolhida < calc.opcoes.length ? escolhida : 0
    const opcoes = paraGuardar ? calc.opcoes.map((o, j) => (j === i ? o : { ...o, polyline: undefined })) : calc.opcoes
    return {
        distancia_km: calc.opcoes[i].distancia_km,
        duracao_min: calc.opcoes[i].duracao_min,
        melhor_km: Math.min(...calc.opcoes.map(o => o.distancia_km)),
        escolhida: i,
        opcoes,
        pontos: calc.pontos,
        ida_e_volta: calc.ida_e_volta,
        calculado_em: calc.calculado_em,
    }
}
