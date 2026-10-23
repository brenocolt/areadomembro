// Emulador mínimo de PostgREST sobre PGlite (PostgreSQL real em memória). Fala o MESMO protocolo HTTP que o
// supabase-js usa contra o Supabase: filtros por querystring, Prefer (return/resolution/count), Accept de
// objeto único, papéis (anon × service_role) e a GUC request.headers que os triggers de auditoria leem.
// Cobre só o subconjunto que a aba usa. Nenhum banco real é tocado.
import http from 'node:http'

const q = (ident) => `"${String(ident).replace(/"/g, '""')}"`
const RESERVADOS = new Set(['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'])
const OID_DATE = 1082, OID_TIMESTAMPTZ = 1184, OID_NUMERIC = 1700, OID_INT8 = 20

function parseLista(v) {
    // (a,b,"c d")
    const interno = v.replace(/^\(/, '').replace(/\)$/, '')
    const itens = []; let atual = '', aspas = false
    for (const ch of interno) {
        if (ch === '"') aspas = !aspas
        else if (ch === ',' && !aspas) { itens.push(atual); atual = '' }
        else atual += ch
    }
    itens.push(atual)
    return itens
}

function construirWhere(params, valores) {
    const partes = []
    for (const [k, v] of params) {
        if (RESERVADOS.has(k)) continue
        const m = /^(not\.)?(eq|neq|gt|gte|lt|lte|is|in|like|ilike)\.(.*)$/.exec(v)
        if (!m) throw Object.assign(new Error(`filtro não suportado: ${k}=${v}`), { status: 400 })
        const [, nao, op, val] = m
        const col = q(k)
        let sql
        if (op === 'is') sql = val === 'null' ? `${col} IS NULL` : `${col} IS ${val.toUpperCase()}`
        else if (op === 'in') {
            const itens = parseLista(val)
            valores.push(...itens)
            sql = `${col} IN (${itens.map((_, i) => `$${valores.length - itens.length + i + 1}`).join(',')})`
        } else {
            valores.push(val)
            const sinal = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'LIKE', ilike: 'ILIKE' }[op]
            sql = `${col} ${sinal} $${valores.length}`
        }
        partes.push(nao ? `NOT (${sql})` : sql)
    }
    return partes.length ? ` WHERE ${partes.join(' AND ')}` : ''
}

function construirOrder(params) {
    const o = params.get('order')
    if (!o) return ''
    return ' ORDER BY ' + o.split(',').map(t => {
        const [col, ...mods] = t.split('.')
        return `${q(col)} ${mods.includes('desc') ? 'DESC' : 'ASC'}${mods.includes('nullsfirst') ? ' NULLS FIRST' : mods.includes('nullslast') ? ' NULLS LAST' : ''}`
    }).join(', ')
}

function colunasSelect(sel) {
    if (!sel || sel === '*') return '*'
    if (/[()]/.test(sel)) throw Object.assign(new Error('embedding não suportado pelo emulador'), { status: 400 })
    return sel.split(',').map(c => q(c.trim())).join(', ')
}

function serializar(resultado) {
    const tipos = Object.fromEntries((resultado.fields || []).map(f => [f.name, f.dataTypeID]))
    return resultado.rows.map(r => {
        const o = {}
        for (const [k, v] of Object.entries(r)) {
            if (v instanceof Date) o[k] = tipos[k] === OID_DATE ? v.toISOString().slice(0, 10) : v.toISOString()
            else if ((tipos[k] === OID_NUMERIC || tipos[k] === OID_INT8) && v !== null) o[k] = Number(v)
            else if (typeof v === 'bigint') o[k] = Number(v)
            else o[k] = v
        }
        return o
    })
}

/**
 * @param {{ pg: import('@electric-sql/pglite').PGlite, porta: number, chaveServico: string, chaveAnon?: string }} cfg
 */
export function iniciarEmulador({ pg, porta, chaveServico, chaveAnon = 'anon-key-de-teste' }) {
    let fila = Promise.resolve()
    const serializado = (fn) => { const p = fila.then(fn, fn); fila = p.catch(() => undefined); return p }
    const registro = { requisicoes: [] }

    async function tratar(req, corpoBruto) {
        const url = new URL(req.url, 'http://x')
        const m = /^\/rest\/v1\/([a-z_]+)$/.exec(url.pathname)
        if (!m) throw Object.assign(new Error('rota não encontrada'), { status: 404 })
        const tabela = m[1]
        const prefer = req.headers.prefer || ''
        const representacao = prefer.includes('return=representation')
        const objetoUnico = (req.headers.accept || '').includes('vnd.pgrst.object+json')
        const chave = req.headers.apikey
        const papel = chave === chaveServico ? 'service_role' : 'anon'
        registro.requisicoes.push({ metodo: req.method, tabela, papel })
        const valores = []
        let sql, resposta = { status: 200, corpo: null, headers: {} }

        const executar = async () => {
            await pg.exec('BEGIN')
            try {
                await pg.query(`select set_config('request.headers', $1, true)`, [JSON.stringify(req.headers)])
                await pg.exec(`SET LOCAL ROLE ${papel}`)
                const corpo = corpoBruto ? JSON.parse(corpoBruto) : null
                let r
                if (req.method === 'GET' || req.method === 'HEAD') {
                    const where = construirWhere(url.searchParams, valores)
                    const base = `FROM ${q(tabela)}${where}`
                    const contar = prefer.includes('count=exact')
                    let total = null
                    if (contar) total = Number((await pg.query(`SELECT count(*)::int n ${base}`, valores)).rows[0].n)
                    if (req.method === 'HEAD') { resposta.headers['content-range'] = `*/${total ?? 0}`; resposta.status = 200; return }
                    sql = `SELECT ${colunasSelect(url.searchParams.get('select'))} ${base}${construirOrder(url.searchParams)}`
                    if (url.searchParams.get('limit')) sql += ` LIMIT ${Number(url.searchParams.get('limit'))}`
                    if (url.searchParams.get('offset')) sql += ` OFFSET ${Number(url.searchParams.get('offset'))}`
                    r = await pg.query(sql, valores)
                    const linhas = serializar(r)
                    if (total !== null) resposta.headers['content-range'] = `0-${Math.max(linhas.length - 1, 0)}/${total}`
                    resposta.corpo = linhas
                } else if (req.method === 'POST') {
                    const linhas = Array.isArray(corpo) ? corpo : [corpo]
                    const colunas = [...new Set(linhas.flatMap(l => Object.keys(l)))]
                    const conflito = url.searchParams.get('on_conflict')
                    let tail = ''
                    if (prefer.includes('resolution=ignore-duplicates')) tail = ` ON CONFLICT ${conflito ? `(${conflito.split(',').map(q).join(',')})` : ''} DO NOTHING`
                    else if (prefer.includes('resolution=merge-duplicates')) tail = ` ON CONFLICT (${conflito.split(',').map(q).join(',')}) DO UPDATE SET ${colunas.filter(c => !conflito.split(',').includes(c)).map(c => `${q(c)} = EXCLUDED.${q(c)}`).join(', ')}`
                    const tuplas = linhas.map(l => `(${colunas.map(c => {
                        if (!(c in l)) return 'DEFAULT'
                        valores.push(typeof l[c] === 'object' && l[c] !== null ? JSON.stringify(l[c]) : l[c])
                        return `$${valores.length}`
                    }).join(',')})`)
                    sql = `INSERT INTO ${q(tabela)} (${colunas.map(q).join(',')}) VALUES ${tuplas.join(',')}${tail} RETURNING *`
                    r = await pg.query(sql, valores)
                    resposta.status = 201
                    if (representacao) resposta.corpo = serializar(r)
                } else if (req.method === 'PATCH') {
                    const sets = Object.entries(corpo).map(([c, v]) => { valores.push(typeof v === 'object' && v !== null ? JSON.stringify(v) : v); return `${q(c)} = $${valores.length}` })
                    const where = construirWhere(url.searchParams, valores)
                    sql = `UPDATE ${q(tabela)} SET ${sets.join(', ')}${where} RETURNING *`
                    r = await pg.query(sql, valores)
                    if (representacao) resposta.corpo = serializar(r); else resposta.status = 204
                } else if (req.method === 'DELETE') {
                    const where = construirWhere(url.searchParams, valores)
                    r = await pg.query(`DELETE FROM ${q(tabela)}${where} RETURNING *`, valores)
                    if (representacao) resposta.corpo = serializar(r); else resposta.status = 204
                } else throw Object.assign(new Error('método não suportado'), { status: 405 })
                await pg.exec('COMMIT')
            } catch (e) {
                await pg.exec('ROLLBACK').catch(() => undefined)
                throw e
            }
        }
        await executar()
        if (objetoUnico && Array.isArray(resposta.corpo)) {
            if (resposta.corpo.length !== 1) throw Object.assign(new Error('JSON object requested, multiple (or no) rows returned'), { status: 406, code: 'PGRST116' })
            resposta.corpo = resposta.corpo[0]
        }
        return resposta
    }

    const server = http.createServer((req, res) => {
        // CORS: o navegador do portal também fala com o Supabase (menu, outras telas) usando a chave anon.
        res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-headers', '*')
        res.setHeader('access-control-allow-methods', '*'); res.setHeader('access-control-expose-headers', '*')
        if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }
        let corpo = ''
        req.on('data', d => { corpo += d })
        req.on('end', () => {
            serializado(() => tratar(req, corpo)).then(
                ({ status, corpo: dados, headers }) => {
                    res.writeHead(status, { 'content-type': 'application/json', ...headers })
                    res.end(dados === null ? '' : JSON.stringify(dados))
                },
                (e) => {
                    const pgCodigo = e.code && /^[0-9A-Z]{5}$/.test(e.code) ? e.code : null
                    const status = e.status ?? ({ '23505': 409, '23503': 409, '23514': 400, '23502': 400, '42501': papelNegado(req) }[pgCodigo] ?? 400)
                    res.writeHead(status, { 'content-type': 'application/json' })
                    res.end(JSON.stringify({ code: e.code ?? 'PGRST000', message: e.message, details: e.detail ?? null, hint: null }))
                },
            )
        })
    })
    const papelNegado = (req) => (req.headers.apikey === chaveServico ? 403 : 401)
    return new Promise(resolve => server.listen(porta, '127.0.0.1', () => resolve({
        url: `http://127.0.0.1:${server.address().port}`,
        chaveServico, chaveAnon, registro,
        fechar: () => new Promise(r => server.close(r)),
    })))
}
