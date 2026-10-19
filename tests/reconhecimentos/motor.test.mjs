// Vetores V1–V5 do pacote de migração (02-especificacao-tecnica.md §3.2),
// executados contra o motor reconstruído (função pura calcularBonificacoes).
import test from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { calcularBonificacoes } from '../../src/lib/reconhecimentos/engine.ts'
import { adicionarDias, hojeISO, diferencaDias } from '../../src/lib/reconhecimentos/datas.ts'

const HOJE = '2026-10-19'
const regra = (o) => ({
    ativo: true, requer_rg_adiantada: false, requer_projeto_adiantado: false, valor: 0, descricao_premiacao: '',
    quantidade_necessaria: 1, ciclo: 0, prazo_dias: null, tipo_premiacao: 'financeira', ...o,
})
const rg = (id, data, adi, projeto = 'P1') => ({ id, tipo_id: 'T-RG', data, projeto_id: projeto, projeto_nome: projeto, adiantado: adi, rg_adiantada: false, projeto_adiantado: false })
const resumo = (novas) => novas.map(b => ({ regra: b.regra_nome, marco: b.marco, chave: b.marco_chave, liberada_em: b.liberada_em, prazo: b.prazo_limite, motivo: b.motivo, valor: b.valor }))
const comTipo = (r) => ({ ...r, reconhecimento_tipos: { nome: 'RG' } })

// Persistência mínima: transforma novas em "existentes" para a execução seguinte.
const persistir = (existentes, novas) => [...existentes, ...novas.map((b, i) => ({ id: `b-${existentes.length + i}`, marco_chave: b.marco_chave, status: b.status, prazo_limite: b.prazo_limite }))]

test('V1/V1b/V1c: acumulado com ciclo (R$12 e R$30), só adiantadas contam, idempotente', () => {
    const regras = [
        comTipo(regra({ id: '12', nome: 'R12', tipo_id: 'T-RG', criterio: 'acumulado', quantidade_necessaria: 2, ciclo: 4, requer_rg_adiantada: true, valor: 12 })),
        comTipo(regra({ id: '30', nome: 'R30', tipo_id: 'T-RG', criterio: 'acumulado', quantidade_necessaria: 4, ciclo: 4, requer_rg_adiantada: true, tipo_premiacao: 'premio', valor: 30 })),
    ]
    const recs = [
        ...['01', '02', '03', '04', '05', '06', '07'].map((d, i) => rg(`a${i + 1}`, `2026-01-${d}`, true)),
        rg('n1', '2026-01-08', false), rg('n2', '2026-01-09', false),
    ]
    let existentes = []
    const v1 = calcularBonificacoes(regras, recs, null, existentes, HOJE)
    assert.deepEqual(resumo(v1.novas), [
        { regra: 'R12', marco: 2, chave: '12:P1:2', liberada_em: '2026-01-02', prazo: null, motivo: '2 reconhecimentos adiantados', valor: 12 },
        { regra: 'R12', marco: 6, chave: '12:P1:6', liberada_em: '2026-01-06', prazo: null, motivo: '6 reconhecimentos adiantados', valor: 12 },
        { regra: 'R30', marco: 4, chave: '30:P1:4', liberada_em: '2026-01-04', prazo: null, motivo: '4 reconhecimentos adiantados', valor: 30 },
    ])
    existentes = persistir(existentes, v1.novas)

    recs.push(rg('a8', '2026-02-01', true), rg('a9', '2026-02-02', true), rg('a10', '2026-02-03', true))
    const v1b = calcularBonificacoes(regras, recs, null, existentes, HOJE)
    assert.deepEqual(resumo(v1b.novas).map(b => [b.regra, b.marco, b.liberada_em]), [['R12', 10, '2026-02-03'], ['R30', 8, '2026-02-01']])
    existentes = persistir(existentes, v1b.novas)

    assert.equal(calcularBonificacoes(regras, recs, null, existentes, HOJE).novas.length, 0, 'V1c: idempotência')
})

test('V2/V2b: por_reconhecimento gera uma por registro e apagar um registro não recria nem remove', () => {
    const regras = [comTipo(regra({ id: 'sdr', nome: 'SDR do Mês', tipo_id: 'T-SDR', criterio: 'por_reconhecimento', valor: 50, descricao_premiacao: 'R$ 50,00' }))]
    const recs = ['2026-03-01', '2026-04-01', '2026-05-01'].map((d, i) => ({ id: `s${i + 1}`, tipo_id: 'T-SDR', data: d, pessoa_nome: 'Ana', adiantado: false }))
    const v2 = calcularBonificacoes(regras, recs, null, [], HOJE)
    assert.equal(v2.novas.length, 3)
    assert.deepEqual(v2.novas.map(b => b.marco_chave), ['sdr:rec:s1', 'sdr:rec:s2', 'sdr:rec:s3'])
    assert.ok(v2.novas.every(b => b.marco === 1 && b.motivo === 'SDR do Mês' && b.valor === 50 && b.status === 'disponivel'))
    const existentes = persistir([], v2.novas)
    const semS2 = recs.filter(r => r.id !== 's2')
    assert.equal(calcularBonificacoes(regras, semS2, null, existentes, HOJE).novas.length, 0)
})

test('V3: regra simbólica e regra inativa (não passada ao motor) não geram bonificação', () => {
    const recs = [{ id: 'x1', tipo_id: 'T-X', data: '2026-01-01', pessoa_nome: 'Bia', adiantado: false }]
    const simbolica = comTipo(regra({ id: 'sim', nome: 'Simb', tipo_id: 'T-X', criterio: 'simbolico' }))
    assert.equal(calcularBonificacoes([simbolica], recs, null, [], HOJE).novas.length, 0)
    // O repositório só entrega ao motor as regras ativas (eq('ativo', true)); ver repositorio.test.mjs.
})

test('V4/V4b: prazo da regra, prazo padrão, 0 = sem prazo, e expiração', () => {
    const regras = [
        comTipo(regra({ id: 'p30', nome: 'P30', tipo_id: 'T-P', criterio: 'por_reconhecimento', prazo_dias: 30 })),
        comTipo(regra({ id: 'pcfg', nome: 'PCFG', tipo_id: 'T-P', criterio: 'por_reconhecimento', prazo_dias: null })),
        comTipo(regra({ id: 'p0', nome: 'P0', tipo_id: 'T-P', criterio: 'por_reconhecimento', prazo_dias: 0 })),
    ]
    const recs = [{ id: 'p1', tipo_id: 'T-P', data: '2026-01-01', pessoa_nome: 'Caio', adiantado: false }]
    const v4 = calcularBonificacoes(regras, recs, 10, [], HOJE)
    assert.deepEqual(Object.fromEntries(v4.novas.map(b => [b.regra_nome, b.prazo_limite])), { P30: '2026-01-31', PCFG: '2026-01-11', P0: null })
    assert.deepEqual(v4.expirar, [], 'as recém-criadas não são avaliadas na mesma execução')

    const existentes = persistir([], v4.novas).map((b, i) => ({ ...b, id: ['b30', 'bcfg', 'b0'][i] }))
    const v4b = calcularBonificacoes(regras, recs, 10, existentes, HOJE)
    assert.equal(v4b.novas.length, 0)
    assert.deepEqual(v4b.expirar.map(e => e.id).sort(), ['b30', 'bcfg'], 'a sem prazo continua disponível')

    // Não expira no próprio dia do prazo; expira no dia seguinte.
    assert.equal(calcularBonificacoes(regras, recs, 10, existentes, '2026-01-31').expirar.length, 1)
    assert.equal(calcularBonificacoes(regras, recs, 10, existentes, '2026-02-01').expirar.length, 2)
    // Só `disponivel` expira.
    const entregue = existentes.map(b => ({ ...b, status: 'entregue' }))
    assert.equal(calcularBonificacoes(regras, recs, 10, entregue, HOJE).expirar.length, 0)
})

test('V5: aritmética de datas independe do fuso (original errava em Berlim/Tóquio)', () => {
    assert.equal(adicionarDias('2026-01-01', 30), '2026-01-31')
    assert.equal(adicionarDias('2026-02-27', 3), '2026-03-02')
    assert.equal(adicionarDias('2028-02-28', 1), '2028-02-29')
    assert.equal(diferencaDias('2026-01-01', '2026-01-31'), 30)
    const script = `
        import { adicionarDias, hojeISO } from '../../src/lib/reconhecimentos/datas.ts'
        console.log(adicionarDias('2026-01-01', 30), hojeISO(new Date('2026-01-01T02:30:00Z')), hojeISO(new Date('2026-01-01T03:30:00Z')))`
    const aqui = path.dirname(fileURLToPath(import.meta.url))
    for (const tz of ['America/Sao_Paulo', 'UTC', 'Europe/Berlin', 'Asia/Tokyo', 'Pacific/Auckland']) {
        const saida = execFileSync(process.execPath, ['--experimental-strip-types', '--import', path.join(aqui, 'loader.mjs'), '--input-type=module', '-e', script], {
            cwd: aqui, env: { ...process.env, TZ: tz }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
        }).trim()
        // 02:30Z ainda é 31/12 em São Paulo (UTC-3); 03:30Z já é 01/01.
        assert.equal(saida, '2026-01-31 2025-12-31 2026-01-01', `TZ=${tz}`)
    }
})

test('hojeISO usa o fuso de São Paulo na virada do dia', () => {
    assert.equal(hojeISO(new Date('2026-06-30T23:59:00-03:00')), '2026-06-30')
    assert.equal(hojeISO(new Date('2026-07-01T00:01:00-03:00')), '2026-07-01')
})

test('sujeito, elegibilidade por legado (OU) e marco único sem ciclo', () => {
    const regras = [comTipo(regra({ id: 'u', nome: 'Única', tipo_id: 'T-RG', criterio: 'acumulado', quantidade_necessaria: 3, ciclo: 0, requer_projeto_adiantado: true }))]
    const recs = [
        { ...rg('r1', '2026-01-01', false), rg_adiantada: true },
        { ...rg('r2', '2026-01-02', false), projeto_adiantado: true },
        rg('r3', '2026-01-03', true),
        rg('r4', '2026-01-04', true),
    ]
    const { novas } = calcularBonificacoes(regras, recs, null, [], HOJE)
    assert.equal(novas.length, 1, 'ciclo 0 gera só o primeiro marco')
    assert.equal(novas[0].marco, 3)
    assert.equal(novas[0].reconhecimento_id, 'r3')
    assert.equal(novas[0].liberada_em, '2026-01-03')
    assert.equal(novas[0].motivo, '3 reconhecimentos adiantados')
})

test('sem identificação: sujeito cai em "sem-identificacao" e agrupa por projeto_id', () => {
    const regras = [comTipo(regra({ id: 'a', nome: 'A', tipo_id: 'T', criterio: 'acumulado', quantidade_necessaria: 2, ciclo: 0 }))]
    const recs = [
        { id: '1', tipo_id: 'T', data: '2026-01-01' },
        { id: '2', tipo_id: 'T', data: '2026-01-02' },
        { id: '3', tipo_id: 'T', data: '2026-01-03', projeto_id: 'P', projeto_nome: 'Proj' },
    ]
    const { novas } = calcularBonificacoes(regras, recs, null, [], HOJE)
    assert.equal(novas.length, 1)
    assert.equal(novas[0].marco_chave, 'a:sem-identificacao:2')
})
