// Tolerância a migração ainda não aplicada.
//
// O PostgREST recusa a REQUISIÇÃO INTEIRA quando qualquer parte dela cita
// algo que não existe no schema — uma coluna nova, uma tabela nova, ou uma
// relação que ainda não entrou no cache de schema logo depois de a migração
// rodar. Uma única coluna nova em um `select` derruba a leitura toda, e o
// resultado chega ao componente como `data: null`: da tela, isso é
// indistinguível de "não existe nenhum registro".
//
// Foi exatamente assim que a Gestão de Formulários apareceu vazia com todos
// os formulários intactos no banco, e que o histórico do NPS Interno sumiu
// da aba de Performance.
//
// Regra geral onde o código cita algo criado por migração recente: tentar
// com o campo novo e, SÓ neste tipo de erro, repetir sem ele. Assim a tela
// funciona antes e depois da migração, e um erro de verdade (permissão,
// rede, constraint) continua aparecendo normalmente.
export interface ErroPostgrest {
    code?: string
    message?: string
    details?: string
    hint?: string
}

const CODIGOS_SCHEMA_AUSENTE = new Set([
    '42703',    // undefined_column
    '42P01',    // undefined_table
    'PGRST200', // não encontrou relação entre as tabelas (embed)
    'PGRST204', // coluna não encontrada no cache de schema
    'PGRST205', // tabela não encontrada no cache de schema
])

export function isSchemaDesatualizado(error: ErroPostgrest | null | undefined): boolean {
    if (!error) return false
    if (error.code && CODIGOS_SCHEMA_AUSENTE.has(error.code)) return true
    const msg = `${error.message || ''} ${error.details || ''}`.toLowerCase()
    return msg.includes('does not exist')
        || msg.includes('could not find a relationship')
        || msg.includes('schema cache')
}

// Cópia do payload sem as colunas informadas — usada para repetir uma
// gravação que o banco recusou por ainda não ter as colunas novas.
export function semColunas<T extends Record<string, unknown>>(payload: T, colunas: string[]): Partial<T> {
    const copia: Record<string, unknown> = { ...payload }
    for (const coluna of colunas) delete copia[coluna]
    return copia as Partial<T>
}
