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

export interface RotaCalculada {
    distancia_km: number
    duracao_min: number
    pontos: string[]      // saída, paradas, chegada (e a saída de novo, se ida e volta)
    ida_e_volta: boolean
    calculado_em: string
}

// Mesma rota pedida de novo (prévia no formulário e depois ao salvar) não
// gasta outra chamada.
const cacheRotas = new Map<string, { em: number, rota: RotaCalculada }>()
const CACHE_MS = 60 * 60_000

export function pontosDaRota(origem: string, paradas: string[], destino: string, idaEVolta: boolean): string[] {
    return [origem, ...paradas, destino, ...(idaEVolta ? [origem] : [])].map(p => p.trim()).filter(Boolean)
}

export async function calcularRota(origem: string, paradas: string[], destino: string, idaEVolta: boolean): Promise<RotaCalculada | null> {
    const pontos = pontosDaRota(origem, paradas, destino, idaEVolta)
    if (pontos.length < 2) return null
    if (pontos.length - 2 > MAX_INTERMEDIARIOS) throw new Error(`No máximo ${MAX_INTERMEDIARIOS} paradas no trajeto (contando a volta).`)

    const chave = JSON.stringify(pontos)
    const emCache = cacheRotas.get(chave)
    if (emCache && Date.now() - emCache.em < CACHE_MS) return emCache.rota

    const json = await chamarGoogle('https://routes.googleapis.com/directions/v2:computeRoutes', {
        origin: { address: pontos[0] },
        destination: { address: pontos[pontos.length - 1] },
        intermediates: pontos.slice(1, -1).map(address => ({ address })),
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
        languageCode: 'pt-BR',
        regionCode: 'BR',
        units: 'METRIC',
    }, 'routes.distanceMeters,routes.duration') as { routes?: { distanceMeters?: number, duration?: string }[] }

    const r = json.routes?.[0]
    if (!r?.distanceMeters) return null
    const rota: RotaCalculada = {
        distancia_km: Math.round(r.distanceMeters / 100) / 10,
        duracao_min: Math.round(parseInt(r.duration ?? '0', 10) / 60),
        pontos,
        ida_e_volta: idaEVolta,
        calculado_em: new Date().toISOString(),
    }
    if (cacheRotas.size > 500) cacheRotas.clear()
    cacheRotas.set(chave, { em: Date.now(), rota })
    return rota
}
