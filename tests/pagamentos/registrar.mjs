// Permite importar os .ts de src/lib que usam import relativo sem extensão
// (estilo do Next), rodando com --experimental-strip-types.
import { register } from 'node:module'
register('data:text/javascript,' + encodeURIComponent(`
export async function resolve(especificador, contexto, proximo) {
    try { return await proximo(especificador, contexto) }
    catch (e) {
        if (especificador.startsWith('.') && !/\\.[mc]?[jt]s$/.test(especificador)) return proximo(especificador + '.ts', contexto)
        throw e
    }
}`), import.meta.url)
