// Cliente Supabase falso, em memória, com só o que a reversão de saque usa (select/update/insert/delete + eq/is).
export function criarBanco(tabelas) {
    const log = []
    const falhas = new Set()          // 'tabela.acao' que devem falhar
    const ganchos = { aposLeitura: null } // ganchos para simular concorrência

    const cliente = {
        from(nome) {
            const estado = { acao: 'select', filtros: [], corpo: null, retorna: false, unico: false }
            const executar = async () => {
                const chave = `${nome}.${estado.acao}`
                if (falhas.has(chave)) return { data: null, error: { message: `falha simulada em ${chave}` } }
                const linhas = tabelas[nome]
                const casa = (l) => estado.filtros.every(f => (f.tipo === 'is' ? (l[f.col] ?? null) === f.val : l[f.col] === f.val))
                log.push(chave)
                if (estado.acao === 'select') {
                    const achadas = linhas.filter(casa).map(l => ({ ...l }))
                    if (ganchos.aposLeitura) await ganchos.aposLeitura(nome, achadas)
                    return estado.unico ? { data: achadas[0] ?? null, error: null } : { data: achadas, error: null }
                }
                if (estado.acao === 'update') {
                    const alvo = linhas.filter(casa)
                    alvo.forEach(l => Object.assign(l, estado.corpo))
                    return { data: estado.retorna ? alvo.map(l => ({ ...l })) : null, error: null }
                }
                if (estado.acao === 'insert') {
                    const nova = { id: `${nome}-${linhas.length + 1}`, ...estado.corpo }
                    linhas.push(nova)
                    return { data: estado.unico ? { ...nova } : [{ ...nova }], error: null }
                }
                const restantes = linhas.filter(l => !casa(l))
                const removidas = linhas.length - restantes.length
                tabelas[nome] = restantes
                return { data: null, error: null, removidas }
            }
            const b = {
                select() { if (estado.acao === 'select') estado.acao = 'select'; else estado.retorna = true; return b },
                update(corpo) { estado.acao = 'update'; estado.corpo = corpo; return b },
                insert(corpo) { estado.acao = 'insert'; estado.corpo = corpo; return b },
                delete() { estado.acao = 'delete'; return b },
                eq(col, val) { estado.filtros.push({ tipo: 'eq', col, val }); return b },
                is(col, val) { estado.filtros.push({ tipo: 'is', col, val }); return b },
                maybeSingle() { estado.unico = true; return b },
                single() { estado.unico = true; return b },
                then(ok, err) { return executar().then(ok, err) },
            }
            return b
        },
    }
    return { db: cliente, tabelas, log, falhas, ganchos }
}
