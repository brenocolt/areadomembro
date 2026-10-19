// Teste de autorização PONTA A PONTA: sobe `next dev` de verdade apontando para um
// "Supabase" falso (servidor HTTP local) e dispara requisições com cookies de
// sessão NextAuth reais (JWT assinado) para a página e todas as rotas de API.
// Não toca em nenhum banco real. Uso: npm run test:reconhecimentos:http
import { spawn } from 'node:child_process'
import http from 'node:http'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { encode } from 'next-auth/jwt'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SECRET = 'segredo-de-teste-nao-usar-em-producao'
const COOKIE = 'authjs.session-token'
const ANON = 'chave-anon-de-teste'
const SERVICE = 'chave-service-de-teste'
const PORT_NEXT = 3101
const PORT_DB = 3102
const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

// ------------------------------------------------------------ banco falso
const usuarios = {
    [U(1)]: { id: U(1), email: 'vp@pj.com', role: 'COLABORADOR', colaborador_id: U(11) },
    [U(2)]: { id: U(2), email: 'admin@pj.com', role: 'ADMIN', colaborador_id: null },
    [U(3)]: { id: U(3), email: 'diretora@pj.com', role: 'COLABORADOR', colaborador_id: U(13) },
    [U(4)]: { id: U(4), email: 'mkt@pj.com', role: 'COLABORADOR', colaborador_id: U(14) },
    [U(5)]: { id: U(5), email: 'vp-off@pj.com', role: 'COLABORADOR', colaborador_id: U(15) },
    [U(6)]: { id: U(6), email: 'ex-admin@pj.com', role: 'COLABORADOR', colaborador_id: U(14) },
    [U(7)]: { id: U(7), email: 'gp@pj.com', role: 'COLABORADOR', colaborador_id: U(17) },
}
const colaboradores = {
    [U(11)]: { id: U(11), nome: 'Vera VP', cargo_atual: 'Operacional', nucleo_atual: 'Vice Presidência', paginas_permitidas: [], status: 'Ativo' },
    [U(13)]: { id: U(13), nome: 'Dani Diretora', cargo_atual: 'Estratégico', nucleo_atual: 'Presidência', paginas_permitidas: ['/reconhecimentos'], status: 'Ativo' },
    [U(14)]: { id: U(14), nome: 'Marcos', cargo_atual: 'Tático', nucleo_atual: 'Marketing', paginas_permitidas: ['/reconhecimentos'], status: 'Ativo' },
    [U(15)]: { id: U(15), nome: 'Vic Off', cargo_atual: 'Operacional', nucleo_atual: 'Vice Presidência', paginas_permitidas: [], status: 'Desligado' },
    [U(17)]: { id: U(17), nome: 'Gabi GP', cargo_atual: 'Tático', nucleo_atual: 'Gestão de Pessoas', paginas_permitidas: [], status: 'Ativo' },
}
const TABELAS_DA_ABA = ['reconhecimento_tipos', 'regras_bonificacao', 'reconhecimentos', 'bonificacoes', 'bonificacao_eventos', 'bonificacoes_config', 'projetos']
let acessosAosDados = []
const dbFalso = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://x')
    const tabela = url.pathname.split('/').pop()
    const chave = req.headers.apikey
    let corpo = []
    const eq = (c) => url.searchParams.get(c)?.replace(/^eq\./, '')
    if (tabela === 'users' || tabela === 'colaboradores') {
        const fonte = tabela === 'users' ? usuarios : colaboradores
        const linha = fonte[eq('id')]
        corpo = linha ? [linha] : []
    } else if (TABELAS_DA_ABA.includes(tabela)) {
        acessosAosDados.push({ metodo: req.method, tabela, chave })
    }
    const unico = (req.headers.accept || '').includes('vnd.pgrst.object')
    res.setHeader('content-type', 'application/json')
    if (unico) {
        if (corpo.length !== 1) { res.statusCode = 406; res.end(JSON.stringify({ message: 'JSON object requested, multiple (or no) rows returned' })); return }
        res.end(JSON.stringify(corpo[0])); return
    }
    res.setHeader('content-range', `0-${Math.max(corpo.length - 1, 0)}/*`)
    res.end(JSON.stringify(corpo))
})

// ------------------------------------------------------------ next dev
async function subirNext(extraEnv) {
    const env = {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PORT_DB}`,
        NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON,
        AUTH_SECRET: SECRET,
        AUTH_TRUST_HOST: 'true',
        NEXT_TELEMETRY_DISABLED: '1',
        ...extraEnv,
    }
    if (!extraEnv.SUPABASE_SERVICE_ROLE_KEY) delete env.SUPABASE_SERVICE_ROLE_KEY
    const proc = spawn('npx', ['next', 'dev', '-p', String(PORT_NEXT)], { cwd: raiz, env, stdio: ['ignore', 'pipe', 'pipe'] })
    let log = ''
    proc.stdout.on('data', d => { log += d }); proc.stderr.on('data', d => { log += d })
    for (let i = 0; i < 120; i++) {
        try {
            const r = await fetch(`http://127.0.0.1:${PORT_NEXT}/login`, { redirect: 'manual' })
            if (r.status < 500) return { proc, log: () => log }
        } catch { /* ainda subindo */ }
        await new Promise(r => setTimeout(r, 1000))
    }
    proc.kill()
    throw new Error('next dev não subiu:\n' + log)
}
const parar = (proc) => new Promise(res => { proc.once('exit', res); proc.kill('SIGTERM'); setTimeout(() => proc.kill('SIGKILL'), 5000) })

const cookieDe = async (userId, extra = {}) => {
    const jwt = await encode({ token: { sub: userId, id: userId, role: usuarios[userId]?.role, colaborador_id: usuarios[userId]?.colaborador_id, ...extra }, secret: SECRET, salt: COOKIE })
    return `${COOKIE}=${jwt}`
}
const chamar = async (metodo, caminho, cookie, corpo) => {
    const r = await fetch(`http://127.0.0.1:${PORT_NEXT}${caminho}`, {
        method: metodo, redirect: 'manual',
        headers: { ...(cookie ? { cookie } : {}), ...(corpo ? { 'content-type': 'application/json' } : {}) },
        body: corpo ? JSON.stringify(corpo) : undefined,
    })
    return { status: r.status, location: r.headers.get('location'), texto: await r.text() }
}

const ID = U(99)
const ENDPOINTS = [
    ['GET', '/api/reconhecimentos'], ['POST', '/api/reconhecimentos', { tipo_id: ID, data: '2026-01-01', pessoa_nome: 'x' }],
    ['POST', '/api/reconhecimentos/sincronizar'], ['GET', '/api/reconhecimentos/projetos'],
    ['POST', '/api/reconhecimentos/ajustar-rgs', { projeto_id: ID, quantidade: 1 }], ['POST', '/api/reconhecimentos/tipos', { nome: 'x' }],
    ['POST', '/api/reconhecimentos/regras', { nome: 'x' }], ['PUT', `/api/reconhecimentos/regras/${ID}`, { nome: 'x' }],
    ['PUT', '/api/reconhecimentos/config', { prazo_padrao_dias: 5 }], ['DELETE', `/api/reconhecimentos/${ID}`],
    ['GET', `/api/reconhecimentos/bonificacoes/${ID}/eventos`], ['POST', `/api/reconhecimentos/bonificacoes/${ID}/entregar`, {}],
    ['POST', `/api/reconhecimentos/bonificacoes/${ID}/cancelar`, { motivo: 'Duplicidade' }],
]

const resultados = []
const caso = async (nome, fn) => {
    try { await fn(); resultados.push([true, nome]); console.log('  ok  ', nome) }
    catch (e) { resultados.push([false, nome]); console.log('  FALHA', nome, '\n       ', e.message.split('\n').join('\n        ')) }
}

await new Promise(r => dbFalso.listen(PORT_DB, '127.0.0.1', r))
let servidor
try {
    console.log('Subindo next dev (com SUPABASE_SERVICE_ROLE_KEY de teste)...')
    servidor = await subirNext({ SUPABASE_SERVICE_ROLE_KEY: SERVICE })

    await caso(`sem cookie: ${ENDPOINTS.length} endpoints -> 401, nenhum acesso a dados`, async () => {
        acessosAosDados = []
        for (const [m, p, c] of ENDPOINTS) assert.equal((await chamar(m, p, null, c)).status, 401, `${m} ${p}`)
        assert.equal(acessosAosDados.length, 0)
    })
    await caso('cookie adulterado / assinado com outro segredo -> 401', async () => {
        const falso = `${COOKIE}=${await encode({ token: { sub: U(1), id: U(1) }, secret: 'outro-segredo', salt: COOKIE })}`
        for (const c of [falso, `${COOKIE}=lixo`]) {
            assert.equal((await chamar('GET', '/api/reconhecimentos', c)).status, 401)
            const pagina = await chamar('GET', '/reconhecimentos', c)
            assert.ok([302, 307].includes(pagina.status) && /\/login/.test(pagina.location), `página: ${pagina.status} ${pagina.location}`)
        }
    })
    await caso('página sem login -> redireciona para /login', async () => {
        const r = await chamar('GET', '/reconhecimentos', null)
        assert.ok([302, 307].includes(r.status) && /\/login/.test(r.location), `${r.status} ${r.location}`)
    })

    const barrados = [
        ['Estratégico de outro núcleo com paginas_permitidas', U(3)],
        ['Tático de Marketing com paginas_permitidas', U(4)],
        ['Gestão de Pessoas', U(7)],
        ['VP desligado', U(5)],
    ]
    for (const [nome, id] of barrados) {
        await caso(`NÃO autorizado (${nome}): página redireciona p/ "/", ${ENDPOINTS.length} endpoints -> 403, nenhum acesso a dados`, async () => {
            const cookie = await cookieDe(id)
            acessosAosDados = []
            const pagina = await chamar('GET', '/reconhecimentos', cookie)
            assert.ok([302, 307].includes(pagina.status) && new URL(pagina.location, 'http://x').pathname === '/', `página: ${pagina.status} ${pagina.location}`)
            assert.ok(!pagina.texto.includes('Registrar reconhecimento'), 'conteúdo da aba vazou no corpo da resposta')
            for (const [m, p, c] of ENDPOINTS) assert.equal((await chamar(m, p, cookie, c)).status, 403, `${m} ${p}`)
            assert.equal(acessosAosDados.length, 0, 'tabelas da aba foram consultadas por usuário não autorizado')
        })
    }
    await caso('token diz ADMIN mas o banco diz COLABORADOR de Marketing -> 403 (vale o banco)', async () => {
        const cookie = await cookieDe(U(6), { role: 'ADMIN', colaborador_id: U(11) })
        assert.equal((await chamar('GET', '/api/reconhecimentos', cookie)).status, 403)
        const pagina = await chamar('GET', '/reconhecimentos', cookie)
        assert.ok([302, 307].includes(pagina.status) && new URL(pagina.location, 'http://x').pathname === '/')
    })
    await caso('usuário inexistente no banco (sessão órfã) -> 401', async () => {
        const cookie = await cookieDe(U(1), { sub: U(50), id: U(50) })
        assert.equal((await chamar('GET', '/api/reconhecimentos', cookie)).status, 401)
    })

    for (const [nome, id] of [['VP (Operacional)', U(1)], ['ADMIN', U(2)]]) {
        await caso(`AUTORIZADO (${nome}): página 200 com a aba; API responde e os dados saem pela service role`, async () => {
            const cookie = await cookieDe(id)
            const pagina = await chamar('GET', '/reconhecimentos', cookie)
            assert.equal(pagina.status, 200, `página: ${pagina.status} ${pagina.location ?? ''}`)
            assert.ok(pagina.texto.includes('Reconhecimentos e Bonificações'))
            acessosAosDados = []
            const dados = await chamar('GET', '/api/reconhecimentos', cookie)
            assert.equal(dados.status, 200, dados.texto)
            assert.deepEqual(Object.keys(JSON.parse(dados.texto)).sort(), ['bonificacoes', 'config', 'regras', 'reconhecimentos', 'tipos'])
            assert.ok(acessosAosDados.length >= 5)
            assert.ok(acessosAosDados.every(a => a.chave === SERVICE), 'dados da aba devem ser lidos só com a service role')
            // validação de entrada acontece depois da autorização
            const ruim = await chamar('POST', '/api/reconhecimentos', cookie, { data: 'x' })
            assert.equal(ruim.status, 400); assert.match(JSON.parse(ruim.texto).error, /tipo de reconhecimento/)
            assert.equal((await chamar('DELETE', '/api/reconhecimentos/nao-e-uuid', cookie)).status, 400)
        })
    }
    await caso('menu: item aparece só para quem tem acesso (lógica compartilhada com a sidebar)', async () => {
        const { paginaPermitida } = await import('../../src/lib/access-control.ts')
        assert.ok(paginaPermitida('/reconhecimentos', colaboradores[U(11)], 'COLABORADOR'))
        assert.ok(!paginaPermitida('/reconhecimentos', colaboradores[U(13)], 'COLABORADOR'))
    }).catch(() => undefined)

    await parar(servidor.proc)

    console.log('Subindo next dev SEM SUPABASE_SERVICE_ROLE_KEY...')
    servidor = await subirNext({})
    await caso('sem SUPABASE_SERVICE_ROLE_KEY: VP recebe 503 "configuração pendente"; não autorizado continua 403', async () => {
        acessosAosDados = []
        const r = await chamar('GET', '/api/reconhecimentos', await cookieDe(U(1)))
        assert.equal(r.status, 503); assert.equal(JSON.parse(r.texto).configuracaoPendente, true)
        assert.ok(!r.texto.includes(SERVICE))
        assert.equal(acessosAosDados.length, 0, 'sem a chave, nada deve cair no fallback da chave anon')
        assert.equal((await chamar('GET', '/api/reconhecimentos', await cookieDe(U(3)))).status, 403)
    })
} finally {
    if (servidor) await parar(servidor.proc).catch(() => undefined)
    dbFalso.close()
}
const falhas = resultados.filter(([ok]) => !ok).length
console.log(`\n${resultados.length - falhas}/${resultados.length} casos OK`)
process.exit(falhas ? 1 : 0)
