// fetch para as rotas /api/gasolina/* — devolve o JSON ou lança Error com a
// mensagem que a rota mandou (para ir direto no toast).
export async function gasolinaApi<T>(url: string, init?: RequestInit): Promise<T> {
    const res = await fetch(url, {
        ...init,
        headers: init?.body ? { 'Content-Type': 'application/json', ...init?.headers } : init?.headers,
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(json.error || 'Algo deu errado. Tente de novo.')
    return json as T
}
