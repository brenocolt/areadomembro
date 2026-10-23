// A camada de servidor (src/lib/reconhecimentos/servico.ts) exercitada com o cliente REAL do supabase-js
// contra um PostgreSQL real em memória (PGlite) via emulador de PostgREST: constraints, triggers de histórico,
// papéis (anon × service_role) e RLS são os de verdade. Nenhum banco real é tocado.
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { bancoComMigration } from './pg-base.mjs'
import { iniciarEmulador } from './postgrest-pglite.mjs'
import { createAdminSupabaseClient } from '../../src/lib/supabase-admin.ts'
import * as svc from '../../src/lib/reconhecimentos/servico.ts'
import { ErroDeRequisicao } from '../../src/lib/reconhecimentos/erros.ts'
import { adicionarDias, hojeISO } from '../../src/lib/reconhecimentos/datas.ts'

const CHAVE = 'chave-de-servico-de-teste'
const HOJE = hojeISO()
const dia = (n) => adicionarDias(HOJE, n)
// AAAA-MM deslocado n meses em relação a hoje
const mes = (n = 0) => { const [a, m] = HOJE.split('-').map(Number); const d = new Date(Date.UTC(a, m - 1 + n, 1)); return d.toISOString().slice(0, 7) }

const VP = { id: randomUUID(), email: 'vp@pj.com', nome: 'Vera VP' }
const ADM = { id: randomUUID(), email: 'adm@pj.com', nome: 'Admin' }

async function ambiente() {
    const pg = await bancoComMigration()
    const emu = await iniciarEmulador({ pg, porta: 0, chaveServico: CHAVE })
    process.env.NEXT_PUBLIC_SUPABASE_URL = emu.url
    process.env.SUPABASE_SERVICE_ROLE_KEY = CHAVE
    const ids = {
        prorestaure: randomUUID(), aries: randomUUID(),
        joao: randomUUID(), maria: randomUUID(), pedro: randomUUID(), ana: randomUUID(), ze: randomUUID(),
    }
    await pg.query(`insert into projetos(id, nome, status) values ($1,'Prorestaure','Ativo'), ($2,'Aries Engenharia','Ativo'), ($3,'Projeto Antigo','Concluído')`, [ids.prorestaure, ids.aries, randomUUID()])
    for (const [chave, nome, status] of [['joao', 'João', 'Ativo'], ['maria', 'Maria', 'Ativo'], ['pedro', 'Pedro', 'Ativo'], ['ana', 'Ana', 'Ativo'], ['ze', 'Zé Desligado', 'Desligado']]) {
        await pg.query(`insert into colaboradores(id, nome, email_corporativo, status) values ($1,$2,$3,$4)`, [ids[chave], nome, `${chave}@pj.com`, status])
    }
    const tipos = Object.fromEntries((await pg.query(`select id, nome from reconhecimento_tipos`)).rows.map(t => [t.nome, t.id]))
    const como = (u) => createAdminSupabaseClient({ id: u.id, email: u.email })
    return {
        pg, emu, ids, tipos,
        db: como(VP), dbAdm: como(ADM), dbSistema: createAdminSupabaseClient({ email: 'sistema' }),
        fechar: () => emu.fechar(),
        historico: async (filtro = '') => (await pg.query(`select * from reconhecimento_historico where usuario_email <> 'sistema (migração)' ${filtro} order by created_at, id`)).rows,
    }
}

const rejeita = (promessa, status, mensagem) => assert.rejects(promessa, (e) =>
    e instanceof ErroDeRequisicao && (status === undefined || e.status === status) && (mensagem === undefined || mensagem.test(e.message)), `esperava ErroDeRequisicao ${status ?? ''} ${mensagem ?? ''}`)

const rg = (a, projeto, numero, extra = {}) => svc.criarReconhecimento(a.db, VP, { tipo_id: a.tipos['RG / Projeto Reconhecido'], projeto_id: projeto, numero_rg: numero, data_reconhecimento: dia(-1), ...extra })
const regraRg = (a, extra = {}) => svc.criarRegra(a.db, VP, {
    nome: 'Prêmio de RG', tipo_id: a.tipos['RG / Projeto Reconhecido'], gatilho: 'marcos_de_rg', a_partir_de: 4, repetir_a_cada: 4,
    tipo_premiacao: 'item', descricao_premiacao: 'Item de teste', ...extra,
})

test('sequência de RGs: sugere a próxima, grava o número e barra duplicidade', async () => {
    const a = await ambiente()
    try {
        assert.equal(await svc.proximoRg(a.db, a.ids.prorestaure), 1)
        for (const n of [1, 2, 3, 4]) await rg(a, a.ids.prorestaure, n)
        assert.equal(await svc.proximoRg(a.db, a.ids.prorestaure), 5, 'Prorestaure com 1ª–4ª sugere a 5ª')
        assert.equal(await svc.proximoRg(a.db, a.ids.aries), 1, 'outro projeto tem a própria sequência')
        await rejeita(rg(a, a.ids.prorestaure, 4), 409, /já tem a 4ª RG registrada/)
        await rg(a, a.ids.prorestaure, 7)                                   // fora de ordem é permitido
        assert.equal(await svc.proximoRg(a.db, a.ids.prorestaure), 8)
        const { reconhecimentos } = await svc.listarDados(a.db)
        assert.deepEqual(reconhecimentos.filter(r => r.projeto_id === a.ids.prorestaure).map(r => r.numero_rg).sort(), [1, 2, 3, 4, 7])
        assert.ok(reconhecimentos.every(r => r.criado_por_email === 'vp@pj.com' && r.projeto_nome === 'Prorestaure'), 'o nome vem do banco, o autor vem da sessão')
    } finally { await a.fechar() }
})

test('validações do registro (servidor): mensagens e regras por escopo', async () => {
    const a = await ambiente()
    try {
        const T = a.tipos
        await rejeita(svc.criarReconhecimento(a.db, VP, { data_reconhecimento: dia(-1) }), 400, /tipo de reconhecimento/)
        await rejeita(svc.criarReconhecimento(a.db, VP, { tipo_id: randomUUID(), data_reconhecimento: dia(-1) }), 400, /tipo de reconhecimento/)
        await rejeita(rg(a, a.ids.prorestaure, 1, { data_reconhecimento: dia(1) }), 400, /futura/)
        await rejeita(rg(a, a.ids.prorestaure, 1, { data_reconhecimento: '2026-02-30' }), 400, /data do reconhecimento/)
        await rejeita(svc.criarReconhecimento(a.db, VP, { tipo_id: T['RG / Projeto Reconhecido'], data_reconhecimento: dia(-1) }), 400, /Selecione o projeto/)
        await rejeita(svc.criarReconhecimento(a.db, VP, { tipo_id: T['RG / Projeto Reconhecido'], projeto_id: a.ids.aries, data_reconhecimento: dia(-1) }), 400, /número da RG/)
        await rejeita(rg(a, randomUUID(), 1), 400, /Projeto não encontrado/)
        await rejeita(rg(a, a.ids.aries, 0), 400, /Número da RG inválido/)
        await rejeita(svc.criarReconhecimento(a.db, VP, { tipo_id: T['SDR do Mês'], data_reconhecimento: dia(-1) }), 400, /Selecione o colaborador/)
        await rejeita(svc.criarReconhecimento(a.db, VP, { tipo_id: T['SDR do Mês'], colaborador_id: a.ids.ze, data_reconhecimento: dia(-1) }), 400, /desligado/)
        await rejeita(svc.criarReconhecimento(a.db, VP, { tipo_id: T['SDR do Mês'], colaborador_id: randomUUID(), data_reconhecimento: dia(-1) }), 400, /Colaborador não encontrado/)
        await rejeita(svc.criarReconhecimento(a.db, VP, { tipo_id: T['Núcleo de Impacto'], data_reconhecimento: dia(-1) }), 400, /Selecione o núcleo/)
        await rejeita(svc.criarReconhecimento(a.db, VP, { tipo_id: T['Núcleo de Impacto'], nucleo: 'Inventado', data_reconhecimento: dia(-1) }), 400, /Núcleo inválido/)
        await rejeita(svc.criarReconhecimento(a.db, VP, { tipo_id: T['SDR do Mês'], colaborador_id: a.ids.joao, data_reconhecimento: dia(-1), periodo_referencia: '2026-13' }), 400, /Período/)
        assert.equal((await svc.listarDados(a.db)).reconhecimentos.length, 0, 'nada gravado quando a validação falha')
        // sucesso com período (mês/ano → 1º dia) e snapshot do colaborador
        const { reconhecimento } = await svc.criarReconhecimento(a.db, VP, { tipo_id: T['SDR do Mês'], colaborador_id: a.ids.joao, data_reconhecimento: dia(-1), periodo_referencia: mes(-1), observacoes: ' ótimo ' })
        assert.equal(reconhecimento.colaborador_nome, 'João'); assert.equal(reconhecimento.periodo_referencia, `${mes(-1)}-01`); assert.equal(reconhecimento.observacoes, 'ótimo')
        // tipos de projeto não aceitam colaborador/núcleo soltos: campos fora do escopo são descartados
        const r2 = (await rg(a, a.ids.aries, 1, { colaborador_id: a.ids.joao, nucleo: 'Marketing', periodo_referencia: mes() })).reconhecimento
        assert.deepEqual([r2.colaborador_id, r2.nucleo, r2.periodo_referencia], [null, null, null])
    } finally { await a.fechar() }
})

test('reconhecimento individual e de núcleo: duplicidade por período e núcleos elegíveis', async () => {
    const a = await ambiente()
    try {
        const T = a.tipos
        const sdr = (colab, periodo) => svc.criarReconhecimento(a.db, VP, { tipo_id: T['SDR do Mês'], colaborador_id: colab, data_reconhecimento: dia(-1), periodo_referencia: periodo })
        await sdr(a.ids.joao, mes(-1))
        await rejeita(sdr(a.ids.joao, mes(-1)), 409, /já tem esse reconhecimento no período/)
        await sdr(a.ids.joao, mes(-2)); await sdr(a.ids.maria, mes(-1)); await sdr(a.ids.joao, undefined); await sdr(a.ids.joao, undefined)
        const nuc = (n, p) => svc.criarReconhecimento(a.db, VP, { tipo_id: T['Núcleo de Impacto'], nucleo: n, data_reconhecimento: dia(-1), periodo_referencia: p })
        await nuc('Marketing', mes(-1))
        await rejeita(nuc('Marketing', mes(-1)), 409, /núcleo já tem/)
        // configurar elegibilidade
        let { nucleos } = await svc.listarDados(a.db)
        assert.equal(nucleos.length, 9); assert.ok(nucleos.every(n => n.elegivel), 'todos elegíveis por padrão')
        await svc.configurarNucleo(a.db, { nucleo: 'Projetos', elegivel: false })
        ;({ nucleos } = await svc.listarDados(a.db))
        assert.equal(nucleos.find(n => n.nucleo === 'Projetos').elegivel, false)
        await rejeita(nuc('Projetos', mes(-1)), 400, /não está elegível/)
        await svc.configurarNucleo(a.db, { nucleo: 'Projetos', elegivel: true })
        await nuc('Projetos', mes(-1))
        await rejeita(svc.configurarNucleo(a.db, { nucleo: 'Inventado', elegivel: true }), 400, /Núcleo inválido/)
    } finally { await a.fechar() }
})

test('edição: corrige data/projeto/número/observações com histórico de quem e quando; sem alteração não grava', async () => {
    const a = await ambiente()
    try {
        const { reconhecimento: r } = await rg(a, a.ids.prorestaure, 1, { observacoes: 'a' })
        await rg(a, a.ids.prorestaure, 2)
        const base = { data_reconhecimento: dia(-1), projeto_id: a.ids.prorestaure, numero_rg: 1, observacoes: 'a' }
        const sem = await svc.editarReconhecimento(a.db, VP, r.id, base)
        assert.equal(sem.alterado, false)
        await rejeita(svc.editarReconhecimento(a.dbAdm, ADM, r.id, { ...base, numero_rg: 2 }), 409, /já tem a 2ª RG registrada/)
        const antes = (await a.historico(`and acao = 'editado'`)).length
        const ed = await svc.editarReconhecimento(a.dbAdm, ADM, r.id, { ...base, numero_rg: 5, data_reconhecimento: dia(-3), observacoes: 'corrigida', projeto_id: a.ids.aries })
        assert.equal(ed.alterado, true)
        assert.deepEqual([ed.reconhecimento.numero_rg, ed.reconhecimento.projeto_nome, ed.reconhecimento.observacoes], [5, 'Aries Engenharia', 'corrigida'])
        const h = (await a.historico(`and acao = 'editado'`))
        assert.equal(h.length, antes + 1)
        const ult = h.at(-1)
        assert.equal(ult.usuario_email, 'adm@pj.com', 'o autor da edição é quem editou (não quem criou)')
        assert.deepEqual(Object.keys(ult.alteracoes).sort(), ['data_reconhecimento', 'numero_rg', 'observacoes', 'projeto_id', 'projeto_nome'])
        assert.deepEqual(ult.alteracoes.numero_rg, { de: 1, para: 5 })
        assert.equal((await a.historico(`and acao = 'criado' and reconhecimento_id = '${r.id}'`))[0].usuario_email, 'vp@pj.com', 'o histórico de criação foi preservado')
        await rejeita(svc.editarReconhecimento(a.db, VP, randomUUID(), base), 404)
        // o tipo não é editável: um corpo com outro tipo_id é ignorado
        const outro = await svc.editarReconhecimento(a.db, VP, r.id, { ...base, projeto_id: a.ids.aries, numero_rg: 5, data_reconhecimento: dia(-3), observacoes: 'corrigida', tipo_id: a.tipos['SDR do Mês'] })
        assert.equal(outro.alterado, false)
    } finally { await a.fechar() }
})

test('regras: nada semeado; marcos de RG por número; só vale para o que for registrado depois; botão "aplicar a registros anteriores"', async () => {
    const a = await ambiente()
    try {
        assert.equal((await svc.listarDados(a.db)).regras.length, 0, 'nenhuma regra ou valor vem pronto')
        // RGs registradas ANTES de existir regra
        for (const n of [1, 2, 3, 4]) await rg(a, a.ids.prorestaure, n, { data_reconhecimento: dia(-30) })
        assert.equal((await svc.listarDados(a.db)).bonificacoes.length, 0)

        // validações da regra
        await rejeita(svc.criarRegra(a.db, VP, { tipo_id: a.tipos['SDR do Mês'], nome: 'x', gatilho: 'marcos_de_rg', a_partir_de: 2, tipo_premiacao: 'item' }), 400, /só valem para tipos de reconhecimento de projeto/)
        await rejeita(svc.criarRegra(a.db, VP, { tipo_id: a.tipos['SDR do Mês'], nome: '', gatilho: 'cada_reconhecimento', tipo_premiacao: 'item' }), 400, /nome da regra/)
        await rejeita(svc.criarRegra(a.db, VP, { tipo_id: a.tipos['RG / Projeto Reconhecido'], nome: 'x', gatilho: 'marcos_de_rg', tipo_premiacao: 'item' }), 400, /a partir de qual RG/)

        const { regra, geradas } = await regraRg(a)
        assert.equal(geradas, 0, 'a regra nova NÃO é retroativa por padrão')
        assert.ok(regra.vigente_desde); assert.equal(regra.valor, null); assert.equal(regra.criado_por_email, 'vp@pj.com')

        // prévia (não grava) e aplicação explícita aos registros anteriores
        const previa = await svc.previaRetroativa(a.db, regra.id)
        assert.equal(previa.total, 1); assert.match(previa.amostra[0].motivo, /4ª RG/)
        assert.equal((await svc.listarDados(a.db)).bonificacoes.length, 0, 'a prévia não grava')
        assert.deepEqual(await svc.aplicarRetroativo(a.db, regra.id), { geradas: 1 })
        assert.deepEqual(await svc.aplicarRetroativo(a.db, regra.id), { geradas: 0 }, 'idempotente')

        // RGs registradas depois da regra (mesmo com data anterior): a 8ª gera o 2º marco; 5ª–7ª não
        for (const n of [5, 6, 7]) await rg(a, a.ids.prorestaure, n)
        assert.equal((await svc.listarDados(a.db)).bonificacoes.length, 1)
        const r8 = await rg(a, a.ids.prorestaure, 8)
        assert.equal(r8.geradas, 1)
        const { bonificacoes } = await svc.listarDados(a.db)
        assert.deepEqual(bonificacoes.map(b => b.marco).sort(), [4, 8])
        const b8 = bonificacoes.find(b => b.marco === 8)
        assert.deepEqual([b8.motivo, b8.projeto_nome, b8.tipo_nome, b8.regra_nome, b8.valor, b8.descricao_premiacao, b8.status, b8.liberada_em, b8.prazo_limite],
            ['8ª RG reconhecida', 'Prorestaure', 'RG / Projeto Reconhecido', 'Prêmio de RG', null, 'Item de teste', 'disponivel', dia(-1), null])
        // outro projeto tem os próprios marcos
        for (const n of [1, 2, 3, 4]) await rg(a, a.ids.aries, n)
        assert.equal((await svc.listarDados(a.db)).bonificacoes.filter(b => b.projeto_nome === 'Aries Engenharia').length, 1)
        // sincronizar não duplica
        assert.deepEqual(await svc.sincronizar(a.db, a.dbSistema), { geradas: 0, expiradas: 0 })
        // editar a regra não altera bonificações já geradas (cópias) e não gera de novo
        const ed = await svc.editarRegra(a.db, regra.id, { ...regra, descricao_premiacao: 'Outro item', tipo_premiacao: 'item' })
        assert.equal(ed.geradas, 0)
        assert.equal((await svc.listarDados(a.db)).bonificacoes.find(b => b.marco === 8).descricao_premiacao, 'Item de teste')
        await rejeita(svc.editarRegra(a.db, regra.id, { ...regra, tipo_id: a.tipos['SDR do Mês'], gatilho: 'cada_reconhecimento', a_partir_de: null }), 400, /tipo de uma regra não pode ser alterado/)
        await rejeita(svc.editarRegra(a.db, randomUUID(), regra), 404)
    } finally { await a.fechar() }
})

test('regra "a cada reconhecimento": uma bonificação por reconhecimento, com prazo e premiação configuráveis', async () => {
    const a = await ambiente()
    try {
        const { regra } = await svc.criarRegra(a.db, VP, { nome: 'SDR', tipo_id: a.tipos['SDR do Mês'], gatilho: 'cada_reconhecimento', tipo_premiacao: 'financeira', valor: 75.5, prazo_dias: 30 })
        const r1 = await svc.criarReconhecimento(a.db, VP, { tipo_id: a.tipos['SDR do Mês'], colaborador_id: a.ids.joao, data_reconhecimento: dia(-2), periodo_referencia: mes(-1) })
        assert.equal(r1.geradas, 1)
        await svc.criarReconhecimento(a.db, VP, { tipo_id: a.tipos['SDR do Mês'], colaborador_id: a.ids.maria, data_reconhecimento: dia(-1), periodo_referencia: mes(-1) })
        const { bonificacoes } = await svc.listarDados(a.db)
        assert.equal(bonificacoes.length, 2)
        const b = bonificacoes.find(x => x.colaborador_nome === 'João')
        assert.deepEqual([b.valor, b.tipo_premiacao, b.motivo, b.prazo_limite, b.reconhecimento_id], [75.5, 'financeira', 'SDR', dia(28), r1.reconhecimento.id])
        // regra inativa não gera
        await svc.editarRegra(a.db, regra.id, { ...regra, ativo: false })
        await svc.criarReconhecimento(a.db, VP, { tipo_id: a.tipos['SDR do Mês'], colaborador_id: a.ids.pedro, data_reconhecimento: dia(-1) })
        assert.equal((await svc.listarDados(a.db)).bonificacoes.length, 2)
    } finally { await a.fechar() }
})

async function bonificacaoDisponivel(a) {
    await regraRg(a)
    for (const n of [1, 2, 3, 4]) await rg(a, a.ids.prorestaure, n)
    const { bonificacoes } = await svc.listarDados(a.db)
    assert.equal(bonificacoes.length, 1)
    return bonificacoes[0]
}

test('ENTREGAS INDIVIDUAIS (cenário Prorestaure): João, Maria e Pedro solicitam; João e Maria recebem; Pedro aguarda', async () => {
    const a = await ambiente()
    try {
        const b = await bonificacaoDisponivel(a)
        let r = await svc.adicionarEntregas(a.db, VP, b.id, { colaborador_ids: [a.ids.joao, a.ids.maria, a.ids.pedro] })
        assert.deepEqual(r.entregas.map(e => [e.colaborador_nome, e.situacao, e.solicitada_em]), [['João', 'solicitada', HOJE], ['Maria', 'solicitada', HOJE], ['Pedro', 'solicitada', HOJE]])
        await rejeita(svc.adicionarEntregas(a.db, VP, b.id, { colaborador_ids: [a.ids.joao] }), 409, /Já está nesta bonificação: João/)
        await rejeita(svc.adicionarEntregas(a.db, VP, b.id, { colaborador_ids: [a.ids.ana, a.ids.maria] }), 409, /Maria/)
        assert.equal((await svc.obterBonificacao(a.db, b.id)).entregas.length, 3, 'a tentativa duplicada não gravou nada (nem a Ana)')
        await rejeita(svc.adicionarEntregas(a.db, VP, b.id, { colaborador_ids: [a.ids.ze] }), 400, /desligado/)
        await rejeita(svc.adicionarEntregas(a.db, VP, b.id, { colaborador_ids: [] }), 400, /ao menos um colaborador/)

        const id = (nome) => r.entregas.find(e => e.colaborador_nome === nome).id
        // aprovar e entregar João e Maria (autores diferentes em cada etapa)
        await svc.atualizarEntrega(a.db, VP, b.id, id('João'), { situacao: 'aprovada', aprovada_em: dia(-0) })
        await svc.atualizarEntrega(a.dbAdm, ADM, b.id, id('João'), { situacao: 'entregue', entregue_em: HOJE })
        await svc.atualizarEntrega(a.db, VP, b.id, id('Maria'), { situacao: 'entregue' })
        r = { entregas: (await svc.obterBonificacao(a.db, b.id)).entregas }
        const joao = r.entregas.find(e => e.colaborador_nome === 'João'), pedro = r.entregas.find(e => e.colaborador_nome === 'Pedro')
        assert.deepEqual([joao.situacao, joao.aprovada_por, joao.entregue_por, joao.entregue_em], ['entregue', 'vp@pj.com', 'adm@pj.com', HOJE])
        assert.deepEqual([pedro.situacao, pedro.aprovada_em, pedro.entregue_em], ['solicitada', null, null])

        // o cartão NÃO vira "Entregue" sozinho, e concluir é recusado enquanto o Pedro estiver pendente
        assert.equal((await svc.obterBonificacao(a.db, b.id)).bonificacao.status, 'disponivel')
        await rejeita(svc.concluirBonificacao(a.db, VP, b.id), 409, /1 colaborador\(es\) com solicitação pendente/)
        // cancelar é recusado: já há entrega concluída
        await rejeita(svc.cancelarBonificacao(a.db, VP, b.id, { justificativa: 'engano' }), 409, /já tem entrega concluída/)

        // adicionar outro colaborador depois
        await svc.adicionarEntregas(a.db, VP, b.id, { colaborador_ids: [a.ids.ana], situacao: 'aprovada' })
        // Pedro e Ana concluem; só então dá para concluir o cartão
        const atuais = (await svc.obterBonificacao(a.db, b.id)).entregas
        for (const nome of ['Pedro', 'Ana']) await svc.atualizarEntrega(a.db, VP, b.id, atuais.find(e => e.colaborador_nome === nome).id, { situacao: 'entregue' })
        await svc.concluirBonificacao(a.dbAdm, ADM, b.id)
        let det = await svc.obterBonificacao(a.db, b.id)
        assert.equal(det.bonificacao.status, 'entregue'); assert.equal(det.bonificacao.concluida_por, 'adm@pj.com')
        assert.equal(det.entregas.filter(e => e.situacao === 'entregue').length, 4, 'concluir não altera as entregas individuais')
        await rejeita(svc.concluirBonificacao(a.db, VP, b.id), 409, /só é possível concluir uma bonificação disponível/i)

        // pedir mais uma pessoa num cartão "Entregue" reabre o cartão — sem apagar nada
        const reab = await svc.adicionarEntregas(a.db, VP, b.id, { colaborador_ids: [a.ids.ze === a.ids.ze ? randomUUID() : a.ids.ze] }).catch(e => e)
        assert.ok(reab instanceof ErroDeRequisicao, 'colaborador inexistente é recusado')
        const extra = randomUUID()
        await a.pg.query(`insert into colaboradores(id, nome, email_corporativo, status) values ($1,'Lia','lia@pj.com','Ativo')`, [extra])
        const reaberta = await svc.adicionarEntregas(a.db, VP, b.id, { colaborador_ids: [extra] })
        assert.equal(reaberta.reaberta, true)
        det = await svc.obterBonificacao(a.db, b.id)
        assert.deepEqual([det.bonificacao.status, det.bonificacao.concluida_em, det.entregas.length], ['disponivel', null, 5])
        // voltar uma entrega concluída para pendente limpa as datas daquela pessoa (e só dela)
        const maria = det.entregas.find(e => e.colaborador_nome === 'Maria')
        await svc.atualizarEntrega(a.db, VP, b.id, maria.id, { situacao: 'aprovada' })
        const m2 = (await svc.obterBonificacao(a.db, b.id)).entregas.find(e => e.colaborador_nome === 'Maria')
        assert.deepEqual([m2.situacao, m2.entregue_em, m2.entregue_por, m2.aprovada_em !== null], ['aprovada', null, null, true])
        await rejeita(svc.atualizarEntrega(a.db, VP, b.id, randomUUID(), { situacao: 'entregue' }), 404)
        await rejeita(svc.atualizarEntrega(a.db, VP, b.id, m2.id, { situacao: 'entregue', aprovada_em: dia(0), entregue_em: dia(-5) }), 400, /entrega não pode ser anterior/)

        // histórico da bonificação: cada passo com autor
        const hist = (await svc.obterBonificacao(a.db, b.id)).historico.map(h => `${h.acao}|${h.usuario_email}`)
        for (const esperado of ['gerada|vp@pj.com', 'entrega_adicionada|vp@pj.com', 'situacao_aprovada|vp@pj.com', 'situacao_entregue|adm@pj.com', 'status_entregue|adm@pj.com', 'status_disponivel|vp@pj.com']) {
            assert.ok(hist.includes(esperado), `histórico sem ${esperado}: ${hist.join(', ')}`)
        }
    } finally { await a.fechar() }
})

test('cancelamento: justificativa obrigatória, só disponível/expirada, e cartão cancelado não recebe entregas', async () => {
    const a = await ambiente()
    try {
        const b = await bonificacaoDisponivel(a)
        await svc.adicionarEntregas(a.db, VP, b.id, { colaborador_ids: [a.ids.pedro] })
        await rejeita(svc.cancelarBonificacao(a.db, VP, b.id, { justificativa: ' ' }), 400, /justificativa/)
        await svc.cancelarBonificacao(a.dbAdm, ADM, b.id, { justificativa: 'Lançamento duplicado' })
        const det = await svc.obterBonificacao(a.db, b.id)
        assert.deepEqual([det.bonificacao.status, det.bonificacao.cancelada_por, det.bonificacao.justificativa_cancelamento], ['cancelada', 'adm@pj.com', 'Lançamento duplicado'])
        assert.equal(det.entregas.length, 1, 'a solicitação pendente do Pedro foi preservada')
        await rejeita(svc.cancelarBonificacao(a.db, VP, b.id, { justificativa: 'de novo' }), 409, /não pode ser cancelada/)
        await rejeita(svc.adicionarEntregas(a.db, VP, b.id, { colaborador_ids: [a.ids.ana] }), 409, /cancelada não aceita novas entregas/)
        await rejeita(svc.atualizarEntrega(a.db, VP, b.id, det.entregas[0].id, { situacao: 'aprovada' }), 409, /cancelada/)
        await rejeita(svc.concluirBonificacao(a.db, VP, b.id), 409)
        assert.equal(det.historico[0].acao, 'status_cancelada')
    } finally { await a.fechar() }
})

test('expiração: vence o prazo sem entrega concluída => expirada (autor "sistema"); com entrega concluída => não expira', async () => {
    const a = await ambiente()
    try {
        await svc.criarRegra(a.db, VP, { nome: 'SDR', tipo_id: a.tipos['SDR do Mês'], gatilho: 'cada_reconhecimento', tipo_premiacao: 'simbolica', prazo_dias: 5 })
        const novo = (colab, d) => svc.criarReconhecimento(a.db, VP, { tipo_id: a.tipos['SDR do Mês'], colaborador_id: colab, data_reconhecimento: d, periodo_referencia: undefined })
        await novo(a.ids.joao, dia(-20))   // prazo = -15  (vencida, sem entrega)
        await novo(a.ids.maria, dia(-21))  // vencida, com entrega concluída
        await novo(a.ids.pedro, dia(-22))  // vencida, com solicitação pendente
        await novo(a.ids.ana, dia(-1))     // no prazo
        const { bonificacoes } = await svc.listarDados(a.db)
        const de = (nome) => bonificacoes.find(b => b.colaborador_nome === nome)
        await svc.adicionarEntregas(a.db, VP, de('Maria').id, { colaborador_ids: [a.ids.ana], situacao: 'entregue' })
        await svc.adicionarEntregas(a.db, VP, de('Pedro').id, { colaborador_ids: [a.ids.joao] })
        const r = await svc.sincronizar(a.db, a.dbSistema)
        assert.equal(r.expiradas, 2)
        const depois = (await svc.listarDados(a.db)).bonificacoes
        const st = (nome) => depois.find(b => b.colaborador_nome === nome).status
        assert.deepEqual(['João', 'Maria', 'Pedro', 'Ana'].map(st), ['expirada', 'disponivel', 'expirada', 'disponivel'])
        const h = await a.historico(`and acao = 'status_expirada'`)
        assert.equal(h.length, 2); assert.ok(h.every(x => x.usuario_email === 'sistema'))
        assert.equal((await svc.obterBonificacao(a.db, de('Pedro').id)).entregas.length, 1, 'a solicitação pendente continua registrada')
        assert.equal((await svc.sincronizar(a.db, a.dbSistema)).expiradas, 0, 'idempotente')
        // uma expirada pode ser cancelada, mas não recebe novas entregas
        await rejeita(svc.adicionarEntregas(a.db, VP, de('João').id, { colaborador_ids: [a.ids.ana] }), 409, /expirada não aceita novas entregas/)
        await svc.cancelarBonificacao(a.db, VP, de('João').id, { justificativa: 'Prazo ultrapassado' })
    } finally { await a.fechar() }
})

test('editar/excluir reconhecimento depois de gerar bonificação: ela permanece, é sinalizada e tudo fica no histórico', async () => {
    const a = await ambiente()
    try {
        const b = await bonificacaoDisponivel(a)
        const recs = (await svc.listarDados(a.db)).reconhecimentos
        const quarta = recs.find(r => r.numero_rg === 4)
        // corrigir a data não muda o número => nada novo é gerado, mas o cartão é sinalizado
        const ed = await svc.editarReconhecimento(a.dbAdm, ADM, quarta.id, { data_reconhecimento: dia(-5), projeto_id: a.ids.prorestaure, numero_rg: 4 })
        assert.equal(ed.geradas, 0)
        let det = await svc.obterBonificacao(a.db, b.id)
        assert.equal(det.bonificacao.origem_alterada, true); assert.equal(det.bonificacao.status, 'disponivel'); assert.equal(det.bonificacao.marco, 4)
        assert.ok(det.historico.some(h => h.acao === 'origem_alterada'))
        // mudar o número para 5 => a bonificação do marco 4 permanece; nenhuma nova (5 não é marco)
        await svc.editarReconhecimento(a.db, VP, quarta.id, { data_reconhecimento: dia(-5), projeto_id: a.ids.prorestaure, numero_rg: 5 })
        assert.equal((await svc.listarDados(a.db)).bonificacoes.length, 1)
        // exclusão lógica: exige motivo, some das listas, número reutilizável, bonificação permanece
        await rejeita(svc.excluirReconhecimento(a.db, VP, quarta.id, { motivo: '' }), 400, /motivo da exclusão/)
        await svc.excluirReconhecimento(a.dbAdm, ADM, quarta.id, { motivo: 'Lançada por engano' })
        assert.ok(!(await svc.listarDados(a.db)).reconhecimentos.some(r => r.id === quarta.id))
        await rejeita(svc.excluirReconhecimento(a.db, VP, quarta.id, { motivo: 'de novo' }), 404)
        await rejeita(svc.editarReconhecimento(a.db, VP, quarta.id, { data_reconhecimento: dia(-5), projeto_id: a.ids.prorestaure, numero_rg: 5 }), 404, /não encontrado/)
        await rg(a, a.ids.prorestaure, 5)   // o número 5 foi liberado
        assert.equal((await svc.listarDados(a.db)).bonificacoes.length, 1)
        const hist = await svc.listarHistorico(a.db, { reconhecimento_id: quarta.id })
        assert.deepEqual(hist.map(h => h.acao).reverse().filter(x => ['criado', 'editado', 'excluido', 'gerada'].includes(x)), ['criado', 'gerada', 'editado', 'editado', 'excluido'])
        const exc = hist.find(h => h.acao === 'excluido')
        assert.deepEqual([exc.usuario_email, exc.alteracoes.excluido_motivo.para], ['adm@pj.com', 'Lançada por engano'])
        // o registro continua no banco (exclusão lógica), com quem excluiu
        const linha = (await a.pg.query(`select excluido_por, excluido_motivo from reconhecimentos where id=$1`, [quarta.id])).rows[0]
        assert.deepEqual(linha, { excluido_por: 'adm@pj.com', excluido_motivo: 'Lançada por engano' })
    } finally { await a.fechar() }
})

test('histórico: filtra por reconhecimento/bonificação, é paginável e NÃO pode ser alterado nem pelo servidor', async () => {
    const a = await ambiente()
    try {
        const b = await bonificacaoDisponivel(a)
        const geral = await svc.listarHistorico(a.db, {})
        assert.ok(geral.length >= 9)
        assert.ok(geral.every((h, i) => i === 0 || geral[i - 1].created_at >= h.created_at), 'mais recente primeiro')
        const so = await svc.listarHistorico(a.db, { bonificacao_id: b.id })
        assert.ok(so.length >= 1 && so.every(h => h.bonificacao_id === b.id))
        assert.equal((await svc.listarHistorico(a.db, { limite: 2 })).length, 2)
        const pagina2 = await svc.listarHistorico(a.db, { antes: geral[2].created_at, limite: 1000 })
        assert.ok(pagina2.every(h => h.created_at < geral[2].created_at))
        // nem a service role consegue reescrever o passado
        const { error } = await a.db.from('reconhecimento_historico').update({ acao: 'x' }).eq('id', geral[0].id)
        assert.match(error?.message ?? 'ACEITOU', /imutável/)
        const del = await a.db.from('reconhecimento_historico').delete().eq('id', geral[0].id)
        assert.match(del.error?.message ?? 'ACEITOU', /imutável/)
    } finally { await a.fechar() }
})

test('RLS pela porta da frente: a chave anon (pública) não lê nem grava nenhuma tabela da aba; só a service role', async () => {
    const a = await ambiente()
    try {
        await bonificacaoDisponivel(a)
        const anon = createClient(a.emu.url, a.emu.chaveAnon, { auth: { persistSession: false } })
        for (const t of ['reconhecimentos', 'bonificacoes', 'bonificacao_entregas', 'regras_bonificacao', 'reconhecimento_tipos', 'reconhecimento_nucleos', 'reconhecimento_historico']) {
            const lido = await anon.from(t).select('*')
            assert.ok(lido.error && lido.data === null, `${t}: anon NÃO pode ler`)
            assert.match(lido.error.message, /permission denied/, t)
            const gravado = await anon.from(t).insert({}).select()
            assert.ok(gravado.error, `${t}: anon NÃO pode gravar`)
            const apagado = await anon.from(t).delete().neq('id', randomUUID())
            assert.ok(apagado.error, `${t}: anon NÃO pode apagar`)
        }
        assert.ok((await a.db.from('reconhecimentos').select('*')).data.length > 0, 'a service role lê')
        // tabelas existentes do portal continuam como eram (abertas, aqui só para provar que não mexemos nelas)
        assert.ok(!(await anon.from('projetos').select('nome')).error)
    } finally { await a.fechar() }
})

test('concorrência: duas gerações simultâneas não duplicam nem falham', async () => {
    const a = await ambiente()
    try {
        await regraRg(a)
        for (const n of [1, 2, 3, 4, 5, 6, 7, 8]) await a.pg.query(`insert into reconhecimentos(tipo_id, data_reconhecimento, projeto_id, projeto_nome, numero_rg, criado_por_email) values ($1,$2,$3,'Prorestaure',$4,'vp@pj.com')`, [a.tipos['RG / Projeto Reconhecido'], dia(-1), a.ids.prorestaure, n])
        const [x, y, z] = await Promise.all([svc.gerarBonificacoes(a.db), svc.gerarBonificacoes(a.dbAdm), svc.sincronizar(a.db, a.dbSistema)])
        assert.equal(x.geradas + y.geradas + z.geradas, 2, 'cada bonificação (marcos 4 e 8) foi criada uma única vez')
        assert.equal((await svc.listarDados(a.db)).bonificacoes.length, 2)
    } finally { await a.fechar() }
})

test('listagens: tipos/regras/projetos/colaboradores e paginação acima de 1000 linhas', async () => {
    const a = await ambiente()
    try {
        const d = await svc.listarDados(a.db)
        assert.deepEqual(d.tipos.map(t => t.nome), ['RG / Projeto Reconhecido', 'Piloto de Elite', 'Líder de Voo', 'SDR do Mês', 'Closer do Mês', 'Consultor do Mês', 'Núcleo de Impacto'])
        assert.deepEqual((await svc.listarProjetos(a.db)).map(p => p.nome), ['Aries Engenharia', 'Prorestaure'], 'só projetos ativos, em ordem')
        assert.deepEqual((await svc.listarColaboradores(a.db)).map(c => c.nome), ['Ana', 'João', 'Maria', 'Pedro'], 'sem desligados')
        for (let i = 0; i < 1200; i++) {
            await a.pg.query(`insert into reconhecimentos(tipo_id, data_reconhecimento, colaborador_id, colaborador_nome, criado_por_email) values ($1,$2,$3,'X','vp@pj.com')`, [a.tipos['Piloto de Elite'], dia(-1), a.ids.joao])
        }
        const todos = (await svc.listarDados(a.db)).reconhecimentos
        assert.equal(todos.length, 1200); assert.equal(new Set(todos.map(r => r.id)).size, 1200)
        // tipos: criar, editar, nome único
        const novo = await svc.criarTipo(a.db, { nome: 'Mentor do Mês', usa_periodo: true })
        assert.deepEqual([novo.escopo, novo.ordem, novo.usa_periodo], ['colaborador', 8, true])
        await rejeita(svc.criarTipo(a.db, { nome: 'Mentor do Mês' }), 409, /Já existe um tipo/)
        const ed = await svc.editarTipo(a.db, novo.id, { ativo: false })
        assert.equal(ed.ativo, false)
        await rejeita(svc.criarReconhecimento(a.db, VP, { tipo_id: novo.id, colaborador_id: a.ids.joao, data_reconhecimento: dia(-1) }), 400, /tipo de reconhecimento/, 'tipo inativo não registra')
    } finally { await a.fechar() }
})
