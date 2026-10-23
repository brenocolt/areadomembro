// Hook de resolução para rodar os módulos TypeScript puros direto no Node
// (--experimental-strip-types): resolve o alias "@/" e imports sem extensão.
// Node >= 22.15. Uso: node --experimental-strip-types --import ./tests/reconhecimentos/loader.mjs ...
import { registerHooks } from 'node:module'
import { existsSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import path from 'node:path'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const arquivo = (p) => existsSync(p) && statSync(p).isFile()

registerHooks({
    resolve(specifier, context, next) {
        // Só mexe em imports do próprio projeto (nunca em pacotes de terceiros/CJS).
        const pai = context.parentURL
        if (pai && (!pai.startsWith(pathToFileURL(raiz).href) || pai.includes('/node_modules/'))) return next(specifier, context)
        let base
        if (specifier.startsWith('@/')) base = path.join(raiz, 'src', specifier.slice(2))
        else if ((specifier.startsWith('./') || specifier.startsWith('../')) && context.parentURL?.startsWith('file:')) {
            base = fileURLToPath(new URL(specifier, context.parentURL))
        } else return next(specifier, context)
        for (const candidato of [base, `${base}.ts`, path.join(base, 'index.ts')]) {
            if (arquivo(candidato)) return next(pathToFileURL(candidato).href, context)
        }
        return next(specifier, context)
    },
})
