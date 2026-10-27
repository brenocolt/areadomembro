// Reversão de saque de PIPJ aprovado: devolve o saldo, registra o estorno e reabre a solicitação como PENDENTE.
import test from 'node:test'
import assert from 'node:assert/strict'
import { criarBanco } from './fake-supabase.mjs'
import { ErroPipj, PREFIXO_ESTORNO, reverterSaqueAprovado } from '../../src/lib/pipj-saque.ts'

const COLAB = 'c1'
function cenario({ saldo = 10, status = 'APROVADO', valor = 138.06, tipo = 'saque_pipj' } = {}) {
    return criarBanco({
        solicitacoes_saque: [{ id: 's1', colaborador_id: COLAB, valor, status, tipo, data_aprovacao: '2026-10-27T12:00:00Z', aprovado_por: 'thiago' }],
        colaboradores: [{ id: COLAB, saldo_pipj: saldo }],
        transacoes_pipj: [],
    })
}
const reverter = (b, extra = {}) => reverterSaqueAprovado(b.db, { id: 's1', motivo: 'valor errado', ator: 'Ana Admin', ...extra })
const rejeita = (p, status, re) => assert.rejects(p, (e) => e instanceof ErroPipj && e.status === status && re.test(e.message))

test('reverte um saque aprovado: devolve o saldo, registra o estorno com autor e motivo e reabre como PENDENTE', async () => {
    const b = cenario()
    const r = await reverter(b)
    assert.deepEqual(r, { valor: 138.06, colaboradorId: COLAB, novoSaldo: 148.06 })
    assert.equal(b.tabelas.colaboradores[0].saldo_pipj, 148.06)
    const s = b.tabelas.solicitacoes_saque[0]
    assert.deepEqual([s.status, s.data_aprovacao, s.aprovado_por], ['PENDENTE', null, null])
    assert.equal(b.tabelas.transacoes_pipj.length, 1)
    const t = b.tabelas.transacoes_pipj[0]
    assert.equal(t.tipo, 'ENTRADA'); assert.equal(t.status, 'CREDITADO'); assert.equal(t.valor, 138.06)
    assert.equal(t.descricao, `${PREFIXO_ESTORNO}: valor errado`); assert.equal(t.realizado_por, 'Ana Admin')
    assert.ok(!('periodo' in t) && !('lancamento_id' in t), 'não entra nos totais por período de lançamento')
})

test('só reverte saque APROVADO (pendente/rejeitado/de outro tipo são recusados e nada muda)', async () => {
    for (const status of ['PENDENTE', 'REJEITADO']) {
        const b = cenario({ status })
        await rejeita(reverter(b), 409, /APROVADO/)
        assert.equal(b.tabelas.colaboradores[0].saldo_pipj, 10); assert.equal(b.tabelas.transacoes_pipj.length, 0)
    }
    const m = cenario({ tipo: 'milhas' })
    await rejeita(reverter(m), 400, /saques de PIPJ/)
    const n = cenario(); n.tabelas.solicitacoes_saque.length = 0
    await rejeita(reverter(n), 404, /não encontrada/)
})

test('exige motivo', async () => {
    const b = cenario()
    await rejeita(reverter(b, { motivo: '  ' }), 400, /motivo/)
    await rejeita(reverter(b, { motivo: 'x'.repeat(301) }), 400, /longo/)
    assert.equal(b.tabelas.solicitacoes_saque[0].status, 'APROVADO')
})

test('duas reversões simultâneas: só uma vale (saldo devolvido uma única vez)', async () => {
    const b = cenario()
    const r = await Promise.allSettled([reverter(b), reverter(b)])
    assert.equal(r.filter(x => x.status === 'fulfilled').length, 1)
    const rej = r.find(x => x.status === 'rejected')
    assert.ok(rej.reason instanceof ErroPipj && rej.reason.status === 409)
    assert.equal(b.tabelas.colaboradores[0].saldo_pipj, 148.06)
    assert.equal(b.tabelas.transacoes_pipj.length, 1)
})

test('saldo alterado por outra operação no meio: relê e soma sobre o saldo novo (sem perder a outra alteração)', async () => {
    const b = cenario({ saldo: 10 })
    let vezes = 0
    b.ganchos.aposLeitura = async (tabela) => { if (tabela === 'colaboradores' && vezes++ === 0) b.tabelas.colaboradores[0].saldo_pipj = 50 }
    const r = await reverter(b)
    assert.equal(r.novoSaldo, 188.06)
    assert.equal(b.tabelas.colaboradores[0].saldo_pipj, 188.06)
})

test('saldo nulo conta como zero', async () => {
    const b = cenario({ saldo: null })
    assert.equal((await reverter(b)).novoSaldo, 138.06)
})

test('falha ao registrar o estorno: tudo volta ao que era (continua APROVADO, saldo igual)', async () => {
    const b = cenario()
    b.falhas.add('transacoes_pipj.insert')
    await rejeita(reverter(b), 500, /Nada foi alterado/)
    const s = b.tabelas.solicitacoes_saque[0]
    assert.deepEqual([s.status, s.aprovado_por, s.data_aprovacao], ['APROVADO', 'thiago', '2026-10-27T12:00:00Z'])
    assert.equal(b.tabelas.colaboradores[0].saldo_pipj, 10)
})

test('saldo em disputa constante: desfaz estorno e reserva, e avisa para tentar de novo', async () => {
    const b = cenario()
    b.ganchos.aposLeitura = async (tabela) => { if (tabela === 'colaboradores') b.tabelas.colaboradores[0].saldo_pipj += 1 }
    await rejeita(reverter(b), 409, /tente de novo/)
    assert.equal(b.tabelas.solicitacoes_saque[0].status, 'APROVADO')
    assert.equal(b.tabelas.transacoes_pipj.length, 0, 'o estorno inserido foi removido')
})
