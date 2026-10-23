// Regras de negócio puras: sequência de RG, marcos, geração idempotente, vigência, expiração, entregas.
import test from 'node:test'
import assert from 'node:assert/strict'
import * as m from '../../src/lib/reconhecimentos/motor.ts'

const regra = (extra = {}) => ({ id: 'r1', nome: 'Prêmio', tipo_id: 'rg', gatilho: 'marcos_de_rg', a_partir_de: 4, repetir_a_cada: 4, tipo_premiacao: 'item', valor: null, descricao_premiacao: '', prazo_dias: null, vigente_desde: '2026-01-01T00:00:00Z', ativo: true, ...extra })
const rec = (n, extra = {}) => ({ id: `rec${n}`, tipo_id: 'rg', data_reconhecimento: '2026-02-10', projeto_id: 'p1', projeto_nome: 'Prorestaure', colaborador_id: null, colaborador_nome: null, nucleo: null, numero_rg: n, created_at: '2026-02-10T12:00:00Z', ...extra })
const gerar = (regras, reconhecimentos, chavesExistentes = []) => m.calcularNovasBonificacoes({ regras, reconhecimentos, nomesDosTipos: { rg: 'RG' }, chavesExistentes })

test('próximo número de RG: maior + 1, ignora nulos', () => {
    assert.equal(m.proximoNumeroRg([]), 1)
    assert.equal(m.proximoNumeroRg([1, 2, 3, 4]), 5)
    assert.equal(m.proximoNumeroRg([1, null, 7, undefined]), 8)
})

test('marcos: só o inicial sem repetição; com repetição, a cada N', () => {
    assert.ok(m.ehMarco(4, 4, null)); assert.ok(!m.ehMarco(8, 4, null)); assert.ok(!m.ehMarco(3, 4, 4))
    assert.deepEqual([4, 5, 8, 12, 13].filter(n => m.ehMarco(n, 4, 4)), [4, 8, 12])
})

test('geração por marco de RG: uma por marco, com snapshots, sem valor inventado e prazo opcional', () => {
    const novas = gerar([regra({ prazo_dias: 30 })], [1, 2, 3, 4, 5, 8].map(n => rec(n)))
    assert.deepEqual(novas.map(b => b.marco), [4, 8])
    assert.equal(novas[0].valor, null)
    assert.equal(novas[0].projeto_nome, 'Prorestaure')
    assert.equal(novas[0].prazo_limite, '2026-03-12')
    assert.equal(novas[0].motivo, '4ª RG reconhecida')
    assert.equal(novas[0].liberada_em, '2026-02-10')
})

test('idempotente: chaves existentes não geram de novo; duas RGs do mesmo marco geram uma só', () => {
    const regras = [regra()]
    const primeira = gerar(regras, [rec(4)])
    assert.equal(primeira.length, 1)
    assert.equal(gerar(regras, [rec(4)], primeira.map(b => b.chave_unica)).length, 0)
    assert.equal(gerar(regras, [rec(4, { id: 'a' }), rec(4, { id: 'b' })]).length, 1)
})

test('vigência: a regra só vale para reconhecimentos registrados depois dela; "ignorarVigencia" cobre os anteriores', () => {
    const r = regra({ vigente_desde: '2026-03-01T00:00:00Z' })
    assert.equal(gerar([r], [rec(4)]).length, 0)
    assert.equal(m.calcularNovasBonificacoes({ regras: [r], reconhecimentos: [rec(4)], nomesDosTipos: {}, chavesExistentes: [], ignorarVigencia: true }).length, 1)
    assert.equal(gerar([r], [rec(4, { created_at: '2026-03-02T00:00:00Z' })]).length, 1)
})

test('regras inativas não geram; "a cada reconhecimento" gera uma por registro', () => {
    assert.equal(gerar([regra({ ativo: false })], [rec(4)]).length, 0)
    const novas = gerar([regra({ gatilho: 'cada_reconhecimento', a_partir_de: null, repetir_a_cada: null })], [rec(1), rec(2)])
    assert.equal(novas.length, 2)
})

test('expiração: só disponível, prazo vencido e sem entrega concluída', () => {
    const b = [
        { id: 'a', status: 'disponivel', prazo_limite: '2026-01-31' }, { id: 'b', status: 'disponivel', prazo_limite: '2026-02-10' },
        { id: 'c', status: 'disponivel', prazo_limite: null }, { id: 'd', status: 'entregue', prazo_limite: '2026-01-01' }, { id: 'e', status: 'disponivel', prazo_limite: '2026-01-01' },
    ]
    assert.deepEqual(m.bonificacoesParaExpirar(b, new Set(['e']), '2026-02-10'), ['a'])
})

test('entrega: datas coerentes com a situação e ordem validada', () => {
    assert.deepEqual(m.normalizarEntrega({ situacao: 'solicitada' }, '2026-02-10'), { situacao: 'solicitada', solicitada_em: '2026-02-10', aprovada_em: null, entregue_em: null })
    const ent = m.normalizarEntrega({ situacao: 'entregue', solicitada_em: '2026-02-01', entregue_em: '2026-02-05' }, '2026-02-10')
    assert.equal(ent.aprovada_em, '2026-02-05')
    assert.deepEqual(m.normalizarEntrega({ situacao: 'aprovada', solicitada_em: '2026-02-01', aprovada_em: '2026-02-02', entregue_em: '2026-02-09' }, '2026-02-10').entregue_em, null)
    assert.throws(() => m.normalizarEntrega({ situacao: 'aprovada', solicitada_em: '2026-02-05', aprovada_em: '2026-02-01' }, '2026-02-10'), /anterior/)
    assert.throws(() => m.normalizarEntrega({ situacao: 'entregue', aprovada_em: '2026-02-05', entregue_em: '2026-02-01' }, '2026-02-10'), /anterior/)
})

test('concluir exige ≥1 entrega concluída e nenhuma pendente; cancelar é barrado após entrega', () => {
    const e = (...s) => s.map(situacao => ({ situacao }))
    assert.equal(m.podeConcluir(e()).ok, false)
    assert.equal(m.podeConcluir(e('solicitada')).ok, false)
    assert.equal(m.podeConcluir(e('entregue', 'aprovada')).ok, false)
    assert.equal(m.podeConcluir(e('entregue', 'entregue')).ok, true)
    assert.equal(m.podeCancelar(e('solicitada', 'aprovada')).ok, true)
    assert.equal(m.podeCancelar(e('entregue')).ok, false)
    assert.deepEqual(m.resumirEntregas(e('entregue', 'solicitada', 'aprovada')), { total: 3, solicitadas: 1, aprovadas: 1, entregues: 1, pendentes: 2 })
})

test('dias restantes até o prazo', () => {
    assert.equal(m.diasRestantes('2026-02-13', '2026-02-10'), 3)
    assert.equal(m.diasRestantes('2026-02-09', '2026-02-10'), -1)
    assert.equal(m.diasRestantes(null, '2026-02-10'), null)
})
