// Regras do formulário "Solicitar Pagamento ou Reembolso" (mesma validação
// do navegador e do servidor).
import test from 'node:test'
import assert from 'node:assert/strict'
import { camposVisiveis, lerValorReais, validarSolicitacao, CENTROS_CUSTO } from '../../src/lib/pagamentos-formulario.ts'

const base = {
    tipo: 'REEMBOLSO', descricao: 'Lanche da capacitação', fornecedor: 'Padaria X', valor: '1.234,56',
    centro_custo: 'GP', categoria: 'Endomarketing', chave_pix: 'fulano@gmail.com', eh_pipj: 'Não', eh_retirada_milha: 'Não',
}
const um = { comprovantes: 1, workday: 0 }

test('reembolso completo é aceito e normalizado', () => {
    const r = validarSolicitacao(base, um)
    assert.equal(r.ok, true)
    assert.equal(r.dados.valor, 1234.56)
    assert.equal(r.dados.eh_pipj, false)
    assert.equal(r.dados.forma_pagamento, null)
    assert.equal(r.dados.chave_pix, 'fulano@gmail.com')
})

test('PAGAMENTO mostra forma de pagamento e dados bancários; REEMBOLSO esconde e mostra Pix', () => {
    assert.deepEqual([camposVisiveis({ tipo: 'PAGAMENTO' }).forma_pagamento, camposVisiveis({ tipo: 'PAGAMENTO' }).dados_bancarios, camposVisiveis({ tipo: 'PAGAMENTO' }).chave_pix], [true, true, false])
    assert.deepEqual([camposVisiveis({ tipo: 'REEMBOLSO' }).forma_pagamento, camposVisiveis({ tipo: 'REEMBOLSO' }).dados_bancarios, camposVisiveis({ tipo: 'REEMBOLSO' }).chave_pix], [false, false, true])
})

test('campos ocultos são descartados (não vão para o banco)', () => {
    const r = validarSolicitacao({ ...base, forma_pagamento: 'Boleto', dados_bancarios: 'xx' }, um)
    assert.equal(r.ok, true)
    assert.equal(r.dados.forma_pagamento, null)
    assert.equal(r.dados.dados_bancarios, null)
    const p = validarSolicitacao({ ...base, tipo: 'PAGAMENTO', forma_pagamento: 'Boleto', chave_pix: '' }, um)
    assert.equal(p.ok, true)
    assert.equal(p.dados.chave_pix, null)
})

test('PAGAMENTO: transferência exige dados bancários; boleto não', () => {
    const t = validarSolicitacao({ ...base, tipo: 'PAGAMENTO', forma_pagamento: 'Transferência / Cartão de crédito' }, um)
    assert.equal(t.ok, false); assert.ok(t.erros.dados_bancarios)
    const sem = validarSolicitacao({ ...base, tipo: 'PAGAMENTO' }, um)
    assert.equal(sem.ok, false); assert.ok(sem.erros.forma_pagamento)
})

test('obrigatórios e comprovante', () => {
    const r = validarSolicitacao({}, { comprovantes: 0, workday: 0 })
    assert.equal(r.ok, false)
    for (const c of ['tipo', 'descricao', 'fornecedor', 'valor', 'centro_custo', 'eh_pipj', 'eh_retirada_milha', 'comprovantes']) assert.ok(r.erros[c], c)
})

test('categorias seguem o centro de custo; opção de outro centro é recusada', () => {
    assert.equal(validarSolicitacao({ ...base, categoria: 'Tráfego pago' }, um).ok, false)
    const mej = validarSolicitacao({ ...base, centro_custo: 'Eventos MEJ', categoria: 'Hospedagem', evento_mej: 'ENEJ' }, um)
    assert.equal(mej.ok, true); assert.equal(mej.dados.evento_mej, 'ENEJ')
    assert.ok(validarSolicitacao({ ...base, centro_custo: 'Eventos MEJ', categoria: 'Hospedagem', evento_mej: 'Evento inventado' }, um).erros.evento_mej)
    const semEvento = validarSolicitacao({ ...base, centro_custo: 'Eventos MEJ', categoria: 'Hospedagem' }, um)
    assert.ok(semEvento.erros.evento_mej)
    const pres = validarSolicitacao({ ...base, centro_custo: 'Feira de carreira', categoria: 'Endomarketing', outra_categoria: 'Brindes' }, um)
    assert.equal(pres.ok, true); assert.equal(pres.dados.categoria, null); assert.equal(pres.dados.outra_categoria, 'Brindes')
    assert.equal(CENTROS_CUSTO.length, 9)
})

test('anexo Workday/SDR só aparece na categoria Workday', () => {
    assert.equal(camposVisiveis({ centro_custo: 'VP', categoria: 'Workday' }).anexo_workday, true)
    assert.equal(camposVisiveis({ centro_custo: 'VP', categoria: 'Manutenção' }).anexo_workday, false)
    assert.ok(validarSolicitacao(base, { comprovantes: 1, workday: 1 }).erros.anexos_workday)
    assert.equal(validarSolicitacao({ ...base, centro_custo: 'VP', categoria: 'Workday' }, { comprovantes: 1, workday: 2 }).ok, true)
})

test('retirada por milha exige o tipo', () => {
    assert.ok(validarSolicitacao({ ...base, eh_retirada_milha: 'Sim' }, um).erros.tipo_retirada_milha)
    assert.equal(validarSolicitacao({ ...base, eh_retirada_milha: 'Sim', tipo_retirada_milha: 'Passagem' }, um).ok, true)
})

test('Pix inválido e valores inválidos', () => {
    assert.ok(validarSolicitacao({ ...base, chave_pix: '123' }, um).erros.chave_pix)
    for (const v of ['abc', '0', '-5', '1,234', '10,999']) assert.ok(validarSolicitacao({ ...base, valor: v }, um).erros.valor, v)
    assert.deepEqual(['50', '50,5', 'R$ 1.000,00', '1234.56', '1.000.000'].map(lerValorReais), [50, 50.5, 1000, 1234.56, 1000000])
})

test('fase de testes: só Vice Presidência e administradores, até liberar para todos', async () => {
    const { podeUsarFormularioProprio: pode } = await import('../../src/lib/pagamentos-formulario.ts')
    assert.equal(pode({ nucleo_atual: 'Vice Presidência' }, 'USER', false), true)
    assert.equal(pode({ nucleo_atual: 'Vice-Presidência' }, 'USER', false), true)
    assert.equal(pode(null, 'ADMIN', false), true)
    for (const n of ['Projetos', 'Gestão de Pessoas', 'Marketing', null]) assert.equal(pode({ nucleo_atual: n }, 'USER', false), false, String(n))
    assert.equal(pode({ nucleo_atual: 'Projetos' }, 'USER', true), true)
})

test('listas da planilha "VP Categorias": cada centro aceita as suas opções (e mantém as antigas)', async () => {
    const { CENTROS_CUSTO: C } = await import('../../src/lib/pagamentos-formulario.ts')
    const ops = Object.fromEntries(C.map(c => [c.nome, c.categoria.opcoes ? c.categoria.opcoes.length : null]))
    assert.deepEqual(ops, { 'Consultorias/Assessorias': 14, 'Diretoria Executiva': 7, 'Eventos MEJ': 5, 'Feira de carreira': null,
        GP: 14, Marketing: 12, 'Presidência': 16, Projetos: 5, VP: 14 })
    const cons = validarSolicitacao({ ...base, centro_custo: 'Consultorias/Assessorias', categoria_execucao: 'Gasolina', projeto: 'Projeto X' }, um)
    assert.equal(cons.ok, true); assert.equal(cons.dados.categoria_execucao, 'Gasolina'); assert.equal(cons.dados.categoria, null)
    assert.ok(validarSolicitacao({ ...base, centro_custo: 'Consultorias/Assessorias' }, um).erros.categoria_execucao)
    assert.equal(validarSolicitacao({ ...base, centro_custo: 'VP', categoria: 'Auxílio-alimentação' }, um).ok, true)
    assert.equal(validarSolicitacao({ ...base, centro_custo: 'GP', categoria: 'Engajamento GP' }, um).ok, true)
    assert.equal(validarSolicitacao({ ...base, centro_custo: 'Presidência', categoria: 'GO!RN' }, um).ok, true)
    assert.equal(camposVisiveis({ centro_custo: 'Marketing', categoria: 'Workday e workweek' }).anexo_workday, true)
    assert.equal(camposVisiveis({ centro_custo: 'Presidência', categoria: 'Workday' }).anexo_workday, true)
})

test('Consultorias/Assessorias pede o gasto e o projeto (lista da VP ou texto se vazia)', async () => {
    const { opcoesDeLinhas, OPCOES_PADRAO } = await import('../../src/lib/pagamentos-formulario.ts')
    const v = camposVisiveis({ centro_custo: 'Consultorias/Assessorias' })
    assert.deepEqual([v.categoria_execucao, v.projeto], [true, true])
    assert.equal(camposVisiveis({ centro_custo: 'VP' }).projeto, false)
    const semProjeto = validarSolicitacao({ ...base, centro_custo: 'Consultorias/Assessorias', categoria_execucao: 'Uber' }, um)
    assert.ok(semProjeto.erros.projeto)
    const opcoes = { ...OPCOES_PADRAO, projetos: ['Padaria Alfa', 'Clínica Beta'] }
    assert.ok(validarSolicitacao({ ...base, centro_custo: 'Consultorias/Assessorias', categoria_execucao: 'Uber', projeto: 'Outro' }, um, opcoes).erros.projeto)
    const ok = validarSolicitacao({ ...base, centro_custo: 'Consultorias/Assessorias', categoria_execucao: 'Uber', projeto: 'Clínica Beta' }, um, opcoes)
    assert.equal(ok.ok, true); assert.equal(ok.dados.projeto, 'Clínica Beta')
    // Projeto não grava fora de Consultorias
    assert.equal(validarSolicitacao({ ...base, projeto: 'Clínica Beta' }, um, opcoes).dados.projeto, null)
    assert.equal(opcoesDeLinhas([]).projetos.length, 0)
})

test('listas editadas pela VP valem na validação (adicionar, ocultar, esvaziar)', async () => {
    const { opcoesDeLinhas, listaDeCategorias, podeEditarOpcoesPagamentos, listaEditavelValida } = await import('../../src/lib/pagamentos-formulario.ts')
    const o = opcoesDeLinhas([
        { lista: listaDeCategorias('GP'), valor: 'Nova categoria GP' },
        { lista: 'evento_mej', valor: 'ENEJ' },
        { lista: listaDeCategorias('Feira de carreira'), valor: 'Estande' },
    ])
    assert.deepEqual(o.categorias.GP, ['Nova categoria GP'])
    assert.equal(validarSolicitacao({ ...base, categoria: 'Endomarketing' }, um, o).ok, false, 'categoria fora da lista atual é recusada')
    assert.equal(validarSolicitacao({ ...base, categoria: 'Nova categoria GP' }, um, o).ok, true)
    const feira = validarSolicitacao({ ...base, centro_custo: 'Feira de carreira', categoria: 'Estande' }, um, o)
    assert.equal(feira.ok, true); assert.equal(feira.dados.categoria, 'Estande')
    // Marketing ficou sem linhas -> texto livre "Outra categoria"
    assert.equal(camposVisiveis({ centro_custo: 'Marketing' }, o).outra_categoria, true)
    assert.equal(validarSolicitacao({ ...base, centro_custo: 'Marketing', categoria: '' }, um, o).ok, true)
    assert.equal(podeEditarOpcoesPagamentos({ nucleo_atual: 'Vice Presidência' }, 'USER'), true)
    assert.equal(podeEditarOpcoesPagamentos({ nucleo_atual: 'Projetos' }, 'USER'), false)
    assert.equal(podeEditarOpcoesPagamentos(null, 'ADMIN'), true)
    assert.equal(listaEditavelValida('categoria:VP'), true)
    assert.equal(listaEditavelValida('categoria:Inventado'), false)
    assert.equal(listaEditavelValida('qualquer'), false)
})
