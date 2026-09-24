// A API do Supabase devolve no máximo 1000 linhas por consulta (limite
// padrão) e corta o resto SEM erro. Para leituras que crescem mês a mês
// (ex.: todas as respostas de um tipo de formulário), busca em páginas até
// acabar. `consulta` recebe o intervalo e aplica `.range(de, ate)` numa
// consulta com ordem estável — ex.: `.order('enviado_em').order('id')` —,
// senão uma linha pode cair em duas páginas ou em nenhuma.
export const TAMANHO_PAGINA = 1000

export async function buscarTodasPaginas<T, E = unknown>(
    consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: E | null }>,
): Promise<{ data: T[]; error: E | null }> {
    const todas: T[] = []
    for (let de = 0; ; de += TAMANHO_PAGINA) {
        const { data, error } = await consulta(de, de + TAMANHO_PAGINA - 1)
        if (error) return { data: todas, error }
        todas.push(...(data || []))
        if (!data || data.length < TAMANHO_PAGINA) return { data: todas, error: null }
    }
}
