// Teste de interface (navegador real) da aba Reconhecimentos: sobe `next dev` contra um
// emulador mínimo de PostgREST em memória, entra com cookies de sessão reais e percorre a
// aba como VP — e confere que quem não é VP não vê o item de menu nem consegue abrir a aba.
// Requer Playwright + Chromium (ex.: PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright).
// Uso: PLAYWRIGHT_MODULE=... node --experimental-strip-types --import ./tests/reconhecimentos/loader.mjs tests/reconhecimentos/ui-smoke.mjs
import { spawn } from 'node:child_process'
import http from 'node:http'
import assert from 'node:assert/strict'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { encode } from 'next-auth/jwt'
import { criarBanco, semear } from './fake-supabase.mjs'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE || 'playwright')
const SECRET = 'segredo-de-teste', COOKIE = 'authjs.session-token', PORT_NEXT = 3111, PORT_DB = 3112
const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const SAIDA = process.env.SAIDA_DIR || '/tmp'

// ---------------------------------------------------------------- dados
const { tabelas } = criarBanco()
const tipo = semear(tabelas)
const proj = { id: U(70), nome: 'Projeto Alfa', status: 'Ativo' }
tabelas.projetos.push(proj, { id: U(71), nome: 'Projeto Beta', status: 'Ativo' })
const usuarios = {
    [U(1)]: { id: U(1), email: 'vp@pj.com', role: 'COLABORADOR', colaborador_id: U(11) },
    [U(4)]: { id: U(4), email: 'mkt@pj.com', role: 'COLABORADOR', colaborador_id: U(14) },
}
const colaboradores = {
    [U(11)]: { id: U(11), nome: 'Vera da VP', cargo_atual: 'Operacional', nucleo_atual: 'Vice Presidência', paginas_permitidas: [], status: 'Ativo' },
    [U(14)]: { id: U(14), nome: 'Marcos de Marketing', cargo_atual: 'Tático', nucleo_atual: 'Marketing', paginas_permitidas: ['/reconhecimentos'], status: 'Ativo' },
}
let n = 0
const rec = (o) => tabelas.reconhecimentos.push({ id: randomUUID(), created_at: `2026-02-0${1 + (n++ % 9)}T10:00:00Z`, adiantado: false, rg_adiantada: false, projeto_adiantado: false, projeto_id: null, projeto_nome: null, pessoa_nome: null, nucleo_impacto: null, observacao: null, criado_por: 'vp@pj.com', ...o })
for (const d of ['2026-02-01', '2026-02-02', '2026-02-03', '2026-02-04']) rec({ tipo_id: tipo['RG / Projeto reconhecido'], data: d, projeto_id: proj.id, projeto_nome: proj.nome, adiantado: true })
rec({ tipo_id: tipo['SDR do Mês'], data: '2026-02-10', pessoa_nome: 'Ana Souza' })
rec({ tipo_id: tipo['Núcleo de Impacto'], data: '2026-02-12', pessoa_nome: 'CIT', nucleo_impacto: 'CIT' })
const bon = (o) => tabelas.bonificacoes.push({ id: randomUUID(), created_at: '2026-02-20T10:00:00Z', marco: 1, tipo_premiacao: 'financeira', valor: 50, descricao_premiacao: 'R$ 50,00', projeto_id: null, projeto_nome: null, pessoa_nome: null, nucleo_impacto: null, entregue_em: null, entregue_por: null, entregue_para: null, observacao_entrega: null, cancelada_em: null, cancelada_por: null, justificativa_cancelamento: null, prazo_limite: null, status: 'disponivel', ...o })
bon({ marco_chave: 's1', pessoa_nome: 'Ana Souza', tipo_nome: 'SDR do Mês', regra_nome: 'SDR do Mês', motivo: 'SDR do Mês', liberada_em: '2026-10-10', prazo_limite: '2026-10-21' })
bon({ marco_chave: 's2', pessoa_nome: 'Bia', tipo_nome: 'Closer do Mês', regra_nome: 'Closer do Mês', motivo: 'Closer do Mês', liberada_em: '2026-03-01', status: 'entregue', entregue_em: '2026-03-05T15:00:00Z', entregue_por: 'vp@pj.com', entregue_para: 'Bia; Caio' })
bon({ marco_chave: 's3', pessoa_nome: 'Caio', tipo_nome: 'Consultor do Mês', regra_nome: 'Consultor do Mês', motivo: 'Consultor do Mês', liberada_em: '2026-01-01', prazo_limite: '2026-01-31', status: 'expirada' })
bon({ marco_chave: 's4', pessoa_nome: 'Duda', tipo_nome: 'SDR do Mês', regra_nome: 'SDR do Mês', motivo: 'SDR do Mês', liberada_em: '2026-02-01', status: 'cancelada', cancelada_em: '2026-02-03T12:00:00Z', justificativa_cancelamento: 'Duplicidade' })
bon({ marco_chave: 'r1', projeto_id: proj.id, projeto_nome: proj.nome, marco: 2, valor: 12, descricao_premiacao: 'R$ 12,00', tipo_nome: 'RG / Projeto reconhecido', regra_nome: 'RGs adiantadas — ciclo R$ 12', motivo: '2 reconhecimentos adiantados', liberada_em: '2026-02-02' })
bon({ marco_chave: 'n1', pessoa_nome: 'CIT', nucleo_impacto: 'CIT', valor: 30, descricao_premiacao: 'R$ 30 por membro do núcleo', tipo_nome: 'Núcleo de Impacto', regra_nome: 'Núcleo de Impacto', motivo: 'Núcleo de Impacto', liberada_em: '2026-02-12' })
tabelas.bonificacao_eventos.push({ id: randomUUID(), bonificacao_id: tabelas.bonificacoes[1].id, evento: 'criada', detalhe: 'Bonificação gerada automaticamente pela regra', usuario: 'vp@pj.com', created_at: '2026-03-01T10:00:00Z' },
    { id: randomUUID(), bonificacao_id: tabelas.bonificacoes[1].id, evento: 'entregue', detalhe: 'Entregue para: Bia; Caio', usuario: 'vp@pj.com', created_at: '2026-03-05T15:00:00Z' })

// ------------------------------------------- emulador mínimo de PostgREST
const escritas = []
const emulador = http.createServer(async (req, res) => {
    res.setHeader('access-control-allow-origin', '*'); res.setHeader('access-control-allow-headers', '*'); res.setHeader('access-control-allow-methods', '*'); res.setHeader('access-control-expose-headers', '*')
    if (req.method === 'OPTIONS') { res.statusCode = 204; return res.end() }
    const url = new URL(req.url, 'http://x'); const t = url.pathname.split('/').pop()
    const corpoBruto = await new Promise(r => { let b = ''; req.on('data', d => b += d); req.on('end', () => r(b)) })
    const fonte = t === 'users' ? Object.values(usuarios) : t === 'colaboradores' ? Object.values(colaboradores) : tabelas[t]
    if (!fonte) { res.statusCode = 404; return res.end('{}') }
    const filtros = []
    for (const [k, v] of url.searchParams) {
        if (['select', 'order', 'limit', 'offset', 'on_conflict', 'columns'].includes(k)) continue
        const m = /^(eq|in|neq)\.(.*)$/.exec(v); if (!m) continue
        if (m[1] === 'eq') filtros.push(l => String(l[k]) === m[2])
        if (m[1] === 'neq') filtros.push(l => String(l[k]) !== m[2])
        if (m[1] === 'in') { const xs = m[2].replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, '')); filtros.push(l => xs.includes(String(l[k]))) }
    }
    const casa = (l) => filtros.every(f => f(l))
    const prefer = req.headers.prefer || ''
    const devolve = prefer.includes('return=representation')
    const json = (dados, status = 200) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(dados)) }
    if (req.method === 'GET' || req.method === 'HEAD') {
        let r = fonte.filter(casa)
        const ord = url.searchParams.get('order')
        if (ord) for (const o of ord.split(',').reverse()) { const [c, d] = o.split('.'); r = [...r].sort((a, b) => (d === 'desc' ? -1 : 1) * (a[c] === b[c] ? 0 : a[c] === null ? 1 : b[c] === null ? -1 : a[c] < b[c] ? -1 : 1)) }
        const juntar = /reconhecimento_tipos\(/.test(url.searchParams.get('select') || '')
        if (juntar) r = r.map(l => { const x = tabelas.reconhecimento_tipos.find(y => y.id === l.tipo_id); return { ...l, reconhecimento_tipos: x ? { nome: x.nome, escopo: x.escopo } : null } })
        res.setHeader('content-range', `0-${Math.max(r.length - 1, 0)}/${r.length}`)
        if ((req.headers.accept || '').includes('vnd.pgrst.object')) { if (r.length !== 1) return json({ message: 'no rows' }, 406); return json(r[0]) }
        if (req.method === 'HEAD') { res.statusCode = 200; return res.end() }
        const lim = url.searchParams.get('limit'); if (lim) r = r.slice(Number(url.searchParams.get('offset') || 0), Number(url.searchParams.get('offset') || 0) + Number(lim))
        return json(r)
    }
    const dados = corpoBruto ? JSON.parse(corpoBruto) : null
    if (req.method === 'POST') {
        const novas = []
        for (const p of Array.isArray(dados) ? dados : [dados]) {
            if (t === 'bonificacoes' && fonte.some(b => b.marco_chave === p.marco_chave)) { if (prefer.includes('ignore-duplicates')) continue; return json({ message: 'duplicate key' }, 409) }
            const linha = { id: randomUUID(), created_at: new Date().toISOString(), adiantado: false, rg_adiantada: false, projeto_adiantado: false, ativo: true, ...p }
            fonte.push(linha); novas.push(linha)
        }
        escritas.push(['POST', t, novas.length])
        return devolve ? json(novas, 201) : (res.statusCode = 201, res.end())
    }
    if (req.method === 'PATCH') { const alvo = fonte.filter(casa); alvo.forEach(l => Object.assign(l, dados)); escritas.push(['PATCH', t, alvo.length]); return devolve ? json(alvo) : (res.statusCode = 204, res.end()) }
    if (req.method === 'DELETE') { const alvo = fonte.filter(casa); alvo.forEach(l => fonte.splice(fonte.indexOf(l), 1)); escritas.push(['DELETE', t, alvo.length]); return devolve ? json(alvo) : (res.statusCode = 204, res.end()) }
    res.statusCode = 405; res.end()
})

// -------------------------------------------------------------- next dev
const matar = (p, s = 'SIGTERM') => { try { process.kill(-p.pid, s) } catch { /* encerrado */ } }
const env = { ...process.env, NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PORT_DB}`, NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'svc', AUTH_SECRET: SECRET, AUTH_TRUST_HOST: 'true', NEXT_TELEMETRY_DISABLED: '1' }
const cookieDe = async (id) => ({ name: COOKIE, value: await encode({ token: { sub: id, id, role: usuarios[id].role, colaborador_id: usuarios[id].colaborador_id }, secret: SECRET, salt: COOKIE }), url: `http://127.0.0.1:${PORT_NEXT}` })

await new Promise(r => emulador.listen(PORT_DB, '127.0.0.1', r))
const next = spawn(process.execPath, [path.join(raiz, 'node_modules/next/dist/bin/next'), 'dev', '-p', String(PORT_NEXT)], { cwd: raiz, env, stdio: 'ignore', detached: true })
let browser, ok = 0, falhas = 0
const caso = async (nome, fn) => { try { await fn(); ok++; console.log('  ok  ', nome) } catch (e) { falhas++; console.log('  FALHA', nome, '\n       ', String(e.message).split('\n').slice(0, 6).join('\n        ')) } }
try {
    for (let i = 0; i < 120; i++) { if (await fetch(`http://127.0.0.1:${PORT_NEXT}/login`).then(r => r.status < 500, () => false)) break; await new Promise(r => setTimeout(r, 1000)) }
    browser = await chromium.launch()
    const base = `http://127.0.0.1:${PORT_NEXT}`

    // ------------------------------------------------------------ VP
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'pt-BR', timezoneId: 'America/Sao_Paulo' })
    await ctx.addCookies([await cookieDe(U(1))])
    const page = await ctx.newPage()
    const erros = [], reqFalhas = []
    page.on('console', m => { if (m.type() === 'error') erros.push(m.text()) })
    page.on('pageerror', e => erros.push('pageerror: ' + e.message))
    page.on('response', r => { if (r.url().includes('/api/reconhecimentos') && r.status() >= 400) reqFalhas.push(`${r.status()} ${r.url()}`) })
    const sincronizacoes = []
    page.on('request', r => { if (r.url().includes('/api/reconhecimentos/sincronizar')) sincronizacoes.push(r.method()) })

    await caso('VP: abre a aba, vê título, 5 sub-abas e o menu "Reconhecimentos e Bonificações"', async () => {
        await page.goto(`${base}/reconhecimentos`, { waitUntil: 'domcontentloaded' })
        await page.getByRole('heading', { name: 'Reconhecimentos e Bonificações' }).waitFor({ timeout: 120000 })
        for (const aba of ['Visão Geral', 'Registrar', 'Bonificações', 'Histórico', 'Configurações']) await page.getByRole('tab', { name: aba }).waitFor()
        await page.getByRole('link', { name: 'Reconhecimentos e Bonificações' }).waitFor({ timeout: 30000 })
        assert.deepEqual(sincronizacoes, ['POST'], 'o motor roda uma vez na abertura (gatilho 1)')
    })
    await caso('Visão Geral: cartões de contagem e tabela de bonificações recentes', async () => {
        const card = async (rotulo) => Number(await page.locator('div', { hasText: new RegExp(`^${rotulo}$`) }).last().locator('xpath=ancestor::div[contains(@class,"rounded-xl")]').locator('p.font-display').innerText())
        assert.equal(await card('Disponíveis'), 3)
        assert.equal(await card('Entregues'), 1)
        assert.equal(await card('Canceladas / expiradas'), 2)
        await page.getByRole('cell', { name: 'Ana Souza' }).first().waitFor()
        assert.equal(await page.getByRole('row').count(), 7) // cabeçalho + 6
        assert.ok(await page.getByText('R$ 30 por membro do núcleo').first().isVisible())
    })
    await caso('Filtros: digitar na pesquisa mantém o foco e filtra sem acento/caixa', async () => {
        const campo = page.getByPlaceholder('Projeto, pessoa ou reconhecimento').first()
        await campo.click(); await campo.pressSequentially('nucleo', { delay: 30 })
        assert.equal(await campo.inputValue(), 'nucleo', 'o campo perdeu o foco/valor durante a digitação')
        assert.equal(await page.getByRole('row').count(), 2)
        await campo.fill('')
    })
    await caso('Registrar: lista de reconhecimentos, botões e exclusão sem rodar o motor', async () => {
        await page.getByRole('tab', { name: 'Registrar' }).click()
        await page.getByRole('button', { name: 'Ajustar RGs anteriores' }).waitFor()
        assert.equal(await page.getByRole('row').count(), 7)
        const antes = sincronizacoes.length, bonsAntes = tabelas.bonificacoes.length
        await page.getByRole('row', { name: /Ana Souza/ }).getByRole('button', { name: 'Excluir reconhecimento' }).click()
        await page.getByText('Reconhecimento removido (bonificações já geradas são mantidas no histórico)').waitFor()
        assert.equal(tabelas.reconhecimentos.length, 5)
        assert.equal(tabelas.bonificacoes.length, bonsAntes)
        assert.equal(sincronizacoes.length, antes)
    })
    await caso('Registrar reconhecimento (pessoa): grava, roda o motor (gatilho 2) e cria a bonificação', async () => {
        await page.getByRole('button', { name: 'Registrar reconhecimento' }).first().click()
        await page.getByRole('combobox').first().click()
        await page.getByRole('option', { name: 'Closer do Mês' }).click()
        await page.getByPlaceholder('Pesquisar ou digitar o nome...').fill('Fernanda Lima')
        await page.getByRole('button', { name: 'Registrar', exact: true }).click()
        await page.getByText('Reconhecimento registrado!').waitFor()
        const nova = tabelas.bonificacoes.find(b => b.pessoa_nome === 'Fernanda Lima')
        assert.ok(nova && nova.valor === 50 && nova.status === 'disponivel' && nova.motivo === 'Closer do Mês')
        assert.equal(tabelas.reconhecimentos.find(r => r.pessoa_nome === 'Fernanda Lima').criado_por, 'vp@pj.com', 'usuário vem da sessão no servidor')
    })
    await caso('Registrar reconhecimento (projeto): usa a tabela projetos, valida e grava RGs anteriores', async () => {
        await page.getByRole('button', { name: 'Registrar reconhecimento' }).first().click()
        await page.getByRole('combobox').first().click()
        await page.getByRole('option', { name: 'RG / Projeto reconhecido' }).click()
        await page.getByRole('button', { name: 'Registrar', exact: true }).click()
        await page.getByText('Selecione o projeto').waitFor()
        await page.getByRole('button', { name: /Pesquisar ou selecionar projeto/ }).click()
        await page.getByPlaceholder('Pesquisar pelo nome...').fill('beta')
        await page.getByRole('button', { name: 'Projeto Beta' }).click()
        await page.getByRole('switch').click()
        await page.getByPlaceholder('0').fill('3')
        await page.getByRole('button', { name: 'Registrar', exact: true }).click()
        await page.getByText('Reconhecimento registrado!').waitFor()
        const beta = tabelas.reconhecimentos.filter(r => r.projeto_nome === 'Projeto Beta')
        assert.equal(beta.length, 4); assert.ok(beta.every(r => r.adiantado))
        assert.deepEqual(tabelas.bonificacoes.filter(b => b.projeto_nome === 'Projeto Beta').map(b => b.marco).sort(), [2, 4])
    })
    await caso('Núcleo de Impacto: lista de 7 núcleos próprios e bonificação de R$ 30 sem multiplicar', async () => {
        await page.getByRole('button', { name: 'Registrar reconhecimento' }).first().click()
        await page.getByRole('combobox').first().click()
        await page.getByRole('option', { name: 'Núcleo de Impacto' }).click()
        await page.getByRole('combobox').nth(1).click()
        assert.equal(await page.getByRole('option').count(), 7)
        await page.getByRole('option', { name: 'Vice-Presidência' }).click()
        await page.getByRole('button', { name: 'Registrar', exact: true }).click()
        await page.getByText('Reconhecimento registrado!').waitFor()
        const b = tabelas.bonificacoes.find(x => x.nucleo_impacto === 'Vice-Presidência')
        assert.ok(b && b.valor === 30 && tabelas.bonificacoes.filter(x => x.nucleo_impacto === 'Vice-Presidência').length === 1)
    })
    await caso('Ajustar RGs anteriores (gatilho 3)', async () => {
        await page.getByRole('tab', { name: 'Registrar' }).click()
        await page.getByRole('button', { name: 'Ajustar RGs anteriores' }).click()
        await page.getByRole('button', { name: /Pesquisar ou selecionar projeto/ }).click()
        await page.getByRole('button', { name: 'Projeto Alfa' }).click()
        await page.getByPlaceholder('0').fill('2')
        await page.getByRole('button', { name: 'Salvar ajuste' }).click()
        await page.getByText('Contagem de RGs ajustada!').waitFor()
        assert.equal(tabelas.reconhecimentos.filter(r => r.observacao === 'RG adiantada registrada antes do uso do sistema' && r.projeto_nome === 'Projeto Alfa').length, 2)
    })
    await caso('Kanban: 4 colunas com contadores, sem arrastar; alerta de vencimento', async () => {
        await page.getByRole('tab', { name: 'Bonificações' }).click()
        for (const c of ['Disponíveis', 'Entregues', 'Expiradas', 'Canceladas']) await page.getByRole('heading', { name: c }).waitFor()
        await page.getByText(/Vence em \d+ dia/).first().waitFor()
    })
    await caso('Detalhe: histórico, mudanças de status e entrega com vários nomes', async () => {
        await page.getByText('Fernanda Lima').first().click()
        await page.getByText('Histórico que originou a bonificação').waitFor()
        await page.getByRole('button', { name: 'Marcar como entregue' }).click()
        const nome = page.getByPlaceholder('Pesquisar ou digitar o nome...')
        await nome.fill('Fernanda Lima'); await nome.press('Enter')
        await nome.fill('Gabriel'); await page.getByRole('button', { name: 'Confirmar entrega' }).click()
        await page.getByText('Bonificação marcada como entregue').waitFor()
        const b = tabelas.bonificacoes.find(x => x.pessoa_nome === 'Fernanda Lima')
        assert.equal(b.status, 'entregue'); assert.equal(b.entregue_para, 'Fernanda Lima; Gabriel'); assert.equal(b.entregue_por, 'vp@pj.com')
        const ev = tabelas.bonificacao_eventos.find(e => e.bonificacao_id === b.id && e.evento === 'entregue')
        assert.equal(ev.detalhe, 'Entregue para: Fernanda Lima; Gabriel')
    })
    await caso('Cancelar: justificativa obrigatória; "Outro" exige descrição', async () => {
        const alvo = tabelas.bonificacoes.find(b => b.marco_chave === 's1')
        await page.getByRole('tab', { name: 'Visão Geral' }).click()
        await page.getByRole('row', { name: /Ana Souza/ }).first().click()
        await page.getByRole('button', { name: 'Cancelar bonificação' }).click()
        await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
        await page.getByText('Selecione a justificativa').waitFor()
        await page.getByRole('combobox').last().click(); await page.getByRole('option', { name: 'Outro' }).click()
        await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
        await page.getByText('Descreva a justificativa').waitFor()
        await page.getByRole('dialog').locator('textarea').fill('Lançamento duplicado pelo time')
        await page.getByRole('button', { name: 'Confirmar cancelamento' }).click()
        await page.getByText('Bonificação cancelada', { exact: true }).waitFor()
        assert.equal(alvo.status, 'cancelada'); assert.equal(alvo.justificativa_cancelamento, 'Lançamento duplicado pelo time')
    })
    await caso('Histórico (linha do tempo) e Configurações', async () => {
        await page.getByRole('tab', { name: 'Histórico' }).click()
        await page.getByText('Linha do tempo').waitFor()
        await page.getByText(/Bonificação liberada — R\$ 50,00 \(SDR do Mês\)/).first().waitFor()
        await page.getByRole('tab', { name: 'Configurações' }).click()
        await page.getByText('Prazo padrão das bonificações').waitFor()
        await page.getByText('Núcleo de Impacto').first().waitFor()
        assert.equal(await page.getByRole('button', { name: 'Editar regra' }).count(), 6)
        // prazo padrão (não roda o motor)
        const antes = sincronizacoes.length
        await page.getByPlaceholder('Sem prazo').fill('45'); await page.getByRole('button', { name: 'Salvar', exact: true }).click()
        await page.getByText('Prazo padrão salvo').waitFor()
        assert.equal(tabelas.bonificacoes_config[0].prazo_padrao_dias, 45); assert.equal(sincronizacoes.length, antes)
        // nova regra (gatilho 4)
        await page.getByRole('button', { name: 'Criar nova regra' }).click()
        await page.getByRole('button', { name: 'Salvar regra' }).click()
        await page.getByText('Informe o nome da regra').waitFor()
        await page.getByRole('dialog').locator('input').first().fill('Líder de Voo (teste)')
        await page.getByRole('dialog').getByRole('combobox').first().click(); await page.getByRole('option', { name: 'Líder de Voo' }).click()
        await page.getByRole('dialog').getByRole('combobox').nth(1).click(); await page.getByRole('option', { name: 'A cada reconhecimento' }).click()
        await page.getByRole('button', { name: 'Salvar regra' }).click()
        await page.getByText('Regra salva. Bonificações já geradas mantêm o valor original.').waitFor()
        assert.ok(tabelas.regras_bonificacao.some(r => r.nome === 'Líder de Voo (teste)'))
    })
    await caso('sem erros de console nem respostas 4xx/5xx das rotas da aba durante todo o percurso', async () => {
        await page.screenshot({ path: path.join(SAIDA, 'reconhecimentos-vp.png'), fullPage: true })
        const relevantes = erros.filter(e => !/pdi|notific|favicon|font/i.test(e))
        assert.deepEqual(relevantes, [], 'erros de console: ' + relevantes.join(' | '))
        assert.deepEqual(reqFalhas.filter(f => !/\(esperado\)/.test(f)), [], reqFalhas.join(' | '))
    })

    // --------------------------------------------------------- não VP
    const ctx2 = await browser.newContext({ viewport: { width: 1400, height: 1000 }, locale: 'pt-BR' })
    await ctx2.addCookies([await cookieDe(U(4))])
    const p2 = await ctx2.newPage()
    const dadosDaAba = []
    p2.on('response', r => { if (r.url().includes('/api/reconhecimentos')) dadosDaAba.push(r.status()) })
    await caso('Não VP (Tático de Marketing com paginas_permitidas): menu sem o item e URL direta volta para "/"', async () => {
        await p2.goto(`${base}/`, { waitUntil: 'domcontentloaded' })
        await p2.getByRole('link', { name: 'Minhas Atividades' }).waitFor({ timeout: 120000 })
        assert.equal(await p2.getByRole('link', { name: 'Reconhecimentos e Bonificações' }).count(), 0)
        await p2.goto(`${base}/reconhecimentos`, { waitUntil: 'domcontentloaded' })
        await p2.waitForURL(`${base}/`, { timeout: 60000 })
        assert.equal(await p2.getByRole('heading', { name: 'Reconhecimentos e Bonificações' }).count(), 0)
        assert.equal(await p2.getByRole('button', { name: 'Registrar reconhecimento' }).count(), 0)
        assert.deepEqual(dadosDaAba, [], 'a aba não deve nem chamar a API de dados')
    })
    await caso('Não VP chamando a API direto pelo navegador logado: 403', async () => {
        const status = await p2.evaluate(async () => (await fetch('/api/reconhecimentos')).status)
        assert.equal(status, 403)
    })
} finally {
    await browser?.close().catch(() => undefined)
    matar(next); setTimeout(() => matar(next, 'SIGKILL'), 3000)
    emulador.close()
}
console.log(`\n${ok}/${ok + falhas} casos OK`)
process.exit(falhas ? 1 : 0)
