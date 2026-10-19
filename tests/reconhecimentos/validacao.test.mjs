import test from 'node:test'
import assert from 'node:assert/strict'
import {
    parseRegistro, parseAjuste, parseRegra, parseTipo, parsePrazoPadrao, parseEntrega, parseCancelamento, validarNucleo, exigirUuid,
} from '../../src/lib/reconhecimentos/validacao.ts'
import { ErroDeRequisicao } from '../../src/lib/reconhecimentos/erros.ts'

const U = '123e4567-e89b-42d3-a456-426614174000'
const erro = (fn, msg) => assert.throws(fn, (e) => e instanceof ErroDeRequisicao && (msg === undefined || e.message === msg))

test('corpo inválido', () => {
    for (const f of [parseRegistro, parseAjuste, parseRegra, parseTipo, parsePrazoPadrao, parseEntrega, parseCancelamento]) {
        for (const lixo of [null, undefined, 'x', 3, []]) erro(() => f(lixo), 'Corpo da requisição inválido.')
    }
})

test('registro: mensagens e limites', () => {
    erro(() => parseRegistro({ data: '2026-01-01' }), 'Selecione o tipo de reconhecimento')
    erro(() => parseRegistro({ tipo_id: U, data: '2026-02-30' }), 'Informe uma data válida')
    erro(() => parseRegistro({ tipo_id: U, data: '01/01/2026' }), 'Informe uma data válida')
    erro(() => parseRegistro({ tipo_id: U, data: '2026-01-01', projeto_id: 'abc' }), 'Selecione o projeto')
    erro(() => parseRegistro({ tipo_id: U, data: '2026-01-01', rgs_anteriores: 501 }))
    const ok = parseRegistro({ tipo_id: U, data: '2026-01-01', projeto_id: U, adiantado: true, rgs_anteriores: '3.7', observacao: '', pessoa_nome: '  Ana  ' })
    assert.deepEqual(ok, { tipo_id: U, data: '2026-01-01', projeto_id: U, pessoa_nome: 'Ana', nucleo: '', adiantado: true, rgs_anteriores: 3, observacao: null })
    assert.equal(parseRegistro({ tipo_id: U, data: '2026-01-01', adiantado: 'true' }).adiantado, false, 'só boolean true conta')
    assert.equal(parseRegistro({ tipo_id: U, data: '2026-01-01', rgs_anteriores: -4 }).rgs_anteriores, 0)
})

test('núcleo: só os 7 originais', () => {
    for (const n of ['Gestão de Pessoas', 'Presidência', 'Vice-Presidência', 'Marketing', 'CIT', 'CIEP', 'CS']) assert.equal(validarNucleo(n), n)
    erro(() => validarNucleo(''), 'Selecione o núcleo')
    erro(() => validarNucleo('Vice Presidência'), 'Núcleo inválido') // grafia do sistema atual NÃO vale para a lista própria da aba
    erro(() => validarNucleo('Projetos'), 'Núcleo inválido')
})

test('regra: validações e normalização como no original', () => {
    const base = { nome: ' Regra ', tipo_id: U, criterio: 'acumulado', tipo_premiacao: 'financeira' }
    erro(() => parseRegra({ ...base, nome: '   ' }), 'Informe o nome da regra')
    erro(() => parseRegra({ ...base, tipo_id: '' }), 'Selecione o tipo de reconhecimento')
    erro(() => parseRegra({ ...base, criterio: 'xx' }))
    erro(() => parseRegra({ ...base, tipo_premiacao: 'xx' }))
    erro(() => parseRegra({ ...base, ciclo: -1 }))
    erro(() => parseRegra({ ...base, valor: -5 }))
    erro(() => parseRegra({ ...base, prazo_dias: 1.5 }))
    const r = parseRegra({ ...base, quantidade_necessaria: '', ciclo: '', valor: '', prazo_dias: '', requer_projeto_adiantado: true })
    assert.deepEqual(r, {
        nome: 'Regra', tipo_id: U, criterio: 'acumulado', quantidade_necessaria: 1, ciclo: 0,
        requer_rg_adiantada: true, requer_projeto_adiantado: false, tipo_premiacao: 'financeira', valor: 0,
        descricao_premiacao: '', prazo_dias: null, ativo: true,
    })
    assert.equal(parseRegra({ ...base, prazo_dias: 0 }).prazo_dias, 0)
    assert.equal(parseRegra({ ...base, ativo: false }).ativo, false)
})

test('prazo padrão, tipo, entrega e cancelamento', () => {
    assert.deepEqual(parsePrazoPadrao({ prazo_padrao_dias: '' }), { prazo_padrao_dias: null })
    assert.deepEqual(parsePrazoPadrao({ prazo_padrao_dias: '30' }), { prazo_padrao_dias: 30 })
    erro(() => parsePrazoPadrao({ prazo_padrao_dias: -1 }))
    erro(() => parsePrazoPadrao({ prazo_padrao_dias: 'abc' }))
    erro(() => parseTipo({ nome: '  ' }))
    assert.equal(parseTipo({ nome: ' Novo ' }).nome, 'Novo')

    assert.deepEqual(parseEntrega({ nomes: [' Ana ', 'ana', 'Bia', ''], observacao: 'ok' }), { entregue_para: 'Ana; Bia', observacao: 'ok' })
    assert.deepEqual(parseEntrega({}), { entregue_para: null, observacao: null })
    erro(() => parseEntrega({ nomes: 'Ana' }))

    erro(() => parseCancelamento({ motivo: '' }), 'Selecione a justificativa')
    erro(() => parseCancelamento({ motivo: 'Inventado' }), 'Selecione a justificativa')
    erro(() => parseCancelamento({ motivo: 'Outro', detalhe: '  ' }), 'Descreva a justificativa')
    assert.equal(parseCancelamento({ motivo: 'Outro', detalhe: ' porque ' }).justificativa, 'porque')
    assert.equal(parseCancelamento({ motivo: 'Duplicidade' }).justificativa, 'Duplicidade')
    assert.equal(parseCancelamento({ motivo: 'Duplicidade', detalhe: 'lançado 2x' }).justificativa, 'Duplicidade — lançado 2x')
})

test('uuid e ajuste', () => {
    assert.equal(exigirUuid(U, 'x'), U)
    erro(() => exigirUuid("1' or '1'='1", 'inválido'), 'inválido')
    erro(() => exigirUuid(undefined, 'inválido'))
    assert.deepEqual(parseAjuste({ projeto_id: U, quantidade: '4.9' }), { projeto_id: U, quantidade: 4 })
    erro(() => parseAjuste({ projeto_id: 'x', quantidade: 1 }), 'Selecione o projeto')
})
