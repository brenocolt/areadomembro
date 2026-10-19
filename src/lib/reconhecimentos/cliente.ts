// Cliente das rotas /api/reconhecimentos/* (NAVEGADOR). Não acessa o banco:
// toda leitura/gravação passa pelo servidor, que valida sessão e VP/ADMIN.
export class ErroApi extends Error {
    status: number
    configuracaoPendente: boolean
    constructor(mensagem: string, status: number, configuracaoPendente = false) {
        super(mensagem)
        this.name = 'ErroApi'
        this.status = status
        this.configuracaoPendente = configuracaoPendente
    }
}

export async function api<T = unknown>(url: string, metodo: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET', corpo?: unknown): Promise<T> {
    const res = await fetch(url, {
        method: metodo,
        headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
        cache: 'no-store',
    })
    const json = await res.json().catch(() => null)
    if (!res.ok) {
        throw new ErroApi(json?.error || 'Erro ao comunicar com o servidor', res.status, !!json?.configuracaoPendente)
    }
    return json as T
}

export const mensagemDeErro = (e: unknown, padrao: string) => (e instanceof Error && e.message ? e.message : padrao)
