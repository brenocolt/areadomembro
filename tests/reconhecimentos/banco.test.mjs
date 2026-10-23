// A migration em PostgreSQL real (PGlite): estrutura, segurança (RLS), regras de integridade,
// histórico automático e imutável, atomicidade e reversão. Nenhum banco real é tocado.
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { novoBanco, bancoComMigration, comAutor, MIGRATION, ROLLBACK, TABELAS } from './pg-base.mjs'

const falha = async (fn) => { try { await fn(); return null } catch (e) { return e.message } }
const contar = async (db, t) => Number((await db.query(`select count(*)::int n from public.${t}`)).rows[0].n)
const tipoId = async (db, nome) => (await db.query(`select id from reconhecimento_tipos where nome = $1`, [nome])).rows[0].id

test('aplica, é idempotente e semeia SOMENTE os 7 tipos (nenhuma regra, nenhum valor)', async () => {
    const db = await bancoComMigration()
    await db.exec(MIGRATION)
    const contagens = await Promise.all(TABELAS.map(t => contar(db, t)))
    assert.deepEqual(Object.fromEntries(TABELAS.map((t, i) => [t, contagens[i]])), {
        reconhecimento_tipos: 7, reconhecimento_nucleos: 0, reconhecimentos: 0, regras_bonificacao: 0, bonificacoes: 0, bonificacao_entregas: 0, reconhecimento_historico: 7,
    })
    const tipos = (await db.query(`select nome, escopo, usa_periodo from reconhecimento_tipos order by ordem`)).rows
    assert.deepEqual(tipos, [
        { nome: 'RG / Projeto Reconhecido', escopo: 'projeto', usa_periodo: false },
        { nome: 'Piloto de Elite', escopo: 'colaborador', usa_periodo: true },
        { nome: 'Líder de Voo', escopo: 'colaborador', usa_periodo: true },
        { nome: 'SDR do Mês', escopo: 'colaborador', usa_periodo: true },
        { nome: 'Closer do Mês', escopo: 'colaborador', usa_periodo: true },
        { nome: 'Consultor do Mês', escopo: 'colaborador', usa_periodo: true },
        { nome: 'Núcleo de Impacto', escopo: 'nucleo', usa_periodo: true },
    ])
    // a criação dos tipos iniciais ficou registrada, com autor "sistema (migração)"
    assert.deepEqual((await db.query(`select distinct acao, usuario_email from reconhecimento_historico`)).rows, [{ acao: 'tipo_criado', usuario_email: 'sistema (migração)' }])
})

test('RLS restritivo: anon e authenticated não leem nem gravam; service_role sim', async () => {
    const db = await bancoComMigration()
    for (const t of TABELAS) {
        const info = (await db.query(`select relrowsecurity rls from pg_class where oid = 'public.${t}'::regclass`)).rows[0]
        assert.equal(info.rls, true, `${t}: RLS ligado`)
        assert.equal((await db.query(`select count(*)::int n from pg_policies where schemaname='public' and tablename=$1`, [t])).rows[0].n, 0, `${t}: nenhuma policy`)
    }
    for (const papel of ['anon', 'authenticated']) {
        await db.exec(`SET ROLE ${papel}`)
        for (const t of TABELAS) {
            assert.match(await falha(() => db.query(`select * from public.${t}`)) ?? '', /permission denied/, `${papel} select ${t}`)
            assert.match(await falha(() => db.query(`delete from public.${t}`)) ?? '', /permission denied/, `${papel} delete ${t}`)
        }
        assert.match(await falha(() => db.query(`insert into public.reconhecimento_tipos(nome, escopo) values ('x','projeto')`)) ?? '', /permission denied/)
        await db.exec('RESET ROLE')
    }
    // Defesa em profundidade: mesmo se alguém conceder GRANT depois, o RLS sem policy bloqueia.
    await db.exec(`GRANT ALL ON ALL TABLES IN SCHEMA public TO anon`)
    await db.exec('SET ROLE anon')
    assert.equal((await db.query(`select count(*)::int n from reconhecimento_tipos`)).rows[0].n, 0)
    assert.match(await falha(() => db.query(`insert into reconhecimento_tipos(nome, escopo) values ('x','projeto')`)) ?? '', /row-level security/)
    await db.exec('RESET ROLE')
    await db.exec('SET ROLE service_role')
    assert.equal((await db.query(`select count(*)::int n from reconhecimento_tipos`)).rows[0].n, 7)
    await comAutor(db)
    await db.exec(`insert into reconhecimento_tipos(nome, escopo) values ('via service role', 'colaborador')`)
    await db.exec('RESET ROLE')
})

test('sequência de RGs: número único por projeto (não excluídos), reutilizável após exclusão lógica', async () => {
    const db = await bancoComMigration(); await comAutor(db)
    const rg = await tipoId(db, 'RG / Projeto Reconhecido')
    const [pA, pB] = [randomUUID(), randomUUID()]
    const ins = (p, n, extra = '') => db.query(`insert into reconhecimentos(tipo_id, data_reconhecimento, projeto_id, projeto_nome, numero_rg, criado_por_email) values ($1,'2026-03-01',$2,'P',$3,'vp@pj.com') returning id`, [rg, p, n])
    const r1 = (await ins(pA, 1)).rows[0].id
    await ins(pA, 2); await ins(pA, 3); await ins(pA, 4)
    assert.match(await falha(() => ins(pA, 4)) ?? 'ACEITOU', /unique|duplicate/i, 'mesma RG no mesmo projeto')
    await ins(pB, 4) // outro projeto pode ter a 4ª
    assert.match(await falha(() => ins(pA, 0)) ?? 'ACEITOU', /check/i, 'número mínimo 1')
    // o número é gravado: a "próxima" é max + 1
    assert.equal((await db.query(`select max(numero_rg)+1 prox from reconhecimentos where projeto_id=$1 and excluido_em is null`, [pA])).rows[0].prox, 5)
    // exclusão lógica libera o número; o antigo continua no banco e no histórico
    await db.query(`update reconhecimentos set excluido_em = now(), excluido_por = 'vp@pj.com', excluido_motivo = 'lançada errada' where id = $1`, [r1])
    await ins(pA, 1)
    assert.equal((await db.query(`select count(*)::int n from reconhecimentos where projeto_id=$1 and numero_rg=1`, [pA])).rows[0].n, 2)
    // exclusão exige autor
    assert.match(await falha(() => db.query(`update reconhecimentos set excluido_em = now() where projeto_id=$1 and numero_rg=2`, [pA])) ?? 'ACEITOU', /check/i)
})

test('reconhecimentos individuais e de núcleo: sem duplicidade no mesmo período; período é sempre o 1º dia do mês', async () => {
    const db = await bancoComMigration(); await comAutor(db)
    const [sdr, nuc] = [await tipoId(db, 'SDR do Mês'), await tipoId(db, 'Núcleo de Impacto')]
    const colab = randomUUID()
    const ind = (c, periodo) => db.query(`insert into reconhecimentos(tipo_id, data_reconhecimento, colaborador_id, colaborador_nome, periodo_referencia, criado_por_email) values ($1,'2026-03-31',$2,'Ana',$3,'vp@pj.com')`, [sdr, c, periodo])
    await ind(colab, '2026-03-01')
    assert.match(await falha(() => ind(colab, '2026-03-01')) ?? 'ACEITOU', /unique|duplicate/i)
    await ind(colab, '2026-04-01')       // outro mês: ok
    await ind(randomUUID(), '2026-03-01') // outra pessoa: ok
    assert.match(await falha(() => ind(randomUUID(), '2026-03-15')) ?? 'ACEITOU', /check/i, 'período precisa ser o primeiro dia do mês')
    await db.query(`insert into reconhecimentos(tipo_id, data_reconhecimento, colaborador_id, colaborador_nome, criado_por_email) values ($1,'2026-03-31',$2,'Ana','vp@pj.com')`, [sdr, colab]) // sem período: não bloqueia
    const nucl = (n, p) => db.query(`insert into reconhecimentos(tipo_id, data_reconhecimento, nucleo, periodo_referencia, criado_por_email) values ($1,'2026-03-31',$2,$3,'vp@pj.com')`, [nuc, n, p])
    await nucl('Marketing', '2026-03-01')
    assert.match(await falha(() => nucl('Marketing', '2026-03-01')) ?? 'ACEITOU', /unique|duplicate/i)
    await nucl('Projetos', '2026-03-01')
})

test('regras: critérios coerentes e nenhum valor obrigatório', async () => {
    const db = await bancoComMigration(); await comAutor(db)
    const rg = await tipoId(db, 'RG / Projeto Reconhecido'), sdr = await tipoId(db, 'SDR do Mês')
    const regra = (sql, params) => db.query(`insert into regras_bonificacao(nome, tipo_id, gatilho, a_partir_de, repetir_a_cada, tipo_premiacao, valor, prazo_dias) values ${sql}`, params)
    await regra(`('A', $1, 'cada_reconhecimento', null, null, 'simbolica', null, null)`, [sdr])      // sem valor e sem prazo
    await regra(`('B', $1, 'marcos_de_rg', 4, 4, 'item', null, 30)`, [rg])
    await regra(`('C', $1, 'marcos_de_rg', 2, null, 'financeira', 0, null)`, [rg])
    for (const [sql, p] of [
        [`('x', $1, 'marcos_de_rg', null, null, 'item', null, null)`, [rg]],        // marcos exige a_partir_de
        [`('x', $1, 'cada_reconhecimento', 3, null, 'item', null, null)`, [sdr]],   // a_partir_de só em marcos
        [`('x', $1, 'cada_reconhecimento', null, 2, 'item', null, null)`, [sdr]],   // repetir só em marcos
        [`('x', $1, 'marcos_de_rg', 0, null, 'item', null, null)`, [rg]],
        [`('x', $1, 'qualquer', null, null, 'item', null, null)`, [sdr]],
        [`('x', $1, 'cada_reconhecimento', null, null, 'pix', null, null)`, [sdr]],
        [`('x', $1, 'cada_reconhecimento', null, null, 'item', -1, null)`, [sdr]],
        [`('x', $1, 'cada_reconhecimento', null, null, 'item', null, 0)`, [sdr]],
    ]) assert.match(await falha(() => regra(sql, p)) ?? `ACEITOU ${sql}`, /check/i, sql)
    assert.equal(await contar(db, 'regras_bonificacao'), 3)
})

test('bonificação e entregas: chave única, uma linha por pessoa, situações e datas coerentes', async () => {
    const db = await bancoComMigration(); await comAutor(db)
    const bon = (await db.query(`insert into bonificacoes(chave_unica, tipo_nome, regra_nome, motivo, projeto_nome, tipo_premiacao, liberada_em) values ('k1','RG','R','4ª RG','Prorestaure','item','2026-03-01') returning id`)).rows[0].id
    assert.match(await falha(() => db.query(`insert into bonificacoes(chave_unica, tipo_nome, regra_nome, motivo, tipo_premiacao, liberada_em) values ('k1','RG','R','m','item','2026-03-01')`)) ?? 'ACEITOU', /unique|duplicate/i)
    assert.match(await falha(() => db.query(`insert into bonificacoes(chave_unica, tipo_nome, regra_nome, motivo, tipo_premiacao, liberada_em, status) values ('k2','RG','R','m','item','2026-03-01','pago')`)) ?? 'ACEITOU', /check/i)

    const [joao, maria, pedro] = [randomUUID(), randomUUID(), randomUUID()]
    const ent = (c, nome, cols) => db.query(`insert into bonificacao_entregas(bonificacao_id, colaborador_id, colaborador_nome, ${cols.keys}) values ($1,$2,$3,${cols.vals})`, [bon, c, nome])
    await ent(joao, 'João', { keys: 'situacao, solicitada_em, aprovada_em, entregue_em', vals: `'entregue','2026-03-02','2026-03-03','2026-03-05'` })
    await ent(maria, 'Maria', { keys: 'situacao, solicitada_em, aprovada_em, entregue_em', vals: `'entregue','2026-03-02','2026-03-03','2026-03-05'` })
    await ent(pedro, 'Pedro', { keys: 'solicitada_em', vals: `'2026-03-02'` })   // aguardando aprovação
    assert.deepEqual((await db.query(`select colaborador_nome n, situacao s from bonificacao_entregas order by 1`)).rows.map(r => `${r.n}:${r.s}`), ['João:entregue', 'Maria:entregue', 'Pedro:solicitada'])
    assert.match(await falha(() => ent(joao, 'João', { keys: 'solicitada_em', vals: `'2026-03-09'` })) ?? 'ACEITOU', /unique|duplicate/i, 'mesma pessoa duas vezes na mesma bonificação')
    for (const cols of [
        { keys: 'situacao, entregue_em', vals: `'entregue','2026-03-05'` },                                  // entregue sem aprovação
        { keys: 'situacao', vals: `'entregue'` },                                                             // entregue sem data
        { keys: 'situacao', vals: `'aprovada'` },                                                             // aprovada sem data
        { keys: 'situacao, aprovada_em, entregue_em', vals: `'aprovada','2026-03-03','2026-03-05'` },         // data de entrega com situação aprovada
        { keys: 'situacao, solicitada_em, aprovada_em', vals: `'aprovada','2026-03-05','2026-03-03'` },       // aprovada antes de solicitada
        { keys: 'situacao', vals: `'recusada'` },
    ]) assert.match(await falha(() => ent(randomUUID(), 'X', cols)) ?? `ACEITOU ${JSON.stringify(cols)}`, /check/i, JSON.stringify(cols))
    // concluir exige data; cancelar exige consistência
    assert.match(await falha(() => db.query(`update bonificacoes set status='entregue' where id=$1`, [bon])) ?? 'ACEITOU', /check/i)
    assert.match(await falha(() => db.query(`update bonificacoes set status='cancelada' where id=$1`, [bon])) ?? 'ACEITOU', /check/i)
    await db.query(`update bonificacoes set status='entregue', concluida_em=now(), concluida_por='vp@pj.com' where id=$1`, [bon])
    // apagar a bonificação leva as entregas junto (CASCADE), mas o histórico permanece
    const antes = await contar(db, 'reconhecimento_historico')
    await db.query(`delete from bonificacoes where id=$1`, [bon])
    assert.equal(await contar(db, 'bonificacao_entregas'), 0)
    assert.ok(await contar(db, 'reconhecimento_historico') >= antes, 'histórico nunca diminui')
})

test('histórico automático: quem, quando, o quê (de → para), na mesma transação', async () => {
    const db = await bancoComMigration()
    const uid = randomUUID()
    await comAutor(db, 'vp@pj.com', uid)
    const rg = await tipoId(db, 'RG / Projeto Reconhecido')
    const projeto = randomUUID()
    const rec = (await db.query(`insert into reconhecimentos(tipo_id, data_reconhecimento, projeto_id, projeto_nome, numero_rg, observacoes, criado_por_email) values ($1,'2026-03-01',$2,'Prorestaure',1,'a','vp@pj.com') returning id`, [rg, projeto])).rows[0].id
    const hist = async (where = '') => (await db.query(`select * from reconhecimento_historico where usuario_email <> 'sistema (migração)' ${where ? 'and ' + where.replace(/^where /, '') : ''} order by created_at, id`)).rows

    let h = await hist()
    assert.equal(h.length, 1)
    assert.deepEqual([h[0].entidade, h[0].acao, h[0].reconhecimento_id, h[0].usuario_email, h[0].usuario_id], ['reconhecimento', 'criado', rec, 'vp@pj.com', uid])
    assert.equal(h[0].alteracoes.numero_rg, 1)

    // edição por OUTRO usuário: grava de → para, só o que mudou, com o autor da edição
    await comAutor(db, 'adm@pj.com')
    await db.query(`update reconhecimentos set data_reconhecimento = '2026-03-15', observacoes = 'b', numero_rg = 2 where id = $1`, [rec])
    h = await hist(`where acao = 'editado'`)
    assert.equal(h.length, 1)
    assert.equal(h[0].usuario_email, 'adm@pj.com')
    assert.deepEqual(Object.keys(h[0].alteracoes).sort(), ['data_reconhecimento', 'numero_rg', 'observacoes'])
    assert.deepEqual(h[0].alteracoes.numero_rg, { de: 1, para: 2 })
    assert.deepEqual(h[0].alteracoes.data_reconhecimento, { de: '2026-03-01', para: '2026-03-15' })

    // update sem mudança real não gera ruído
    await db.query(`update reconhecimentos set observacoes = 'b' where id = $1`, [rec])
    assert.equal((await hist(`where acao = 'editado'`)).length, 1)

    // exclusão lógica vira "excluido" (com o motivo nas alterações)
    await db.query(`update reconhecimentos set excluido_em = now(), excluido_por = 'adm@pj.com', excluido_motivo = 'duplicada' where id = $1`, [rec])
    const ex = await hist(`where acao = 'excluido'`)
    assert.equal(ex.length, 1); assert.equal(ex[0].alteracoes.excluido_motivo.para, 'duplicada')

    // bonificação: gerada → status → origem alterada; entregas: adicionada → situações
    const bon = (await db.query(`insert into bonificacoes(chave_unica, reconhecimento_id, tipo_nome, regra_nome, motivo, tipo_premiacao, liberada_em) values ('k',$1,'RG','R','m','item','2026-03-01') returning id`, [rec])).rows[0].id
    await db.query(`update bonificacoes set origem_alterada = true where id = $1`, [bon])
    const ent = (await db.query(`insert into bonificacao_entregas(bonificacao_id, colaborador_id, colaborador_nome, solicitada_em) values ($1,$2,'Pedro','2026-03-02') returning id`, [bon, randomUUID()])).rows[0].id
    await db.query(`update bonificacao_entregas set situacao='aprovada', aprovada_em='2026-03-03', aprovada_por='vp@pj.com' where id=$1`, [ent])
    await db.query(`update bonificacao_entregas set situacao='entregue', entregue_em='2026-03-04', entregue_por='vp@pj.com' where id=$1`, [ent])
    await db.query(`update bonificacoes set status='entregue', concluida_em=now(), concluida_por='adm@pj.com' where id=$1`, [bon])
    assert.deepEqual((await hist(`where bonificacao_id = '${bon}'`)).map(x => x.acao), ['gerada', 'origem_alterada', 'entrega_adicionada', 'situacao_aprovada', 'situacao_entregue', 'status_entregue'])
    assert.equal((await hist(`where acao='entrega_adicionada'`))[0].detalhe, 'Pedro')
    assert.equal((await hist(`where entidade='bonificacao'`))[0].reconhecimento_id, rec, 'a bonificação aparece na linha do tempo do reconhecimento de origem')

    // regras, tipos e núcleos também são auditados
    await db.query(`insert into regras_bonificacao(nome, tipo_id, gatilho, tipo_premiacao) values ('R1',$1,'cada_reconhecimento','item')`, [rg])
    await db.query(`insert into reconhecimento_nucleos(nucleo, elegivel) values ('Marketing', false)`)
    await db.query(`update reconhecimento_tipos set ativo = false where id = $1`, [rg])
    assert.deepEqual((await hist(`where entidade in ('regra','nucleo','tipo')`)).map(x => `${x.acao}:${x.detalhe}`), ['regra_criada:R1', 'nucleo_configurado:Marketing', 'tipo_editado:RG / Projeto Reconhecido'])
})

test('sem cabeçalho de autor o histórico registra "desconhecido" (nunca deixa de gravar)', async () => {
    const db = await bancoComMigration()
    await db.query(`insert into reconhecimento_tipos(nome, escopo) values ('Novo','colaborador')`)
    const h = (await db.query(`select usuario_email, usuario_id from reconhecimento_historico where usuario_email <> 'sistema (migração)'`)).rows
    assert.deepEqual(h, [{ usuario_email: 'desconhecido', usuario_id: null }])
    await db.query(`select set_config('request.headers', 'lixo-que-nao-e-json', false)`)
    await db.query(`insert into reconhecimento_tipos(nome, escopo) values ('Novo2','colaborador')`)
    assert.equal((await db.query(`select usuario_email from reconhecimento_historico order by created_at desc limit 1`)).rows[0].usuario_email, 'desconhecido')
    await db.query(`select set_config('request.headers', '{"x-app-usuario-email":"a@b.c","x-app-usuario-id":"nao-uuid"}', false)`)
    await db.query(`insert into reconhecimento_tipos(nome, escopo) values ('Novo3','colaborador')`)
    const ultimo = (await db.query(`select usuario_email, usuario_id from reconhecimento_historico order by created_at desc limit 1`)).rows[0]
    assert.deepEqual(ultimo, { usuario_email: 'a@b.c', usuario_id: null })
})

test('histórico IMUTÁVEL: UPDATE, DELETE e TRUNCATE bloqueados até para o dono; rollback desfaz junto com a alteração', async () => {
    const db = await bancoComMigration(); await comAutor(db)
    await db.query(`insert into reconhecimento_tipos(nome, escopo) values ('Novo','colaborador')`)
    for (const sql of [`update reconhecimento_historico set acao='x'`, `delete from reconhecimento_historico`, `truncate reconhecimento_historico`]) {
        assert.match(await falha(() => db.query(sql)) ?? `ACEITOU ${sql}`, /imutável/, sql)
    }
    await db.exec('SET ROLE service_role')
    assert.match(await falha(() => db.query(`delete from reconhecimento_historico`)) ?? 'ACEITOU', /imutável/, 'nem a service role')
    await db.exec('RESET ROLE')
    // atomicidade: a alteração e o histórico entram e saem juntos
    const antes = await contar(db, 'reconhecimento_historico')
    await db.exec('BEGIN')
    await db.query(`insert into reconhecimento_tipos(nome, escopo) values ('Transitório','colaborador')`)
    assert.equal(await contar(db, 'reconhecimento_historico'), antes + 1)
    await db.exec('ROLLBACK')
    assert.equal(await contar(db, 'reconhecimento_historico'), antes)
    assert.equal((await db.query(`select count(*)::int n from reconhecimento_tipos where nome='Transitório'`)).rows[0].n, 0)
})

test('função compartilhada ausente: a migration ABORTA sem criar nada', async () => {
    const sem = await novoBanco({ semFuncao: true })
    const msg = await falha(() => sem.exec(MIGRATION))
    assert.match(msg ?? 'ACEITOU', /Pré-requisito ausente/)
    await sem.exec('ROLLBACK')
    assert.equal((await sem.query(`select count(*)::int n from information_schema.tables where table_schema='public' and table_name = any($1)`, [TABELAS])).rows[0].n, 0)
    assert.equal((await sem.query(`select count(*)::int n from pg_proc where proname like 'rec\\_%'`)).rows[0].n, 0)
})

test('atomicidade: erro DEPOIS de criar as tabelas desfaz tudo', async () => {
    const db = new (await import('@electric-sql/pglite')).PGlite()
    // sem o papel service_role: o GRANT falha depois de as tabelas já terem sido criadas
    await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
        CREATE FUNCTION public.update_updated_at_column() RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;`)
    assert.match(await falha(() => db.exec(MIGRATION)) ?? 'ACEITOU', /service_role/)
    await db.exec('ROLLBACK')
    assert.equal((await db.query(`select count(*)::int n from information_schema.tables where table_schema='public' and table_name = any($1)`, [TABELAS])).rows[0].n, 0)
    assert.equal((await db.query(`select count(*)::int n from pg_proc where proname like 'rec\\_%'`)).rows[0].n, 0)
    await db.exec(`CREATE ROLE service_role NOLOGIN BYPASSRLS`)
    await db.exec(MIGRATION)
    assert.equal(await contar(db, 'reconhecimento_tipos'), 7)
})

test('rollback remove só o que a migration criou e permite reaplicar', async () => {
    const db = await bancoComMigration()
    await db.exec(ROLLBACK)
    assert.deepEqual((await db.query(`select table_name from information_schema.tables where table_schema='public' order by 1`)).rows.map(r => r.table_name), ['colaboradores', 'projetos', 'users'])
    assert.equal((await db.query(`select count(*)::int n from pg_proc where proname = 'update_updated_at_column'`)).rows[0].n, 1, 'função compartilhada preservada')
    assert.equal((await db.query(`select count(*)::int n from pg_proc where proname like 'rec\\_%'`)).rows[0].n, 0)
    await db.exec(ROLLBACK) // idempotente
    await db.exec(MIGRATION)
    assert.equal(await contar(db, 'reconhecimento_tipos'), 7)
})

test('auditoria de catálogo: antes × depois — nada preexistente removido ou alterado', async () => {
    const db = await novoBanco()
    await db.exec(`
        CREATE INDEX projetos_status_idx ON public.projetos (status);
        ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Allow all projetos" ON public.projetos FOR ALL USING (true) WITH CHECK (true);
        CREATE TRIGGER update_projetos_x BEFORE UPDATE ON public.projetos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos TO anon, authenticated;
        INSERT INTO public.projetos(nome) VALUES ('A'), ('B');
        INSERT INTO public.colaboradores(nome, email_corporativo) VALUES ('Ana', 'ana@pj.com');
        CREATE VIEW public.v_existente AS SELECT id, nome FROM public.projetos;`)
    const snap = async () => {
        const q = async (sql) => (await db.query(sql)).rows.map(r => JSON.stringify(r))
        return {
            relacoes: await q(`select c.relname, c.relkind, c.relrowsecurity rls, c.relacl::text acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v','S','i') order by 1`),
            colunas: await q(`select table_name, column_name, data_type, is_nullable, coalesce(column_default,'') d from information_schema.columns where table_schema='public' order by 1,2`),
            constraints: await q(`select conrelid::regclass::text t, conname, pg_get_constraintdef(oid) d from pg_constraint where connamespace='public'::regnamespace order by 1,2`),
            indices: await q(`select tablename, indexname, indexdef from pg_indexes where schemaname='public' order by 1,2`),
            triggers: await q(`select event_object_table t, trigger_name, action_statement from information_schema.triggers where event_object_schema='public' order by 1,2`),
            policies: await q(`select tablename, policyname, cmd, qual from pg_policies where schemaname='public' order by 1,2`),
            funcoes: await q(`select proname, md5(prosrc) h from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1`),
            dados: await q(`select 'projetos' t, count(*)::int n from projetos union all select 'colaboradores', count(*)::int from colaboradores union all select 'users', count(*)::int from users`),
            papeis: await q(`select rolname from pg_roles where rolname in ('anon','authenticated','service_role') order by 1`),
        }
    }
    const antes = await snap()
    await db.exec(MIGRATION)
    const depois = await snap()
    const novas = new Set(TABELAS)
    const ehNova = (linha) => {
        const o = JSON.parse(linha)
        if (o.proname) return /^rec_/.test(o.proname)
        const tabela = o.relname ?? o.table_name ?? o.t ?? o.tablename
        if (o.relkind === 'i') return TABELAS.some(t => String(o.relname).startsWith(t)) || /_unq$|_idx$|^entregas_|^historico_|^regras_/.test(o.relname)
        return novas.has(tabela)
    }
    for (const cat of Object.keys(antes)) {
        const a = new Set(antes[cat]), d = new Set(depois[cat])
        assert.deepEqual(antes[cat].filter(x => !d.has(x)), [], `${cat}: algo preexistente foi removido/alterado`)
        assert.deepEqual(depois[cat].filter(x => !a.has(x) && !ehNova(x)), [], `${cat}: objeto novo fora do escopo da aba`)
    }
    assert.equal(depois.funcoes.length - antes.funcoes.length, 2, 'exatamente 2 funções novas')
})
