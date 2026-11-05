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

// Opções de uma coluna dropdown ou status do board de pagamentos (ex.:
// "Categorias Consultoria / Assessoria" — a lista de projetos que o membro
// escolhe ao lançar uma viagem de gasolina). Cache de 10 min por coluna: a lista muda
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
    // (opções desativadas vêm marcadas em "deactivated_labels"); do status:
    // {"labels":{"0":"Working on it","1":"Done", ...}}.
    const parsed = JSON.parse(settings)
    let nomes: string[]
    if (Array.isArray(parsed.labels)) {
        const desativadas = new Set<number>(Array.isArray(parsed.deactivated_labels) ? parsed.deactivated_labels : [])
        nomes = (parsed.labels as { id: number, name: string }[])
            .filter(l => l?.name && !desativadas.has(l.id))
            .map(l => l.name)
    } else {
        nomes = Object.values((parsed.labels ?? {}) as Record<string, string>)
    }
    const opcoes = nomes
        .map(n => (n ?? '').trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))

    cacheOpcoes.set(colunaId, { em: Date.now(), opcoes })
    return opcoes
}

// Comparação de rótulos do Monday sem acento/caixa ("Prospecção" = "PROSPECCAO").
export function normalizarRotulo(texto: string): string {
    return (texto ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
}

// Rótulo exato da coluna que corresponde a `desejado` (ou null).
export async function encontrarOpcao(colunaId: string, desejado: string): Promise<string | null> {
    const alvo = normalizarRotulo(desejado)
    return (await listarOpcoesDropdown(colunaId)).find(o => normalizarRotulo(o) === alvo) ?? null
}

// Cria um item no board de pagamentos com todas as colunas de uma vez (o
// webhook do n8n dispara na criação e precisa receber tudo preenchido).
export async function criarItemPagamento(nome: string, colunas: Record<string, unknown>, criarRotulos: boolean): Promise<string> {
    if (!MONDAY_PAGAMENTOS_API_TOKEN) throw new Error('MONDAY_PAGAMENTOS_API_TOKEN não configurado.')
    const data = await mondayRequest(
        `mutation($board: ID!, $nome: String!, $colunas: JSON!, $criar: Boolean) {
            create_item(board_id: $board, item_name: $nome, column_values: $colunas, create_labels_if_missing: $criar) { id }
        }`,
        { board: MONDAY_PAGAMENTOS_BOARD_ID, nome, colunas: JSON.stringify(colunas), criar: criarRotulos },
        MONDAY_PAGAMENTOS_API_TOKEN
    )
    const id = data?.create_item?.id
    if (!id) throw new Error('O Monday não devolveu o ID do card criado.')
    return String(id)
}

// Comentário (update) no item — usado para registrar o extrato das viagens.
export async function comentarItem(itemId: string, texto: string): Promise<void> {
    await mondayRequest(
        `mutation($item: ID!, $texto: String!) { create_update(item_id: $item, body: $texto) { id } }`,
        { item: itemId, texto },
        MONDAY_PAGAMENTOS_API_TOKEN
    )
}

// Texto atual de uma coluna (ex.: status do kanban) para vários itens. Itens
// excluídos do Monday simplesmente não aparecem no resultado.
export async function lerColunaDosItens(itemIds: string[], colunaId: string): Promise<Map<string, string>> {
    const resultado = new Map<string, string>()
    if (!/^[a-z0-9_]+$/.test(colunaId)) throw new Error(`ID de coluna inválido: ${colunaId}`)
    for (let i = 0; i < itemIds.length; i += 50) {
        const lote = itemIds.slice(i, i + 50).filter(id => /^\d+$/.test(id))
        if (!lote.length) continue
        const data = await mondayRequest(
            `{ items(ids: [${lote.join(',')}]) { id column_values(ids: ["${colunaId}"]) { text } } }`,
            undefined,
            MONDAY_PAGAMENTOS_API_TOKEN
        )
        for (const item of data?.items ?? []) {
            resultado.set(String(item.id), item.column_values?.[0]?.text ?? '')
        }
    }
    return resultado
}
