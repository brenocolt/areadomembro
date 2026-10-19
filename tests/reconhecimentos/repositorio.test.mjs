// Lógica de servidor (motor + gravações) contra um Supabase simulado.
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import * as repo from '../../src/lib/reconhecimentos/repositorio.ts'
import { parseRegistro, parseRegra } from '../../src/lib/reconhecimentos/validacao.ts'
import { OBS_RG_ANTERIOR } from '../../src/lib/reconhecimentos/constantes.ts'
import { ErroDeRequisicao } from '../../src/lib/reconhecimentos/erros.ts'
import { criarBanco, semear } from './fake-supabase.mjs'

const EMAIL = 'vp@produtivajunior.com.br'
function ambiente() {
    const { db, tabelas, ganchos } = criarBanco()
    const tipo = semear(tabelas)
    const projeto = { id: randomUUID(), nome: 'Projeto Alfa', status: 'Ativo' }
    tabelas.projetos.push(projeto)
    return { db, tabelas, ganchos, tipo, projeto }
}
const reg = (corpo) => parseRegistro({ data: '2026-03-10', ...corpo })
const erroCom = async (fn, status, msg) => assert.rejects(fn, (e) => e instanceof ErroDeRequisicao && e.status === status && (!msg || e.message === msg))

test('registrar projeto com RGs anteriores: 4 adiantadas geram R$12 (marco 2) e R$30 (marco 4)', async () => {
    const { db, tabelas, tipo, projeto } = ambiente()
    const r = await repo.registrarReconhecimento(db, EMAIL, reg({ tipo_id: tipo['RG / Projeto reconhecido'], projeto_id: projeto.id, adiantado: true, rgs_anteriores: 3, observacao: 'x' }))
    assert.equal(tabelas.reconhecimentos.length, 4)
    assert.equal(tabelas.reconhecimentos.filter(x => x.observacao === OBS_RG_ANTERIOR).length, 3)
    assert.ok(tabelas.reconhecimentos.every(x => x.projeto_nome === 'Projeto Alfa' && x.criado_por === EMAIL && x.adiantado))
    assert.equal(r.novas, 2)
    const chaves = tabelas.bonificacoes.map(b => b.marco).sort()
    assert.deepEqual(chaves, [2, 4])
    assert.equal(tabelas.bonificacao_eventos.length, 2)
    assert.ok(tabelas.bonificacao_eventos.every(e => e.evento === 'criada' && e.usuario === EMAIL && e.detalhe === 'Bonificação gerada automaticamente pela regra'))
    // idempotência
    assert.equal((await repo.sincronizarBonificacoes(db, EMAIL)).novas, 0)
})

test('registrar: o nome do projeto vem do banco, não do cliente; erros de regra de negócio', async () => {
    const { db, tabelas, tipo, projeto } = ambiente()
    await erroCom(() => repo.registrarReconhecimento(db, EMAIL, reg({ tipo_id: tipo['RG / Projeto reconhecido'] })), 400, 'Selecione o projeto')
    await erroCom(() => repo.registrarReconhecimento(db, EMAIL, reg({ tipo_id: tipo['RG / Projeto reconhecido'], projeto_id: randomUUID() })), 400, 'Projeto não encontrado')
    await erroCom(() => repo.registrarReconhecimento(db, EMAIL, reg({ tipo_id: tipo['SDR do Mês'] })), 400, 'Informe o nome da pessoa reconhecida')
    await erroCom(() => repo.registrarReconhecimento(db, EMAIL, reg({ tipo_id: tipo['Núcleo de Impacto'] })), 400, 'Selecione o núcleo')
    await erroCom(() => repo.registrarReconhecimento(db, EMAIL, reg({ tipo_id: tipo['Núcleo de Impacto'], nucleo: 'Vice Presidência' })), 400, 'Núcleo inválido')
    await erroCom(() => repo.registrarReconhecimento(db, EMAIL, reg({ tipo_id: randomUUID(), pessoa_nome: 'x' })), 400, 'Selecione o tipo de reconhecimento')
    tabelas.reconhecimento_tipos.find(t => t.id === tipo['SDR do Mês']).ativo = false
    await erroCom(() => repo.registrarReconhecimento(db, EMAIL, reg({ tipo_id: tipo['SDR do Mês'], pessoa_nome: 'Ana' })), 400, 'Selecione o tipo de reconhecimento')
    assert.equal(tabelas.reconhecimentos.length, 0, 'nada gravado quando a validação falha')
    await repo.registrarReconhecimento(db, EMAIL, reg({ tipo_id: tipo['RG / Projeto reconhecido'], projeto_id: projeto.id, observacao: 'nota' }))
    assert.equal(tabelas.reconhecimentos[0].adiantado, false)
    assert.equal(tabelas.reconhecimentos[0].observacao, 'nota')
})

test('pessoa e Núcleo de Impacto: uma bonificação por reconhecimento, sem multiplicar por membros (P-8)', async () => {
    const { db, tabelas, tipo } = ambiente()
    await repo.registrarReconhecimento(db, EMAIL, reg({ tipo_id: tipo['SDR do Mês'], pessoa_nome: ' Ana ' }))
    await repo.registrarReconhecimento(db, EMAIL, reg({ tipo_id: tipo['Núcleo de Impacto'], nucleo: 'CIT' }))
    const sdr = tabelas.bonificacoes.find(b => b.pessoa_nome === 'Ana')
    assert.equal(sdr.valor, 50); assert.equal(sdr.descricao_premiacao, 'R$ 50,00'); assert.equal(sdr.motivo, 'SDR do Mês'); assert.equal(sdr.tipo_nome, 'SDR do Mês')
    const nuc = tabelas.bonificacoes.find(b => b.nucleo_impacto === 'CIT')
    assert.equal(tabelas.bonificacoes.length, 2)
    assert.equal(nuc.pessoa_nome, 'CIT'); assert.equal(nuc.valor, 30); assert.equal(nuc.descricao_premiacao, 'R$ 30 por membro do núcleo')
    const rec = tabelas.reconhecimentos.find(r => r.nucleo_impacto === 'CIT')
    assert.equal(rec.pessoa_nome, 'CIT')
})

test('excluir reconhecimento: bonificação permanece (FK SET NULL), não é recriada, não roda o motor', async () => {
    const { db, tabelas, tipo } = ambiente()
    await repo.registrarReconhecimento(db, EMAIL, reg({ tipo_id: tipo['SDR do Mês'], pessoa_nome: 'Ana' }))
    const rec = tabelas.reconhecimentos[0]
    await repo.excluirReconhecimento(db, rec.id)
    assert.equal(tabelas.reconhecimentos.length, 0)
    assert.equal(tabelas.bonificacoes.length, 1)
    assert.equal(tabelas.bonificacoes[0].reconhecimento_id, null)
    assert.equal((await repo.sincronizarBonificacoes(db, EMAIL)).novas, 0)
    await erroCom(() => repo.excluirReconhecimento(db, rec.id), 404, 'Reconhecimento não encontrado')
})

test('ajustar RGs anteriores: aumenta, diminui (remove as mais recentes) e detecta "sem alteração"', async () => {
    const { db, tabelas, tipo, projeto } = ambiente()
    await repo.registrarReconhecimento(db, EMAIL, reg({ tipo_id: tipo['RG / Projeto reconhecido'], projeto_id: projeto.id, data: '2026-05-10', adiantado: false }))
    await erroCom(() => repo.ajustarRgsAnteriores(db, EMAIL, randomUUID(), 2), 400, 'Projeto sem reconhecimentos registrados')

    const sobe = await repo.ajustarRgsAnteriores(db, EMAIL, projeto.id, 3)
    assert.equal(sobe.semAlteracao, false)
    const anteriores = () => tabelas.reconhecimentos.filter(r => r.observacao === OBS_RG_ANTERIOR)
    assert.equal(anteriores().length, 3)
    assert.ok(anteriores().every(r => r.adiantado && r.data === '2026-05-10' && r.tipo_id === tipo['RG / Projeto reconhecido'] && r.criado_por === EMAIL))
    assert.equal(sobe.novas, 1, '3 adiantadas -> marco 2 do ciclo R$12')

    assert.equal((await repo.ajustarRgsAnteriores(db, EMAIL, projeto.id, 3)).semAlteracao, true)
    const antes = anteriores().map(r => r.id)
    const desce = await repo.ajustarRgsAnteriores(db, EMAIL, projeto.id, 1)
    assert.equal(anteriores().length, 1)
    assert.ok(antes.includes(anteriores()[0].id))
    assert.equal(tabelas.bonificacoes.length, 1, 'bonificações já geradas são mantidas')
    assert.equal(desce.novas, 0)
    await repo.ajustarRgsAnteriores(db, EMAIL, projeto.id, 0)
    assert.equal(anteriores().length, 0)
    assert.equal(tabelas.reconhecimentos.length, 1, 'o registro "real" nunca é removido pelo ajuste')
})

test('entregar e cancelar: grava campos e eventos, e só a partir de disponivel/expirada', async () => {
    const { db, tabelas, tipo } = ambiente()
    for (const nome of ['Ana', 'Bia', 'Caio']) await repo.registrarReconhecimento(db, EMAIL, reg({ tipo_id: tipo['SDR do Mês'], pessoa_nome: nome }))
    const [b1, b2, b3] = tabelas.bonificacoes
    b3.status = 'expirada'

    await repo.entregarBonificacao(db, 'outro@pj.com', b1.id, { entregue_para: 'Ana; Bia', observacao: 'no café' })
    assert.equal(b1.status, 'entregue'); assert.equal(b1.entregue_por, 'outro@pj.com'); assert.equal(b1.entregue_para, 'Ana; Bia'); assert.equal(b1.observacao_entrega, 'no café'); assert.ok(b1.entregue_em)
    const ev = tabelas.bonificacao_eventos.filter(e => e.bonificacao_id === b1.id && e.evento === 'entregue')
    assert.equal(ev.length, 1); assert.equal(ev[0].detalhe, 'Entregue para: Ana; Bia — no café'); assert.equal(ev[0].usuario, 'outro@pj.com')

    await erroCom(() => repo.entregarBonificacao(db, EMAIL, b1.id, { entregue_para: null, observacao: null }), 409)
    await erroCom(() => repo.cancelarBonificacao(db, EMAIL, b1.id, 'Duplicidade'), 409)
    await erroCom(() => repo.entregarBonificacao(db, EMAIL, randomUUID(), { entregue_para: null, observacao: null }), 404)

    await repo.cancelarBonificacao(db, EMAIL, b2.id, 'Duplicidade — lançado 2x')
    assert.equal(b2.status, 'cancelada'); assert.equal(b2.justificativa_cancelamento, 'Duplicidade — lançado 2x'); assert.equal(b2.cancelada_por, EMAIL)

    await repo.entregarBonificacao(db, EMAIL, b3.id, { entregue_para: null, observacao: null }) // expirada ainda pode ser entregue
    assert.equal(b3.status, 'entregue')
    assert.equal(tabelas.bonificacao_eventos.find(e => e.bonificacao_id === b3.id && e.evento === 'entregue').detalhe, null)
})

test('expiração: disponivel com prazo vencido vira expirada com evento do "sistema"', async () => {
    const { db, tabelas, tipo } = ambiente()
    tabelas.regras_bonificacao.find(r => r.nome === 'SDR do Mês').prazo_dias = 30
    await repo.registrarReconhecimento(db, EMAIL, reg({ tipo_id: tipo['SDR do Mês'], pessoa_nome: 'Ana', data: '2026-01-01' }))
    assert.equal(tabelas.bonificacoes[0].prazo_limite, '2026-01-31')
    assert.equal(tabelas.bonificacoes[0].status, 'disponivel', 'recém-criada não expira na mesma execução')
    const r = await repo.sincronizarBonificacoes(db, EMAIL)
    assert.deepEqual(r, { novas: 0, expiradas: 1 })
    assert.equal(tabelas.bonificacoes[0].status, 'expirada')
    const ev = tabelas.bonificacao_eventos.find(e => e.evento === 'expirada')
    assert.equal(ev.usuario, 'sistema'); assert.equal(ev.detalhe, 'Prazo limite 2026-01-31 ultrapassado')
    assert.deepEqual(await repo.sincronizarBonificacoes(db, EMAIL), { novas: 0, expiradas: 0 })
})

test('salvar regra roda o motor; salvar prazo padrão não; tipo novo ganha ordem n+1', async () => {
    const { db, tabelas, tipo } = ambiente()
    await repo.registrarReconhecimento(db, EMAIL, reg({ tipo_id: tipo['Piloto de Elite'], pessoa_nome: 'Duda' }))
    assert.equal(tabelas.bonificacoes.length, 0, 'Piloto de Elite não tem regra semeada (P-1 pendente)')

    await repo.salvarPrazoPadrao(db, 20)
    assert.equal(tabelas.bonificacoes_config[0].prazo_padrao_dias, 20)
    assert.equal(tabelas.bonificacoes.length, 0, 'prazo padrão não dispara o motor')

    const nova = parseRegra({ nome: 'Piloto', tipo_id: tipo['Piloto de Elite'], criterio: 'por_reconhecimento', tipo_premiacao: 'financeira', valor: 50, descricao_premiacao: 'R$ 50,00' })
    const r = await repo.salvarRegra(db, EMAIL, null, nova)
    assert.equal(r.novas, 1)
    assert.equal(tabelas.bonificacoes[0].prazo_limite, '2026-03-30', 'prazo padrão (20 dias) aplicado a partir de 2026-03-10')

    const idRegra = tabelas.regras_bonificacao.find(x => x.nome === 'Piloto').id
    await repo.salvarRegra(db, EMAIL, idRegra, { ...nova, valor: 80 })
    assert.equal(tabelas.bonificacoes[0].valor, 50, 'bonificações geradas mantêm o valor original (snapshot)')
    await erroCom(() => repo.salvarRegra(db, EMAIL, randomUUID(), nova), 404, 'Regra não encontrada')
    await erroCom(() => repo.salvarRegra(db, EMAIL, null, { ...nova, tipo_id: randomUUID() }), 400, 'Selecione o tipo de reconhecimento')

    await repo.criarTipo(db, 'Novo tipo')
    const criado = tabelas.reconhecimento_tipos.find(t => t.nome === 'Novo tipo')
    assert.deepEqual([criado.escopo, criado.ordem], ['pessoa', 8])

    tabelas.bonificacoes_config.length = 0
    await repo.salvarPrazoPadrao(db, null)
    assert.deepEqual(tabelas.bonificacoes_config.map(c => c.prazo_padrao_dias), [null], 'cria a linha de configuração se não existir')
})

test('concorrência: chave já criada por outra execução não derruba o lote (ON CONFLICT DO NOTHING)', async () => {
    const { db, tabelas, tipo, ganchos } = ambiente()
    await repo.registrarReconhecimento(db, EMAIL, reg({ tipo_id: tipo['SDR do Mês'], pessoa_nome: 'Ana' }))
    tabelas.bonificacoes.length = 0; tabelas.bonificacao_eventos.length = 0
    const rec = tabelas.reconhecimentos[0]
    const regra = tabelas.regras_bonificacao.find(r => r.nome === 'SDR do Mês')
    // Outra sincronização grava a mesma chave entre a leitura e a gravação desta.
    ganchos.antesDeUpsert = (t) => { ganchos.antesDeUpsert = null; t.bonificacoes.push({ id: randomUUID(), marco_chave: `${regra.id}:rec:${rec.id}`, status: 'disponivel' }) }
    const r = await repo.sincronizarBonificacoes(db, EMAIL)
    assert.deepEqual(r, { novas: 0, expiradas: 0 })
    assert.equal(tabelas.bonificacoes.length, 1)
})

test('listagens paginam além de 1000 linhas', async () => {
    const { db, tabelas, tipo } = ambiente()
    for (let i = 0; i < 2500; i++) {
        tabelas.reconhecimentos.push({ id: randomUUID(), tipo_id: tipo['SDR do Mês'], data: '2026-01-01', pessoa_nome: `P${i}`, created_at: `2026-01-01T00:00:${String(i % 60).padStart(2, '0')}Z` })
    }
    const dados = await repo.listarDados(db)
    assert.equal(dados.reconhecimentos.length, 2500)
    assert.equal(new Set(dados.reconhecimentos.map(r => r.id)).size, 2500)
    assert.equal(dados.reconhecimentos[0].reconhecimento_tipos.nome, 'SDR do Mês')
    assert.equal(dados.tipos.length, 7); assert.equal(dados.regras.length, 6); assert.deepEqual(dados.config && Object.keys(dados.config).includes('prazo_padrao_dias'), true)
    const r = await repo.sincronizarBonificacoes(db, EMAIL)
    assert.equal(r.novas, 2500, 'o motor enxerga todos os reconhecimentos, não só os 1000 primeiros')
})

test('projetos: só ativos, em ordem alfabética', async () => {
    const { db, tabelas } = ambiente()
    tabelas.projetos.push({ id: randomUUID(), nome: 'Zeta', status: 'Ativo' }, { id: randomUUID(), nome: 'Beta', status: 'Concluído' })
    const lista = await repo.listarProjetos(db)
    assert.deepEqual(lista.map(p => p.nome), ['Projeto Alfa', 'Zeta'])
})
