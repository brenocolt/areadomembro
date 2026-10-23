// Validação das entradas (o servidor repete tudo que a interface valida) e textos de apresentação.
import test from 'node:test'
import assert from 'node:assert/strict'
import * as v from '../../src/lib/reconhecimentos/validacao.ts'
import * as a from '../../src/lib/reconhecimentos/apresentacao.ts'
import { ErroDeRequisicao } from '../../src/lib/reconhecimentos/erros.ts'
import { adicionarDias, dataISOValida, formatarData, hojeISO } from '../../src/lib/reconhecimentos/datas.ts'

const U = '11111111-1111-4111-8111-111111111111'
const HOJE = '2026-02-10'
const tipo = (escopo, usa_periodo = false) => ({ id: U, nome: 't', escopo, usa_periodo, ativo: true })
const erro = (fn, re) => assert.throws(fn, (e) => e instanceof ErroDeRequisicao && re.test(e.message))

test('reconhecimento de projeto (RG): projeto, número e data obrigatórios; sem data futura', () => {
    const ok = v.validarCamposReconhecimento({ data_reconhecimento: HOJE, projeto_id: U, numero_rg: '5', observacoes: ' x ' }, tipo('projeto'), HOJE)
    assert.deepEqual(ok, { data_reconhecimento: HOJE, projeto_id: U, colaborador_id: null, nucleo: null, numero_rg: 5, periodo_referencia: null, observacoes: 'x' })
    erro(() => v.validarCamposReconhecimento({ data_reconhecimento: HOJE, projeto_id: U }, tipo('projeto'), HOJE), /número da RG/)
    erro(() => v.validarCamposReconhecimento({ data_reconhecimento: HOJE, numero_rg: 1 }, tipo('projeto'), HOJE), /projeto/)
    erro(() => v.validarCamposReconhecimento({ data_reconhecimento: HOJE, projeto_id: U, numero_rg: 0 }, tipo('projeto'), HOJE), /Número da RG/)
    erro(() => v.validarCamposReconhecimento({ data_reconhecimento: '2026-02-11', projeto_id: U, numero_rg: 1 }, tipo('projeto'), HOJE), /futura/)
    erro(() => v.validarCamposReconhecimento({ data_reconhecimento: '2026-02-30', projeto_id: U, numero_rg: 1 }, tipo('projeto'), HOJE), /data/)
})

test('individual e núcleo: campos por escopo e período de referência normalizado para o dia 1', () => {
    const ind = v.validarCamposReconhecimento({ data_reconhecimento: HOJE, colaborador_id: U, periodo_referencia: '2026-01' }, tipo('colaborador', true), HOJE)
    assert.equal(ind.periodo_referencia, '2026-01-01'); assert.equal(ind.colaborador_id, U); assert.equal(ind.projeto_id, null)
    assert.equal(v.validarCamposReconhecimento({ data_reconhecimento: HOJE, colaborador_id: U, periodo_referencia: '2026-01' }, tipo('colaborador', false), HOJE).periodo_referencia, null)
    erro(() => v.validarCamposReconhecimento({ data_reconhecimento: HOJE }, tipo('colaborador'), HOJE), /colaborador/)
    erro(() => v.validarCamposReconhecimento({ data_reconhecimento: HOJE, colaborador_id: 'x' }, tipo('colaborador'), HOJE), /colaborador/)
    erro(() => v.validarCamposReconhecimento({ data_reconhecimento: HOJE, colaborador_id: U, periodo_referencia: '2026-13' }, tipo('colaborador', true), HOJE), /Período/)
    assert.equal(v.validarCamposReconhecimento({ data_reconhecimento: HOJE, nucleo: 'Marketing' }, tipo('nucleo'), HOJE).nucleo, 'Marketing')
    erro(() => v.validarCamposReconhecimento({ data_reconhecimento: HOJE, nucleo: 'Inexistente' }, tipo('nucleo'), HOJE), /Núcleo inválido/)
    erro(() => v.validarCamposReconhecimento({ data_reconhecimento: HOJE }, tipo('nucleo'), HOJE), /núcleo/)
    erro(() => v.validarCamposReconhecimento(null, tipo('nucleo'), HOJE), /inválido/)
})

test('regras: gatilho, premiação e valor; marcos exigem "a partir de"; nada de valor padrão', () => {
    const base = { nome: 'R', tipo_id: U, gatilho: 'cada_reconhecimento', tipo_premiacao: 'simbolica' }
    const r = v.parseRegra(base)
    assert.equal(r.valor, null); assert.equal(r.prazo_dias, null); assert.equal(r.ativo, true); assert.equal(r.a_partir_de, null)
    const marcos = v.parseRegra({ ...base, gatilho: 'marcos_de_rg', a_partir_de: '4', repetir_a_cada: '4', valor: '150.5', prazo_dias: '30' })
    assert.deepEqual([marcos.a_partir_de, marcos.repetir_a_cada, marcos.valor, marcos.prazo_dias], [4, 4, 150.5, 30])
    erro(() => v.parseRegra({ ...base, gatilho: 'marcos_de_rg' }), /a partir de qual RG/)
    erro(() => v.parseRegra({ ...base, gatilho: 'x' }), /quando/)
    erro(() => v.parseRegra({ ...base, tipo_premiacao: 'x' }), /premiação/)
    erro(() => v.parseRegra({ ...base, valor: -1 }), /Valor/)
    erro(() => v.parseRegra({ ...base, nome: ' ' }), /nome/)
    erro(() => v.parseRegra({ ...base, tipo_id: 'x' }), /tipo/)
})

test('entregas: ids únicos e válidos, situação conhecida, limite por lote', () => {
    const e = v.parseNovasEntregas({ colaborador_ids: [U, U], situacao: 'aprovada', aprovada_em: '2026-02-01' })
    assert.deepEqual(e.colaborador_ids, [U]); assert.equal(e.situacao, 'aprovada'); assert.equal(e.aprovada_em, '2026-02-01')
    assert.equal(v.parseNovasEntregas({ colaborador_ids: [U] }).situacao, 'solicitada')
    erro(() => v.parseNovasEntregas({ colaborador_ids: [] }), /ao menos um/)
    erro(() => v.parseNovasEntregas({ colaborador_ids: ['x'] }), /inválido/)
    erro(() => v.parseNovasEntregas({ colaborador_ids: [U], situacao: 'paga' }), /Situação/)
    erro(() => v.parseNovasEntregas({ colaborador_ids: [U], entregue_em: '31/12/2026' }), /inválida/)
    erro(() => v.parseAtualizacaoEntrega({ situacao: 'x' }), /Situação/)
})

test('tipos, núcleos e motivos', () => {
    assert.deepEqual(v.parseNovoTipo({ nome: ' Destaque ', usa_periodo: true, escopo: 'projeto' }), { nome: 'Destaque', escopo: 'colaborador', usa_periodo: true })
    erro(() => v.parseNovoTipo({ nome: '' }), /nome/)
    assert.deepEqual(v.parseAtualizacaoTipo({ ativo: false }), { ativo: false })
    erro(() => v.parseAtualizacaoTipo({}), /Nada/)
    assert.deepEqual(v.parseNucleo({ nucleo: 'Marketing', elegivel: false }), { nucleo: 'Marketing', elegivel: false })
    erro(() => v.parseNucleo({ nucleo: 'Marketing' }), /elegível/)
    assert.equal(v.parseMotivo({ motivo: ' duplicado ' }, 'm'), 'duplicado')
    erro(() => v.parseMotivo({ motivo: 'ab' }, 'Informe o motivo.'), /motivo/)
})

test('datas: America/Sao_Paulo e aritmética de calendário', () => {
    assert.equal(hojeISO(new Date('2026-02-10T02:30:00Z')), '2026-02-09')   // 23:30 em São Paulo
    assert.equal(hojeISO(new Date('2026-02-10T03:00:00Z')), '2026-02-10')
    assert.equal(adicionarDias('2026-02-27', 2), '2026-03-01')
    assert.equal(adicionarDias('2026-12-31', 1), '2027-01-01')
    assert.equal(formatarData('2026-02-09'), '09/02/2026')
    assert.equal(formatarData('2026-02-10T02:30:00Z'), '09/02/2026')
    assert.ok(dataISOValida('2024-02-29')); assert.ok(!dataISOValida('2026-02-29'))
})

test('apresentação: sujeito, premiação sem valor inventado, de→para e eventos', () => {
    assert.equal(a.sujeitoDe({ projeto_nome: 'Prorestaure' }), 'Prorestaure'); assert.equal(a.sujeitoDe({ nucleo: 'CIT' }), 'CIT'); assert.equal(a.sujeitoDe({}), 'Sem identificação')
    assert.equal(a.textoPremiacao({ descricao_premiacao: 'Brinde', valor: 10, tipo_premiacao: 'item' }), 'Brinde')
    assert.match(a.textoPremiacao({ descricao_premiacao: '', valor: 150, tipo_premiacao: 'financeira' }), /150,00/)
    assert.equal(a.textoPremiacao({ descricao_premiacao: '', valor: null, tipo_premiacao: 'financeira' }), 'Premiação a definir')
    assert.equal(a.textoPremiacao({ descricao_premiacao: '', valor: null, tipo_premiacao: 'simbolica' }), 'Reconhecimento simbólico')
    assert.deepEqual(a.linhasDeAlteracao({ numero_rg: { de: 5, para: 6 }, projeto_id: { de: 'a', para: 'b' }, data_reconhecimento: { de: '2026-02-01', para: '2026-02-02' } }),
        ['Nº da RG: 5 → 6', 'Data: 01/02/2026 → 02/02/2026'])
    const ctx = { tipos: [{ id: 't', nome: 'RG' }], bonificacoes: [] }
    const ev = (acao, alteracoes, detalhe = null) => ({ id: '1', entidade: 'entrega', entidade_id: null, reconhecimento_id: null, bonificacao_id: null, acao, alteracoes, detalhe, usuario_email: 'vp@pj.com', created_at: '2026-02-10T12:00:00Z' })
    assert.equal(a.descreverEvento(ev('situacao_entregue', { situacao: { de: 'aprovada', para: 'entregue' } }, 'João'), ctx).titulo, 'João: Aprovada → Entregue')
    assert.equal(a.descreverEvento(ev('status_cancelada', { justificativa_cancelamento: { de: null, para: 'Duplicidade' } }), ctx).detalhes[0], 'Justificativa: Duplicidade')
    assert.equal(a.descreverEvento(ev('criado', { tipo_id: 't', projeto_nome: 'Prorestaure', numero_rg: 5 }), ctx).titulo, 'Reconhecimento registrado — RG · Prorestaure · 5ª RG')
})
