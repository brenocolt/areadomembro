// Autopreenchimento do NPS Projetos: projeto -> gerente e consultores já selecionados.
import test from 'node:test'
import assert from 'node:assert/strict'
import { localizarPerguntasNps, preencherNpsProjeto, papelNoProjeto, projetosDoMembro, resumoEquipe } from '../../src/lib/projetos-equipe.ts'

const SIMNAO = ['Sim', 'Não']
const esc = (id, competencia) => ({ id, tipo: 'escala', competencia, titulo: competencia })
// Mesma estrutura do formulário semeado em 20260911_nps_projetos_formulario_generico_fase_a.sql
const form = [
    { id: 'proj', tipo: 'selecionar_projeto', titulo: 'Sobre qual projeto é esta avaliação?' },
    { id: 'euGerente', tipo: 'selecao_unica', titulo: 'Você é o gerente responsável por este projeto?', opcoes: SIMNAO },
    { id: 's-ger', tipo: 'secao', titulo: 'Avalie o Gerente do Projeto' },
    { id: 'gerente', tipo: 'colaborador_unico', titulo: 'Quem é o gerente deste projeto?' },
    esc('g1', 'Comunicação'), esc('g2', 'Suporte à Execução'), esc('g3', 'Liderança'),
    { id: 'g-txt', tipo: 'texto', titulo: 'percepções' },
    { id: 's-c1', tipo: 'secao', titulo: 'Avalie sua Dupla (Consultor 1)' },
    { id: 'c1', tipo: 'colaborador_unico', titulo: 'Quem é o(a) consultor(a)?' },
    esc('c1a', 'Comunicação'), esc('c1b', 'Dedicação'),
    { id: 'c1outro', tipo: 'selecao_unica', titulo: 'Há outro consultor no projeto que você gostaria de avaliar?', opcoes: SIMNAO },
    { id: 's-c2', tipo: 'secao', titulo: 'Avalie sua Dupla (Consultor 2)' },
    { id: 'c2', tipo: 'colaborador_unico', titulo: 'Quem é o(a) consultor(a)?' },
    esc('c2a', 'Comunicação'), esc('c2b', 'Dedicação'),
    { id: 'c2outro', tipo: 'selecao_unica', titulo: 'Há outro consultor no projeto que você gostaria de avaliar?', opcoes: SIMNAO },
    { id: 's-c3', tipo: 'secao', titulo: 'Avalie sua Dupla (Consultor 3)' },
    { id: 'c3', tipo: 'colaborador_unico', titulo: 'Quem é o(a) consultor(a)?' },
    esc('c3a', 'Comunicação'), esc('c3b', 'Dedicação'),
]
const m = (id, nome) => ({ id, nome })
const projeto = { id: 'p1', nome: 'Projeto X', gerentes: [m('g', 'Gabi')], consultores: [m('a', 'Ana'), m('b', 'Beto'), m('c', 'Caio')] }

test('acha as perguntas certas do formulário', () => {
    const r = localizarPerguntasNps(form)
    assert.equal(r.projeto, 'proj'); assert.equal(r.voceEGerente, 'euGerente'); assert.equal(r.gerenteColaborador, 'gerente')
    assert.deepEqual(r.consultores, [
        { colaborador: 'c1', outroConsultor: 'c1outro' }, { colaborador: 'c2', outroConsultor: 'c2outro' }, { colaborador: 'c3', outroConsultor: null },
    ])
})

test('consultor: gerente já escolhido e os outros consultores em ordem, sem ele mesmo', () => {
    const r = preencherNpsProjeto(form, projeto, 'b')
    assert.deepEqual(r.respostas, { euGerente: 'Não', gerente: 'g', c1: 'a', c1outro: 'Sim', c2: 'c', c2outro: 'Não' })
    assert.ok(r.travadas.has('gerente') && r.travadas.has('c1') && r.travadas.has('c2outro'))
    assert.ok(!r.travadas.has('c3'))
})

test('gerente: marca "Sim" (pula a avaliação do gerente) e já traz todos os consultores', () => {
    const r = preencherNpsProjeto(form, projeto, 'g')
    assert.deepEqual(r.respostas, { euGerente: 'Sim', c1: 'a', c1outro: 'Sim', c2: 'b', c2outro: 'Sim', c3: 'c' })
    assert.ok(!('gerente' in r.respostas))
})

test('projeto com um consultor só: "outro consultor?" = Não', () => {
    const p = { ...projeto, consultores: [m('a', 'Ana'), m('b', 'Beto')] }
    const r = preencherNpsProjeto(form, p, 'a')
    assert.deepEqual(r.respostas, { euGerente: 'Não', gerente: 'g', c1: 'b', c1outro: 'Não' })
})

test('quem não é do projeto não recebe preenchimento; papéis e lista do membro', () => {
    assert.equal(preencherNpsProjeto(form, projeto, 'zz'), null)
    assert.equal(papelNoProjeto(projeto, 'g'), 'gerente'); assert.equal(papelNoProjeto(projeto, 'a'), 'consultor'); assert.equal(papelNoProjeto(projeto, 'zz'), null)
    assert.deepEqual(projetosDoMembro([projeto, { id: 'p2', nome: 'Y', gerentes: [], consultores: [] }], 'a').map(p => p.id), ['p1'])
    assert.equal(resumoEquipe(projeto), 'Gerente: Gabi · Consultores: Ana, Beto, Caio')
})

test('sem gerente cadastrado: não trava a pergunta do gerente', () => {
    const r = preencherNpsProjeto(form, { ...projeto, gerentes: [] }, 'a')
    assert.ok(!('gerente' in r.respostas))
})
