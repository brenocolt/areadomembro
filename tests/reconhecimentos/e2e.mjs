// Teste PONTA A PONTA da aba Reconhecimentos e Bonificações: sobe `next dev` apontando para um PostgreSQL real
// em memória (PGlite) exposto por um emulador de PostgREST, com a migration REAL aplicada. Percorre:
//   A) autorização (HTTP, cookies de sessão NextAuth reais): quem pode / quem não pode, página e API;
//   B) a aba como VP no navegador (Playwright): RG com sugestão de número, bonificação, entrega por colaborador,
//      edição com histórico, filtros, e a ausência de acesso para quem não é VP.
// Nenhum banco real é tocado. Requer Playwright + Chromium (PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright).
// Uso: node --experimental-strip-types --import ./tests/reconhecimentos/loader.mjs tests/reconhecimentos/e2e.mjs
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { encode } from 'next-auth/jwt'
import { bancoComMigration } from './pg-base.mjs'
import { iniciarEmulador } from './postgrest-pglite.mjs'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const SECRET = 'segredo-de-teste-nao-usar-em-producao', COOKIE = 'authjs.session-token'
const SERVICE = 'chave-service-de-teste', ANON = 'chave-anon-de-teste'
const PORT_NEXT = 3121
const SAIDA = process.env.SAIDA_DIR || '/tmp'
const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

// ---------------------------------------------------------------- banco + dados
const pg = await bancoComMigration()
const emu = await iniciarEmulador({ pg, porta: 0, chaveServico: SERVICE, chaveAnon: ANON })
process.env.NEXT_PUBLIC_SUPABASE_URL = emu.url
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE
const svc = await import('../../src/lib/reconhecimentos/servico.ts')
const { createAdminSupabaseClient } = await import('../../src/lib/supabase-admin.ts')
const { hojeISO, formatarData } = await import('../../src/lib/reconhecimentos/datas.ts')

const colab = [
    [11, 'Vera da VP', 'Vice Presidência', 'Operacional', 'Ativo', '{}'],
    [13, 'Dani Diretora', 'Presidência', 'Estratégico', 'Ativo', '{/reconhecimentos}'],
    [14, 'Marcos de Marketing', 'Marketing', 'Tático', 'Ativo', '{/reconhecimentos}'],
    [15, 'Vic Desligada', 'Vice Presidência', 'Operacional', 'Desligado', '{}'],
    [17, 'Gabi de GP', 'Gestão de Pessoas', 'Tático', 'Ativo', '{}'],
    [21, 'João Silva', 'Marketing', 'Operacional', 'Ativo', '{}'],
    [22, 'Maria Souza', 'Comercial', 'Operacional', 'Ativo', '{}'],
    [23, 'Pedro Lima', 'Marketing', 'Operacional', 'Ativo', '{}'],
]
for (const [n, nome, nucleo, cargo, status, paginas] of colab)
    await pg.query(`insert into colaboradores(id, nome, email_corporativo, nucleo_atual, cargo_atual, status, paginas_permitidas) values ($1,$2,$3,$4,$5,$6,$7)`, [U(n), nome, `c${n}@pj.com`, nucleo, cargo, status, paginas])
const usuarios = { vp: [1, 'vp@pj.com', 'COLABORADOR', 11], admin: [2, 'admin@pj.com', 'ADMIN', null], diretora: [3, 'diretora@pj.com', 'COLABORADOR', 13], mkt: [4, 'mkt@pj.com', 'COLABORADOR', 14], vpOff: [5, 'vpoff@pj.com', 'COLABORADOR', 15], gp: [7, 'gp@pj.com', 'COLABORADOR', 17] }
for (const [n, email, role, c] of Object.values(usuarios)) await pg.query(`insert into users(id, email, role, colaborador_id) values ($1,$2,$3,$4)`, [U(n), email, role, c ? U(c) : null])
const ID = (chave) => U(usuarios[chave][0])
const roleDe = (chave) => usuarios[chave][2]
const colabDe = (chave) => (usuarios[chave][3] ? U(usuarios[chave][3]) : null)
const projeto = randomUUID()
await pg.query(`insert into projetos(id, nome, status) values ($1,'Prorestaure','Ativo'), ($2,'Aries Engenharia','Ativo'), ($3,'Projeto Antigo','Concluído')`, [projeto, randomUUID(), randomUUID()])

// 1ª a 4ª RG da Prorestaure já existem (registradas antes de qualquer regra).
const VP = { id: ID('vp'), email: 'vp@pj.com', nome: 'Vera da VP' }
const db = createAdminSupabaseClient({ id: VP.id, email: VP.email })
const tipoRg = (await pg.query(`select id from reconhecimento_tipos where nome = 'RG / Projeto Reconhecido'`)).rows[0].id
const HOJE = hojeISO()
for (const n of [1, 2, 3, 4]) await svc.criarReconhecimento(db, VP, { tipo_id: tipoRg, projeto_id: projeto, numero_rg: n, data_reconhecimento: HOJE })

// ---------------------------------------------------------------- next dev
const matar = (proc, sinal = 'SIGTERM') => { try { process.kill(-proc.pid, sinal) } catch { /* já encerrou */ } }
const parar = (proc) => new Promise(res => { proc.once('exit', () => setTimeout(res, 500)); matar(proc); setTimeout(() => matar(proc, 'SIGKILL'), 5000) })
async function subirNext() {
    const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: emu.url, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON, SUPABASE_SERVICE_ROLE_KEY: SERVICE, AUTH_SECRET: SECRET, AUTH_TRUST_HOST: 'true', NEXT_TELEMETRY_DISABLED: '1' }
    const proc = spawn(process.execPath, [path.join(raiz, 'node_modules/next/dist/bin/next'), 'dev', '-p', String(PORT_NEXT)], { cwd: raiz, env, stdio: ['ignore', 'pipe', 'pipe'], detached: true })
    let log = ''
    proc.stdout.on('data', d => { log += d }); proc.stderr.on('data', d => { log += d })
    if (await fetch(`http://127.0.0.1:${PORT_NEXT}/login`, { redirect: 'manual' }).then(() => true, () => false)) { matar(proc); throw new Error(`porta ${PORT_NEXT} em uso`) }
    for (let i = 0; i < 180; i++) {
        try { if ((await fetch(`http://127.0.0.1:${PORT_NEXT}/login`, { redirect: 'manual' })).status < 500) return { proc, log: () => log } } catch { /* subindo */ }
        await new Promise(r => setTimeout(r, 1000))
    }
    matar(proc); throw new Error('next dev não subiu:\n' + log)
}
const cookieDe = async (chave, extra = {}) => `${COOKIE}=${await encode({ token: { sub: ID(chave), id: ID(chave), role: roleDe(chave), colaborador_id: colabDe(chave), ...extra }, secret: SECRET, salt: COOKIE })}`
const chamar = async (metodo, caminho, cookie, corpo) => {
    const r = await fetch(`http://127.0.0.1:${PORT_NEXT}${caminho}`, { method: metodo, redirect: 'manual', headers: { ...(cookie ? { cookie } : {}), ...(corpo ? { 'content-type': 'application/json' } : {}) }, body: corpo ? JSON.stringify(corpo) : undefined })
    return { status: r.status, location: r.headers.get('location'), texto: await r.text() }
}
const redirecionaParaInicio = (r) => ([302, 307].includes(r.status) && new URL(r.location, 'http://x').pathname === '/') || /NEXT_REDIRECT;replace;\/;307/.test(r.texto)
const carregaAAba = (r) => r.texto.includes('reconhecimentos-page') || r.texto.includes('Registrar reconhecimento')

const resultados = []
const caso = async (nome, fn) => {
    try { await fn(); resultados.push([true, nome]); console.log('  ok   ', nome) }
    catch (e) { resultados.push([false, nome]); console.log('  FALHA', nome, '\n       ', String(e.stack || e.message).split('\n').slice(0, 14).join('\n        ')) }
}
const aguardar = async (fn, descricao, ms = 15000) => {
    const limite = Date.now() + ms
    for (;;) { const v = await fn(); if (v) return v; if (Date.now() > limite) throw new Error(`tempo esgotado: ${descricao}`); await new Promise(r => setTimeout(r, 150)) }
}
const contar = async (sql, params = []) => Number((await pg.query(`select count(*)::int n from (${sql}) t`, params)).rows[0].n)

const ID_X = U(99)
const ENDPOINTS = [
    ['GET', '/api/reconhecimentos'], ['POST', '/api/reconhecimentos', { tipo_id: tipoRg, data_reconhecimento: HOJE, projeto_id: projeto, numero_rg: 50 }],
    ['PUT', `/api/reconhecimentos/${ID_X}`, { data_reconhecimento: HOJE }], ['POST', `/api/reconhecimentos/${ID_X}/excluir`, { motivo: 'teste' }],
    ['POST', '/api/reconhecimentos/sincronizar'], ['GET', '/api/reconhecimentos/projetos'], ['GET', '/api/reconhecimentos/colaboradores'],
    ['GET', `/api/reconhecimentos/proximo-rg?projeto_id=${projeto}`], ['GET', '/api/reconhecimentos/historico'],
    ['POST', '/api/reconhecimentos/tipos', { nome: 'x' }], ['PUT', `/api/reconhecimentos/tipos/${ID_X}`, { ativo: false }], ['PUT', '/api/reconhecimentos/nucleos', { nucleo: 'Marketing', elegivel: false }],
    ['POST', '/api/reconhecimentos/regras', { nome: 'x' }], ['PUT', `/api/reconhecimentos/regras/${ID_X}`, { nome: 'x' }],
    ['GET', `/api/reconhecimentos/regras/${ID_X}/retroativo`], ['POST', `/api/reconhecimentos/regras/${ID_X}/retroativo`],
    ['GET', `/api/reconhecimentos/bonificacoes/${ID_X}`], ['POST', `/api/reconhecimentos/bonificacoes/${ID_X}/entregas`, { colaborador_ids: [U(21)] }],
    ['PUT', `/api/reconhecimentos/bonificacoes/${ID_X}/entregas/${ID_X}`, { situacao: 'entregue' }],
    ['POST', `/api/reconhecimentos/bonificacoes/${ID_X}/concluir`], ['POST', `/api/reconhecimentos/bonificacoes/${ID_X}/cancelar`, { justificativa: 'teste' }],
]

let servidor, browser
try {
    console.log('Subindo next dev...')
    servidor = await subirNext()

    // =============================================================== A) autorização
    console.log('\nA) Autorização')
    const escritasAntes = async () => (await contar(`select 1 from reconhecimentos`)) + (await contar(`select 1 from reconhecimento_historico`))
    await caso(`sem cookie: ${ENDPOINTS.length} endpoints -> 401 e nenhuma requisição aos dados da aba`, async () => {
        const antes = emu.registro.requisicoes.length
        for (const [m, p, c] of ENDPOINTS) assert.equal((await chamar(m, p, null, c)).status, 401, `${m} ${p}`)
        assert.equal(emu.registro.requisicoes.length, antes, 'houve acesso ao banco sem sessão')
    })
    await caso('cookie assinado com outro segredo / lixo -> 401; página -> /login', async () => {
        const falso = `${COOKIE}=${await encode({ token: { sub: ID('vp'), id: ID('vp') }, secret: 'outro', salt: COOKIE })}`
        for (const c of [falso, `${COOKIE}=lixo`]) {
            assert.equal((await chamar('GET', '/api/reconhecimentos', c)).status, 401)
            const pagina = await chamar('GET', '/reconhecimentos', c)
            assert.ok([302, 307].includes(pagina.status) && /\/login/.test(pagina.location), `${pagina.status} ${pagina.location}`)
        }
    })
    for (const [nome, chave] of [['Estratégico de outro núcleo com paginas_permitidas', 'diretora'], ['Tático de Marketing com paginas_permitidas', 'mkt'], ['Gestão de Pessoas', 'gp'], ['VP desligado', 'vpOff']]) {
        await caso(`NÃO autorizado (${nome}): página sem a aba, ${ENDPOINTS.length} endpoints -> 403, nada lido/gravado`, async () => {
            const cookie = await cookieDe(chave)
            const reqAntes = emu.registro.requisicoes.filter(r => r.papel === 'service_role').length
            const gravacoes = await escritasAntes()
            const pagina = await chamar('GET', '/reconhecimentos', cookie)
            assert.ok(redirecionaParaInicio(pagina), `não redirecionou: ${pagina.status} ${pagina.location}`)
            assert.ok(!carregaAAba(pagina), 'o componente da aba foi enviado ao não autorizado')
            for (const [m, p, c] of ENDPOINTS) assert.equal((await chamar(m, p, cookie, c)).status, 403, `${m} ${p}`)
            assert.equal(emu.registro.requisicoes.filter(r => r.papel === 'service_role').length, reqAntes, 'service role foi usada para não autorizado')
            assert.equal(await escritasAntes(), gravacoes)
        })
    }
    await caso('token diz ADMIN mas o banco diz COLABORADOR de Marketing -> 403 (vale o banco)', async () => {
        const cookie = await cookieDe('mkt', { role: 'ADMIN', colaborador_id: U(11) })
        assert.equal((await chamar('GET', '/api/reconhecimentos', cookie)).status, 403)
        assert.ok(redirecionaParaInicio(await chamar('GET', '/reconhecimentos', cookie)))
    })
    await caso('sessão órfã (usuário inexistente) -> 401', async () => {
        assert.equal((await chamar('GET', '/api/reconhecimentos', await cookieDe('vp', { sub: U(50), id: U(50) }))).status, 401)
    })
    for (const [nome, chave] of [['VP ativo', 'vp'], ['ADMIN', 'admin']]) {
        await caso(`AUTORIZADO (${nome}): página entrega a aba e a API responde pela service role`, async () => {
            const cookie = await cookieDe(chave)
            const pagina = await chamar('GET', '/reconhecimentos', cookie)
            assert.equal(pagina.status, 200)
            assert.ok(carregaAAba(pagina) && !redirecionaParaInicio(pagina))
            const dados = await chamar('GET', '/api/reconhecimentos', cookie)
            assert.equal(dados.status, 200, dados.texto)
            assert.deepEqual(Object.keys(JSON.parse(dados.texto)).sort(), ['bonificacoes', 'entregas', 'nucleos', 'reconhecimentos', 'regras', 'tipos'])
            const ruim = await chamar('POST', '/api/reconhecimentos', cookie, { data_reconhecimento: HOJE })
            assert.equal(ruim.status, 400); assert.match(JSON.parse(ruim.texto).error, /tipo de reconhecimento/)
        })
    }
    await caso('a service role nunca aparece em respostas nem na página', async () => {
        const cookie = await cookieDe('vp')
        for (const [m, p] of [['GET', '/reconhecimentos'], ['GET', '/api/reconhecimentos']]) assert.ok(!(await chamar(m, p, cookie)).texto.includes(SERVICE))
    })

    // =============================================================== B) interface
    console.log('\nB) Interface (navegador)')
    browser = await chromium.launch()
    const contexto = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const [nome, valor] = (await cookieDe('vp')).split('=')
    await contexto.addCookies([{ name: nome, value: valor, url: `http://127.0.0.1:${PORT_NEXT}` }])
    const page = await contexto.newPage()
    const errosDePagina = []
    page.on('pageerror', e => errosDePagina.push(String(e)))
    const base = `http://127.0.0.1:${PORT_NEXT}`
    const abrirAba = async (id) => { await page.getByRole('tab', { name: id }).click() }
    const escolher = async (rotulo, opcao) => {
        await page.getByRole('button', { name: rotulo }).first().click()
        await page.locator('[data-radix-popper-content-wrapper]').getByRole('button', { name: opcao, exact: true }).click()
    }

    await caso('VP abre a aba: título, cinco abas, item no menu sob "Vice Presidência", sem regras cadastradas', async () => {
        await page.goto(`${base}/reconhecimentos`, { waitUntil: 'domcontentloaded' })
        await page.getByRole('heading', { name: 'Reconhecimentos e Bonificações' }).waitFor({ timeout: 90000 })
        for (const t of ['Visão Geral', 'Registrar', 'Bonificações', 'Histórico', 'Configurações']) await page.getByRole('tab', { name: t }).waitFor()
        await page.locator('a[href="/reconhecimentos"]').first().waitFor({ timeout: 20000 })
        assert.equal(await page.getByTestId('ind-mes').innerText(), '0')
        await abrirAba('Configurações')
        await page.getByTestId('sem-regras').waitFor()
        assert.equal(await page.getByTestId('linha-tipo').count(), 7, 'os 7 tipos iniciais')
        await page.screenshot({ path: path.join(SAIDA, 'rec-config-vazia.png') })
    })

    await caso('cadastra regra "RG a partir da 5ª" (sem valor inventado) — nada é gerado para as RGs 1ª–4ª anteriores', async () => {
        await page.getByRole('button', { name: 'Nova regra' }).click()
        await page.getByLabel('Nome da regra *').fill('Prêmio de 5ª RG')
        await escolher('Selecione o tipo', 'RG / Projeto Reconhecido')
        await escolher('A cada reconhecimento', 'Marcos de RG (pelo número da RG)')
        await page.getByLabel('A partir da RG nº *').fill('5')
        await escolher('Financeira', 'Prêmio / item')
        await page.getByLabel('Descrição da premiação').fill('Brinde de teste')
        await page.getByRole('button', { name: 'Salvar regra' }).click()
        await page.getByTestId('linha-regra').waitFor()
        assert.equal(await contar(`select 1 from bonificacoes`), 0)
    })

    await caso('Registrar RG: sugere 5ª, bloqueia número repetido, aceita a 5ª e gera UMA bonificação', async () => {
        await abrirAba('Registrar')
        await page.getByRole('button', { name: 'Registrar reconhecimento' }).last().click()
        await escolher('Selecione o tipo', 'RG / Projeto Reconhecido')
        await escolher('Selecione o projeto', 'Prorestaure')
        await page.getByTestId('sugestao-rg').waitFor()
        assert.match(await page.getByTestId('sugestao-rg').innerText(), /5ª RG/)
        assert.equal(await page.getByLabel('Número da RG *').inputValue(), '5')
        await page.getByLabel('Número da RG *').fill('4')
        await page.getByRole('button', { name: 'Registrar', exact: true }).click()
        await page.getByText(/já tem a 4ª RG registrada/).first().waitFor({ timeout: 10000 })
        assert.equal(await contar(`select 1 from reconhecimentos where numero_rg = 5`), 0)
        await page.getByLabel('Número da RG *').fill('5')
        await page.getByRole('button', { name: 'Registrar', exact: true }).click()
        await aguardar(async () => (await contar(`select 1 from reconhecimentos where numero_rg = 5`)) === 1, 'RG 5 gravada')
        await aguardar(async () => (await contar(`select 1 from bonificacoes`)) === 1, 'uma bonificação gerada')
        assert.equal(await contar(`select 1 from bonificacoes`), 1)
        // recarrega: o sincronizar da abertura não cria duplicatas
        await page.reload({ waitUntil: 'domcontentloaded' })
        await page.getByRole('heading', { name: 'Reconhecimentos e Bonificações' }).waitFor()
        await new Promise(r => setTimeout(r, 1500))
        assert.equal(await contar(`select 1 from bonificacoes`), 1)
    })

    await caso('Kanban: cartão em Disponíveis com sujeito, premiação e data de liberação; indicadores reais', async () => {
        await abrirAba('Bonificações')
        const coluna = page.getByTestId('coluna-disponivel')
        const cartao = coluna.getByTestId('cartao-bonificacao')
        await cartao.waitFor()
        const texto = await cartao.innerText()
        assert.match(texto, /Prorestaure/); assert.match(texto, /Brinde de teste/); assert.ok(texto.includes(`Liberada: ${formatarData(HOJE)}`), texto)
        for (const s of ['entregue', 'expirada', 'cancelada']) assert.equal(await page.getByTestId(`coluna-${s}`).getByTestId('cartao-bonificacao').count(), 0)
        await abrirAba('Visão Geral')
        assert.equal(await page.getByTestId('ind-mes').innerText(), '1')
        assert.equal(await page.getByTestId('ind-disponiveis').innerText(), '1')
        assert.equal(await page.getByTestId('ind-entregues').innerText(), '0')
        await page.screenshot({ path: path.join(SAIDA, 'rec-visao-geral.png') })
    })

    await caso('Entrega por colaborador: João e Maria; só João recebe — o cartão NÃO vira "entregue"; Pedro entra depois', async () => {
        await abrirAba('Bonificações')
        await page.getByTestId('coluna-disponivel').getByTestId('cartao-bonificacao').click()
        const painel = page.getByTestId('painel-bonificacao')
        await painel.getByRole('button', { name: /Selecione os colaboradores/ }).click()
        await page.getByRole('option', { name: /João Silva/ }).click()
        await page.getByRole('option', { name: /Maria Souza/ }).click()
        await page.keyboard.press('Escape')
        await painel.getByRole('button', { name: 'Adicionar', exact: true }).click()
        await aguardar(async () => (await contar(`select 1 from bonificacao_entregas`)) === 2, 'duas entregas')
        await painel.getByTestId('entrega').nth(1).waitFor()
        // João -> entregue
        await painel.getByRole('button', { name: 'Editar entrega de João Silva' }).click()
        await page.getByRole('dialog').getByRole('button', { name: 'Solicitada' }).click()
        await page.locator('[data-radix-popper-content-wrapper]').getByRole('button', { name: 'Entregue', exact: true }).click()
        await page.getByLabel('Data da entrega').fill(HOJE)
        await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click()
        await aguardar(async () => (await contar(`select 1 from bonificacao_entregas where situacao = 'entregue'`)) === 1, 'João entregue')
        const b = (await pg.query(`select status from bonificacoes`)).rows[0]
        assert.equal(b.status, 'disponivel', 'mudar a entrega de uma pessoa não conclui o cartão')
        // Maria ainda pendente: concluir fica bloqueado
        assert.ok(await painel.getByRole('button', { name: 'Concluir bonificação' }).isDisabled())
        assert.equal((await pg.query(`select situacao from bonificacao_entregas e join colaboradores c on c.id = e.colaborador_id where c.nome = 'Maria Souza'`)).rows[0].situacao, 'solicitada')
        // quem já está na bonificação não aparece de novo na lista
        await painel.getByRole('button', { name: /Selecione os colaboradores/ }).click()
        assert.equal(await page.getByRole('option', { name: /João Silva/ }).count(), 0)
        assert.equal(await page.getByRole('option', { name: /Pedro Lima/ }).count(), 1)
        await page.keyboard.press('Escape')
        await page.screenshot({ path: path.join(SAIDA, 'rec-painel.png') })
    })

    await caso('Maria recebe, a bonificação é concluída; Pedro adicionado depois reabre o cartão', async () => {
        const painel = page.getByTestId('painel-bonificacao')
        await painel.getByRole('button', { name: 'Editar entrega de Maria Souza' }).click()
        await page.getByRole('dialog').getByRole('button', { name: 'Solicitada' }).click()
        await page.locator('[data-radix-popper-content-wrapper]').getByRole('button', { name: 'Entregue', exact: true }).click()
        await page.getByLabel('Data da entrega').fill(HOJE)
        await page.getByRole('dialog').getByRole('button', { name: 'Salvar' }).click()
        await aguardar(async () => (await contar(`select 1 from bonificacao_entregas where situacao = 'entregue'`)) === 2, 'Maria entregue')
        await painel.getByRole('button', { name: 'Concluir bonificação' }).click()
        await aguardar(async () => (await pg.query(`select status from bonificacoes`)).rows[0].status === 'entregue', 'cartão concluído')
        await painel.getByRole('button', { name: /Selecione os colaboradores/ }).click()
        await page.getByRole('option', { name: /Pedro Lima/ }).click()
        await page.keyboard.press('Escape')
        await painel.getByRole('button', { name: 'Adicionar', exact: true }).click()
        await aguardar(async () => (await contar(`select 1 from bonificacao_entregas`)) === 3, 'Pedro adicionado')
        await aguardar(async () => (await pg.query(`select status from bonificacoes`)).rows[0].status === 'disponivel', 'cartão reaberto')
        // duplicidade protegida no banco
        const r = await chamar('POST', `/api/reconhecimentos/bonificacoes/${(await pg.query('select id from bonificacoes')).rows[0].id}/entregas`, await cookieDe('vp'), { colaborador_ids: [U(21)] })
        assert.equal(r.status, 409)
        assert.equal(await contar(`select 1 from bonificacao_entregas`), 3)
        // todas as mudanças têm autor e data no histórico
        const hist = (await pg.query(`select acao, usuario_email from reconhecimento_historico where entidade = 'entrega' order by created_at`)).rows
        assert.ok(hist.length >= 5 && hist.every(h => h.usuario_email === 'vp@pj.com'), JSON.stringify(hist))
        await page.keyboard.press('Escape')
    })

    await caso('Editar a RG (5 -> 6): grava, aponta "origem alterada", mantém a bonificação e registra de→para no histórico', async () => {
        await page.keyboard.press('Escape')
        await abrirAba('Registrar')
        const linha = page.getByTestId('linha-reconhecimento').filter({ hasText: '5ª' })
        await linha.getByRole('button', { name: 'Editar reconhecimento' }).click()
        await page.getByLabel('Número da RG *').fill('6')
        await page.getByRole('button', { name: 'Salvar alterações' }).click()
        await aguardar(async () => (await contar(`select 1 from reconhecimentos where numero_rg = 6`)) === 1, 'RG editada')
        assert.equal(await contar(`select 1 from bonificacoes`), 1, 'a bonificação foi mantida')
        assert.equal((await pg.query(`select origem_alterada from bonificacoes`)).rows[0].origem_alterada, true)
        const linha6 = page.getByTestId('linha-reconhecimento').filter({ hasText: '6ª' })
        await linha6.getByRole('button', { name: 'Ver histórico do reconhecimento' }).click()
        const dlg = page.getByRole('dialog')
        await dlg.getByText('Reconhecimento editado').waitFor()
        assert.ok((await dlg.innerText()).includes('Nº da RG: 5 → 6'))
        await dlg.getByText('Reconhecimento registrado').waitFor()
        await page.screenshot({ path: path.join(SAIDA, 'rec-historico-rec.png') })
        await page.keyboard.press('Escape')
    })

    await caso('Individual e Núcleo: SDR do Mês com período; duplicidade no mesmo mês bloqueada; Núcleo de Impacto', async () => {
        await page.getByRole('button', { name: 'Registrar reconhecimento' }).last().click()
        await escolher('Selecione o tipo', 'SDR do Mês')
        await escolher('Selecione o colaborador', 'João Silva')
        await page.getByLabel('Período de referência').fill(HOJE.slice(0, 7))
        await page.getByRole('button', { name: 'Registrar', exact: true }).click()
        await aguardar(async () => (await contar(`select 1 from reconhecimentos where colaborador_nome = 'João Silva'`)) === 1, 'SDR gravado')
        await page.getByRole('button', { name: 'Registrar reconhecimento' }).last().click()
        await escolher('Selecione o tipo', 'SDR do Mês')
        await escolher('Selecione o colaborador', 'João Silva')
        await page.getByLabel('Período de referência').fill(HOJE.slice(0, 7))
        await page.getByRole('button', { name: 'Registrar', exact: true }).click()
        await page.getByText(/já tem esse reconhecimento no período/).first().waitFor({ timeout: 10000 })
        assert.equal(await contar(`select 1 from reconhecimentos where colaborador_nome = 'João Silva'`), 1)
        await page.getByRole('button', { name: 'Cancelar' }).click()
        await page.getByRole('button', { name: 'Registrar reconhecimento' }).last().click()
        await escolher('Selecione o tipo', 'Núcleo de Impacto')
        await escolher('Selecione o núcleo', 'Marketing')
        await page.getByRole('button', { name: 'Registrar', exact: true }).click()
        await aguardar(async () => (await contar(`select 1 from reconhecimentos where nucleo = 'Marketing'`)) === 1, 'núcleo gravado')
        assert.equal(await contar(`select 1 from bonificacoes`), 1, 'sem regra para esses tipos, nada é gerado')
    })

    await caso('Histórico global e filtros', async () => {
        await abrirAba('Histórico')
        await page.getByTestId('linha-do-tempo').waitFor()
        const texto = await page.getByTestId('linha-do-tempo').innerText()
        for (const trecho of ['Bonificação gerada', 'adicionado(a) à bonificação', 'Reconhecimento editado', 'vp@pj.com']) assert.ok(texto.includes(trecho), `faltou "${trecho}"`)
        await abrirAba('Registrar')
        const total = await page.getByTestId('linha-reconhecimento').count()
        assert.equal(total, 7)
        await page.getByLabel('Pesquisar').fill('SDR')
        await aguardar(async () => (await page.getByTestId('linha-reconhecimento').count()) === 1, 'filtro de pesquisa')
        await page.getByRole('button', { name: 'Limpar filtros' }).click()
        await aguardar(async () => (await page.getByTestId('linha-reconhecimento').count()) === 7, 'limpar filtros')
    })

    await caso('Responsivo (celular): a aba abre sem rolagem horizontal da página', async () => {
        await page.setViewportSize({ width: 390, height: 844 })
        await page.goto(`${base}/reconhecimentos`, { waitUntil: 'domcontentloaded' })
        await page.getByRole('heading', { name: 'Reconhecimentos e Bonificações' }).waitFor()
        await abrirAba('Bonificações')
        await page.getByTestId('kanban').waitFor()
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'há rolagem horizontal')
        await page.screenshot({ path: path.join(SAIDA, 'rec-mobile.png') })
        await page.setViewportSize({ width: 1440, height: 1000 })
    })

    await caso('Quem não é VP não vê o menu e é mandado para o início ao abrir a aba', async () => {
        const ctx2 = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
        const [n2, v2] = (await cookieDe('mkt')).split('=')
        await ctx2.addCookies([{ name: n2, value: v2, url: base }])
        const p2 = await ctx2.newPage()
        await p2.goto(`${base}/reconhecimentos`, { waitUntil: 'domcontentloaded' })
        await p2.waitForURL(u => new URL(u).pathname === '/', { timeout: 60000 })
        await new Promise(r => setTimeout(r, 1500))
        assert.equal(await p2.locator('a[href="/reconhecimentos"]').count(), 0, 'item de menu visível para não autorizado')
        assert.equal(await p2.getByText('Reconhecimentos e Bonificações').count(), 0)
        await ctx2.close()
    })

    await caso('nenhum erro de JavaScript na página', async () => { assert.deepEqual(errosDePagina, []) })
} finally {
    if (browser) await browser.close().catch(() => undefined)
    if (servidor) await parar(servidor.proc).catch(() => undefined)
    await emu.fechar().catch(() => undefined)
}
const falhas = resultados.filter(([ok]) => !ok).length
console.log(`\n${resultados.length - falhas}/${resultados.length} casos OK`)
fs.writeFileSync(path.join(SAIDA, 'rec-e2e-resultado.txt'), resultados.map(([ok, n]) => `${ok ? 'OK   ' : 'FALHA'} ${n}`).join('\n'))
process.exit(falhas ? 1 : 0)
