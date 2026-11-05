// Cliente da API GraphQL do Monday.com, compartilhado pela sincronização de
// projetos (monday-sync.ts) e pelo reembolso de gasolina (board "Processos
// de Pagamento").
export const MONDAY_API_TOKEN = process.env.MONDAY_API_TOKEN || ''

// Board "Processos de Pagamento" — onde caem as solicitações de reembolso.
export const MONDAY_PAGAMENTOS_BOARD_ID = process.env.MONDAY_PAGAMENTOS_BOARD_ID || '9011987674'

// Token próprio para o board de pagamentos: o dono de MONDAY_API_TOKEN (usado
// na sincronização de projetos) não participa desse board, e o Monday trata
// board sem acesso como inexistente. Sem a variável, cai no token geral.
export const MONDAY_PAGAMENTOS_API_TOKEN = process.env.MONDAY_PAGAMENTOS_API_TOKEN || MONDAY_API_TOKEN

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function mondayRequest(query: string, variables?: Record<string, any>, token = MONDAY_API_TOKEN): Promise<any> {
    const res: Response = await fetch('https://api.monday.com/v2', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': token,
            'API-Version': '2024-10',
        },
        body: JSON.stringify(variables ? { query, variables } : { query }),
    })

    if (!res.ok) {
        throw new Error(`Monday API error: ${await res.text()}`)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const json: any = await res.json()
    if (json.errors) {
        throw new Error(`Monday GraphQL errors: ${JSON.stringify(json.errors)}`)
    }
    return json.data
}

// Opções de uma coluna dropdown do board de pagamentos (ex.: "Categorias
// Consultoria / Assessoria" — a lista de projetos que o membro escolhe ao
// lançar uma viagem de gasolina). Cache de 10 min por coluna: a lista muda
// pouco e a tela de viagens consulta a cada abertura.
const cacheOpcoes = new Map<string, { em: number, opcoes: string[] }>()
const CACHE_MS = 10 * 60 * 1000

export async function listarOpcoesDropdown(colunaId: string): Promise<string[]> {
    const emCache = cacheOpcoes.get(colunaId)
    if (emCache && Date.now() - emCache.em < CACHE_MS) return emCache.opcoes
    if (!MONDAY_PAGAMENTOS_API_TOKEN) throw new Error('MONDAY_PAGAMENTOS_API_TOKEN não configurado.')

    // Valores direto na query (mesmo estilo de monday-sync.ts), sem variáveis
    // GraphQL: o tipo exato do argumento `ids` de columns varia entre versões
    // da API e uma variável com tipo diferente derruba a consulta inteira.
    if (!/^[a-z0-9_]+$/.test(colunaId) || !/^\d+$/.test(MONDAY_PAGAMENTOS_BOARD_ID)) {
        throw new Error(`ID de coluna/board inválido: ${colunaId} / ${MONDAY_PAGAMENTOS_BOARD_ID}`)
    }
    const data = await mondayRequest(
        `{ boards(ids: [${MONDAY_PAGAMENTOS_BOARD_ID}]) { columns(ids: ["${colunaId}"]) { settings_str } } }`,
        undefined,
        MONDAY_PAGAMENTOS_API_TOKEN
    )
    if (!data?.boards?.length) {
        throw new Error(`Board ${MONDAY_PAGAMENTOS_BOARD_ID} não encontrado — o token do Monday (MONDAY_PAGAMENTOS_API_TOKEN) tem acesso a ele?`)
    }
    const settings = data?.boards?.[0]?.columns?.[0]?.settings_str
    if (!settings) throw new Error(`Coluna ${colunaId} não encontrada no board ${MONDAY_PAGAMENTOS_BOARD_ID}.`)

    // settings_str do dropdown: {"labels":[{"id":1,"name":"AC ADVOGADOS"}, ...]}
    // (opções desativadas vêm marcadas em "deactivated_labels").
    const parsed = JSON.parse(settings)
    const desativadas = new Set<number>(Array.isArray(parsed.deactivated_labels) ? parsed.deactivated_labels : [])
    const labels: { id: number, name: string }[] = Array.isArray(parsed.labels) ? parsed.labels : []
    const opcoes = labels
        .filter(l => l?.name && !desativadas.has(l.id))
        .map(l => l.name.trim())
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))

    cacheOpcoes.set(colunaId, { em: Date.now(), opcoes })
    return opcoes
}
