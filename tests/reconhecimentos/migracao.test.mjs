// Valida a migration/rollback em PostgreSQL de verdade (PGlite, em memória).
// Requer @electric-sql/pglite (não é dependência do projeto):
//   mkdir /tmp/pg && cd /tmp/pg && npm init -y && npm i @electric-sql/pglite
//   PGLITE_MODULE=/tmp/pg/node_modules/@electric-sql/pglite/dist/index.js npm run test:reconhecimentos
// Sem a variável, os testes deste arquivo são ignorados. Nenhum banco real é tocado.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { randomUUID } from 'node:crypto'
import { calcularBonificacoes, chaveMarcoPorReconhecimento } from '../../src/lib/reconhecimentos/engine.ts'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const sql = (p) => fs.readFileSync(path.join(raiz, p), 'utf8')
const MIGRATION = sql('supabase/migrations/20261019_reconhecimentos_bonificacoes.sql')
const ROLLBACK = sql('supabase/rollbacks/20261019_reconhecimentos_bonificacoes_ROLLBACK.sql')
const SCHEMA_ORIGINAL = sql('docs/migracao-reconhecimentos/estrutura/schema.sql')
const TABELAS = ['reconhecimento_tipos', 'regras_bonificacao', 'reconhecimentos', 'bonificacoes', 'bonificacao_eventos', 'bonificacoes_config']

let PGlite = null
if (process.env.PGLITE_MODULE) ({ PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href))
const pg = PGlite ? test : test.skip

// Ambiente mínimo parecido com o Supabase: papéis e a função de updated_at preexistente.
const BASE = `
CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN; CREATE ROLE service_role NOLOGIN BYPASSRLS;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
CREATE TABLE public.projetos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), nome text UNIQUE NOT NULL);
CREATE TABLE public.colaboradores (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;
-- Simula o default do Supabase: tabelas novas em public ficam acessíveis a anon/authenticated.
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
`
async function novoBanco({ semFuncao = false } = {}) {
    const db = new PGlite()
    await db.exec(semFuncao ? BASE.replace(/CREATE OR REPLACE FUNCTION public\.update_updated_at_column[^\n]*\n/, '') : BASE)
    return db
}
const contar = async (db, t) => Number((await db.query(`select count(*)::int n from public.${t}`)).rows[0].n)
const falha = async (fn) => { try { await fn(); return null } catch (e) { return e.message } }

pg('aplica, é idempotente e semeia só o comprovado', async () => {
    const db = await novoBanco()
    await db.exec(MIGRATION)
    await db.exec(MIGRATION) // segunda execução não duplica nada
    assert.deepEqual(
        await Promise.all(['reconhecimento_tipos', 'regras_bonificacao', 'bonificacoes_config', 'reconhecimentos', 'bonificacoes', 'bonificacao_eventos'].map(t => contar(db, t))),
        [7, 6, 1, 0, 0, 0],
    )
    const tipos = (await db.query(`select nome, escopo, ativo, ordem from reconhecimento_tipos order by ordem`)).rows
    assert.deepEqual(tipos.map(t => [t.ordem, t.nome, t.escopo]), [
        [1, 'RG / Projeto reconhecido', 'projeto'], [2, 'Piloto de Elite', 'pessoa'], [3, 'Líder de Voo', 'pessoa'],
        [4, 'SDR do Mês', 'pessoa'], [5, 'Closer do Mês', 'pessoa'], [6, 'Consultor do Mês', 'pessoa'], [7, 'Núcleo de Impacto', 'pessoa'],
    ])
    // Confere as regras com dados-configuracao/regras_bonificacao.csv (linhas SEED/MIGRATION; as DEDUZIDAS ficam de fora).
    const csv = sql('docs/migracao-reconhecimentos/dados-configuracao/regras_bonificacao.csv').trim().split('\n').slice(1)
    const esperadas = csv.filter(l => !l.includes(',DEDUZIDO,')).map(l => {
        const m = l.match(/^(\d+),(.*?),([^,]*),(acumulado|por_reconhecimento|simbolico),(\d+),(\d+),(true|false),(\w+),(\d+),("[^"]*"|[^,]*),([^,]*),(true|false),/)
        return { ordem: Number(m[1]), nome: m[2], tipo: m[3], criterio: m[4], q: Number(m[5]), ciclo: Number(m[6]), adi: m[7] === 'true', prem: m[8], valor: Number(m[9]), desc: m[10].replace(/^"|"$/g, '') }
    })
    assert.equal(esperadas.length, 6)
    const regras = (await db.query(`select r.ordem, r.nome, t.nome tipo, r.criterio, r.quantidade_necessaria q, r.ciclo, r.requer_rg_adiantada adi, r.tipo_premiacao prem, r.valor::float valor, r.descricao_premiacao "desc", r.prazo_dias, r.ativo, r.requer_projeto_adiantado leg from regras_bonificacao r join reconhecimento_tipos t on t.id = r.tipo_id order by r.ordem`)).rows
    assert.deepEqual(regras.map(r => ({ ordem: r.ordem, nome: r.nome, tipo: r.tipo, criterio: r.criterio, q: r.q, ciclo: r.ciclo, adi: r.adi, prem: r.prem, valor: r.valor, desc: r.desc })), esperadas)
    assert.ok(regras.every(r => r.prazo_dias === null && r.ativo && r.leg === false))
    assert.equal((await db.query(`select prazo_padrao_dias from bonificacoes_config`)).rows[0].prazo_padrao_dias, null)
    // P-1/P-2: nenhuma regra de Piloto de Elite / Líder de Voo foi semeada.
    assert.equal(regras.filter(r => ['Piloto de Elite', 'Líder de Voo'].includes(r.tipo)).length, 0)
})

pg('estrutura de colunas == schema.sql do pacote (73 colunas) + 9 colunas de procedência', async () => {
    const a = await novoBanco(); await a.exec(MIGRATION)
    const b = await novoBanco(); await b.exec(SCHEMA_ORIGINAL)
    const q = `select table_name, column_name, data_type, is_nullable, coalesce(column_default,'') d from information_schema.columns where table_schema='public' and table_name = any($1) order by 1,2`
    const ca = (await a.query(q, [TABELAS])).rows, cb = (await b.query(q, [TABELAS])).rows
    assert.equal(cb.length, 73)
    const PROCEDENCIA = ['origem', 'origem_id', 'importado_em']
    const extras = ca.filter(c => PROCEDENCIA.includes(c.column_name))
    assert.deepEqual(extras.map(c => c.table_name).sort(), ['bonificacao_eventos', 'bonificacao_eventos', 'bonificacao_eventos', 'bonificacoes', 'bonificacoes', 'bonificacoes', 'reconhecimentos', 'reconhecimentos', 'reconhecimentos'])
    assert.deepEqual(ca.filter(c => !PROCEDENCIA.includes(c.column_name)), cb, 'tudo o mais é idêntico ao schema do pacote')
    const triggers = `select event_object_table t, trigger_name from information_schema.triggers where event_object_schema='public' order by 1,2`
    assert.deepEqual((await a.query(triggers)).rows, (await b.query(triggers)).rows)
})

pg('RLS restritivo: anon e authenticated não leem nem gravam; service_role sim', async () => {
    const db = await novoBanco(); await db.exec(MIGRATION)
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
        assert.match(await falha(() => db.query(`insert into public.reconhecimento_tipos(nome) values ('x')`)) ?? '', /permission denied/)
        await db.exec('RESET ROLE')
    }
    // Defesa em profundidade: mesmo se alguém conceder GRANT depois, o RLS sem policy devolve 0 linhas e bloqueia escrita.
    await db.exec(`GRANT ALL ON ALL TABLES IN SCHEMA public TO anon`)
    await db.exec('SET ROLE anon')
    assert.equal((await db.query(`select count(*)::int n from reconhecimento_tipos`)).rows[0].n, 0)
    assert.match(await falha(() => db.query(`insert into reconhecimento_tipos(nome) values ('x')`)) ?? '', /row-level security/)
    await db.exec('RESET ROLE')
    await db.exec('SET ROLE service_role')
    assert.equal((await db.query(`select count(*)::int n from reconhecimento_tipos`)).rows[0].n, 7)
    await db.exec(`insert into reconhecimento_tipos(nome) values ('via service role')`)
    await db.exec('RESET ROLE')
})

pg('constraints: status/enums/núcleo/unique rejeitam lixo e aceitam o que a UI original gravava', async () => {
    const db = await novoBanco(); await db.exec(MIGRATION)
    const tipo = (await db.query(`select id from reconhecimento_tipos where nome='SDR do Mês'`)).rows[0].id
    const ok = async (s, p) => db.query(s, p)
    // Aceitos: o que a interface original gravava
    await ok(`insert into reconhecimentos(tipo_id,data,pessoa_nome,nucleo_impacto,criado_por) values ($1,'2026-01-01','CIT','CIT','a@b.c')`, [tipo])
    await ok(`insert into reconhecimentos(tipo_id,data,projeto_id,projeto_nome,adiantado,rg_adiantada,projeto_adiantado) values ($1,'2026-01-01',gen_random_uuid(),'P',true,true,true)`, [tipo])
    await ok(`insert into bonificacoes(marco_chave,status,nucleo_impacto,descricao_premiacao) values ('k1','expirada','Vice-Presidência','')`)
    await ok(`insert into bonificacao_eventos(bonificacao_id,evento) select id,'entregue' from bonificacoes`)
    await ok(`insert into regras_bonificacao(nome,tipo_id,criterio,quantidade_necessaria,ciclo,prazo_dias,valor) values ('neg',$1,'acumulado',-3,-1,0,12.5)`, [tipo]) // original aceitava
    // Rejeitados
    const casos = [
        [`insert into bonificacoes(marco_chave) values ('k1')`, /unique/i],
        [`insert into bonificacoes(marco_chave,status) values ('k2','pago')`, /check/i],
        [`insert into bonificacoes(marco_chave,nucleo_impacto) values ('k3','Projetos')`, /check/i],
        [`insert into bonificacao_eventos(bonificacao_id,evento) select id,'apagada' from bonificacoes limit 1`, /check/i],
        [`insert into reconhecimento_tipos(nome,escopo) values ('x','equipe')`, /check/i],
        [`insert into regras_bonificacao(nome,criterio) values ('x','mensal')`, /check/i],
        [`insert into regras_bonificacao(nome,tipo_premiacao) values ('x','pix')`, /check/i],
        [`insert into reconhecimentos(tipo_id,data,nucleo_impacto) values ('${tipo}','2026-01-01','Vice Presidência')`, /check/i], // sem hífen NÃO vale
        [`insert into reconhecimentos(tipo_id,data) values (gen_random_uuid(),'2026-01-01')`, /foreign key/i],
        [`insert into reconhecimentos(tipo_id) values ('${tipo}')`, /null value/i],
    ]
    for (const [stmt, padrao] of casos) assert.match(await falha(() => db.query(stmt)) ?? 'ACEITOU', padrao, stmt)
})

pg('FKs e triggers: SET NULL, CASCADE e updated_at', async () => {
    const db = await novoBanco(); await db.exec(MIGRATION)
    const tipo = (await db.query(`select id from reconhecimento_tipos where nome='SDR do Mês'`)).rows[0].id
    const regra = (await db.query(`select id from regras_bonificacao where nome='SDR do Mês'`)).rows[0].id
    const rec = (await db.query(`insert into reconhecimentos(tipo_id,data,pessoa_nome) values ($1,'2026-01-01','Ana') returning id`, [tipo])).rows[0].id
    const bon = (await db.query(`insert into bonificacoes(marco_chave,regra_id,reconhecimento_id) values ('k',$1,$2) returning id`, [regra, rec])).rows[0].id
    await db.query(`insert into bonificacao_eventos(bonificacao_id,evento) values ($1,'criada')`, [bon])

    await db.exec(`update reconhecimentos set updated_at = '2000-01-01' where id='${rec}'`)
    await db.exec(`update reconhecimentos set observacao = 'x' where id='${rec}'`)
    assert.ok((await db.query(`select updated_at > '2020-01-01' ok from reconhecimentos where id=$1`, [rec])).rows[0].ok, 'trigger de updated_at')

    await db.exec(`delete from reconhecimentos where id='${rec}'`)
    assert.equal((await db.query(`select reconhecimento_id from bonificacoes where id=$1`, [bon])).rows[0].reconhecimento_id, null, 'SET NULL')
    await db.exec(`delete from regras_bonificacao where id='${regra}'`)
    assert.equal((await db.query(`select regra_id from bonificacoes where id=$1`, [bon])).rows[0].regra_id, null, 'SET NULL')
    await db.exec(`delete from bonificacoes where id='${bon}'`)
    assert.equal(await contar(db, 'bonificacao_eventos'), 0, 'CASCADE')
    await db.exec(`delete from reconhecimento_tipos where id='${tipo}'`)
})

pg('rollback remove só as 6 tabelas e permite reaplicar', async () => {
    const db = await novoBanco(); await db.exec(MIGRATION)
    await db.exec(ROLLBACK)
    const restantes = (await db.query(`select table_name from information_schema.tables where table_schema='public' order by 1`)).rows.map(r => r.table_name)
    assert.deepEqual(restantes, ['colaboradores', 'projetos'])
    assert.equal((await db.query(`select count(*)::int n from pg_proc where proname='update_updated_at_column'`)).rows[0].n, 1, 'função compartilhada preservada')
    await db.exec(ROLLBACK) // idempotente
    await db.exec(MIGRATION)
    assert.equal(await contar(db, 'reconhecimento_tipos'), 7)
})

pg('migração não altera objetos preexistentes', async () => {
    const db = await novoBanco()
    const antes = JSON.stringify((await db.query(`select table_name, column_name from information_schema.columns where table_schema='public' and table_name in ('projetos','colaboradores') order by 1,2`)).rows)
    await db.exec(MIGRATION)
    const depois = JSON.stringify((await db.query(`select table_name, column_name from information_schema.columns where table_schema='public' and table_name in ('projetos','colaboradores') order by 1,2`)).rows)
    assert.equal(antes, depois)
    assert.equal((await db.query(`select count(*)::int n from pg_policies where schemaname='public' and tablename in ('projetos','colaboradores')`)).rows[0].n, 0)
})

pg('função update_updated_at_column ausente: a migration ABORTA sem criar nada; presente: não é tocada', async () => {
    const sem = await novoBanco({ semFuncao: true })
    const msg = await falha(() => sem.exec(MIGRATION))
    assert.match(msg ?? 'ACEITOU', /Pré-requisito ausente/)
    await sem.exec('ROLLBACK') // o SQL Editor/cliente encerra a transação abortada; aqui fazemos explicitamente
    assert.equal((await sem.query(`select count(*)::int n from information_schema.tables where table_schema='public' and table_name = any($1)`, [TABELAS])).rows[0].n, 0, 'nenhuma tabela foi criada')
    assert.equal((await sem.query(`select count(*)::int n from pg_proc where proname='update_updated_at_column'`)).rows[0].n, 0, 'a função não foi criada')

    const com = await novoBanco()
    await com.exec(`CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger AS $$ BEGIN NEW.updated_at = '2001-01-01'; RETURN NEW; END; $$ LANGUAGE plpgsql;`)
    await com.exec(MIGRATION)
    assert.match((await com.query(`select prosrc from pg_proc where proname='update_updated_at_column'`)).rows[0].prosrc, /2001-01-01/, 'a função existente não foi sobrescrita')
})

pg('atomicidade: erro DEPOIS de criar as tabelas desfaz tudo (nada fica pela metade)', async () => {
    const db = new PGlite()
    // Ambiente sem o papel service_role: o GRANT no fim da migration falha, depois de as tabelas já terem sido criadas.
    await db.exec(`CREATE ROLE anon NOLOGIN; CREATE ROLE authenticated NOLOGIN;
        CREATE FUNCTION public.update_updated_at_column() RETURNS trigger AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql;`)
    const msg = await falha(() => db.exec(MIGRATION))
    assert.match(msg ?? 'ACEITOU', /service_role/)
    await db.exec('ROLLBACK') // o cliente/SQL Editor encerra a transação abortada
    assert.equal((await db.query(`select count(*)::int n from information_schema.tables where table_schema='public' and table_name = any($1)`, [TABELAS])).rows[0].n, 0, 'nenhuma tabela ficou')
    assert.equal((await db.query(`select count(*)::int n from pg_indexes where schemaname='public' and indexname like '%origem_unq'`)).rows[0].n, 0)
    // e depois de corrigir o ambiente, aplica normalmente
    await db.exec(`CREATE ROLE service_role NOLOGIN BYPASSRLS`)
    await db.exec(MIGRATION)
    assert.equal(await contar(db, 'reconhecimento_tipos'), 7)
})

pg('procedência: CHECK e unicidade', async () => {
    const db = await novoBanco(); await db.exec(MIGRATION)
    const tipo = (await db.query(`select id from reconhecimento_tipos where nome='SDR do Mês'`)).rows[0].id
    const ins = (o, i) => db.query(`insert into reconhecimentos(tipo_id,data,origem,origem_id) values ($1,'2026-01-01',$2,$3)`, [tipo, o, i])
    await ins('sistema', null)
    await ins('sistema', null) // registros nativos podem repetir (origem_id nulo)
    await ins('sistema-antigo', 'a-1')
    assert.match(await falha(() => ins('sistema-antigo', 'a-1')) ?? 'ACEITOU', /unique/i)
    await ins('outra-origem', 'a-1') // mesma id em outra origem não conflita
    assert.match(await falha(() => ins('sistema', 'x')) ?? 'ACEITOU', /check/i, 'nativo não pode ter origem_id')
    assert.match(await falha(() => ins('sistema-antigo', null)) ?? 'ACEITOU', /check/i, 'importado precisa de origem_id')
})

pg('importação histórica: idempotente, não sobrescreve o novo e as chaves batem com as do motor', async () => {
    const db = await novoBanco(); await db.exec(MIGRATION)
    const q = async (sql, p) => (await db.query(sql, p)).rows
    const tipoSdr = (await q(`select id from reconhecimento_tipos where nome='SDR do Mês'`))[0].id
    const regraNova = (await q(`select * from regras_bonificacao where nome='SDR do Mês'`))[0]

    // 1) Registros NOVOS, criados pelo sistema atual (reconhecimento + bonificação gerada pelo motor)
    const recNova = (await q(`insert into reconhecimentos(tipo_id,data,pessoa_nome,criado_por) values ($1,'2026-05-01','Ana','vp@pj.com') returning *`, [tipoSdr]))[0]
    const iso = (d) => (d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10))
    const lerEstado = async () => ({
        regras: (await q(`select id,nome,tipo_id,criterio,quantidade_necessaria,ciclo,requer_rg_adiantada,requer_projeto_adiantado,tipo_premiacao,valor::float valor,descricao_premiacao,prazo_dias from regras_bonificacao`)).map(r => ({ ...r, reconhecimento_tipos: { nome: 'SDR do Mês' } })),
        recs: (await q(`select * from reconhecimentos order by data, created_at, id`)).map(r => ({ ...r, data: iso(r.data) })),
        bons: await q(`select id, marco_chave, status, prazo_limite from bonificacoes`),
    })
    const sincronizar = async () => {
        const e = await lerEstado()
        const r = calcularBonificacoes(e.regras.filter(x => x.nome === 'SDR do Mês'), e.recs, null, e.bons, '2026-10-19')
        for (const b of r.novas) await db.query(`insert into bonificacoes(regra_id,reconhecimento_id,marco_chave,marco,pessoa_nome,tipo_nome,regra_nome,motivo,valor,liberada_em) values ($1,$2,$3,1,$4,'SDR do Mês','SDR do Mês','SDR do Mês',50,$5)`, [b.regra_id, b.reconhecimento_id, b.marco_chave, b.pessoa_nome, b.liberada_em])
        return r.novas.length
    }
    assert.equal(await sincronizar(), 1)
    const fotoNovos = JSON.stringify(await q(`select * from reconhecimentos where origem = 'sistema'`))
    const bonNova = (await q(`select * from bonificacoes`))[0]

    // 2) Histórico do sistema ANTERIOR (ids e chaves antigos) — importação com remapeamento
    const antigo = { regraId: randomUUID(), recId: randomUUID(), bonId: randomUUID(), eventoId: randomUUID() }
    const importar = async (remapear = true) => {
        await db.query(`insert into reconhecimentos(id,tipo_id,data,pessoa_nome,criado_por,origem,origem_id,importado_em,created_at) values ($1::uuid,$2,'2026-01-10','Bia','antigo@pj.com','sistema-antigo',$1::text,now(),'2026-01-10T12:00:00Z') on conflict do nothing`, [antigo.recId, tipoSdr])
        // a chave é recalculada com a MESMA função do motor, usando o id da regra NOVA
        const chave = chaveMarcoPorReconhecimento(remapear ? regraNova.id : antigo.regraId, antigo.recId)
        await db.query(`insert into bonificacoes(id,regra_id,reconhecimento_id,marco_chave,marco,pessoa_nome,tipo_nome,regra_nome,motivo,valor,descricao_premiacao,status,liberada_em,entregue_em,entregue_por,entregue_para,origem,origem_id,importado_em)
            values ($1::uuid,$2,$3,$4,1,'Bia','SDR do Mês','SDR do Mês','SDR do Mês',50,'R$ 50,00','entregue','2026-01-10','2026-01-20T10:00:00Z','antigo@pj.com','Bia','sistema-antigo',$1::text,now()) on conflict do nothing`, [antigo.bonId, regraNova.id, antigo.recId, chave])
        await db.query(`insert into bonificacao_eventos(bonificacao_id,evento,detalhe,usuario,origem,origem_id,importado_em,created_at)
            values ($1,'entregue','Entregue para: Bia','antigo@pj.com','sistema-antigo',$2,now(),'2026-01-20T10:00:00Z') on conflict do nothing`, [antigo.bonId, antigo.eventoId])
    }
    await importar(); await importar(); await importar() // reexecutar não duplica
    const cont = async (t, o) => Number((await q(`select count(*)::int n from ${t} where origem = '${o}'`))[0].n)
    assert.deepEqual([await cont('reconhecimentos', 'sistema-antigo'), await cont('bonificacoes', 'sistema-antigo'), await cont('bonificacao_eventos', 'sistema-antigo')], [1, 1, 1])

    // 3) Os registros novos permanecem intactos
    assert.equal(JSON.stringify(await q(`select * from reconhecimentos where origem = 'sistema'`)), fotoNovos, 'reconhecimento novo intacto')
    assert.deepEqual((await q(`select id, marco_chave, status, valor::float valor from bonificacoes where origem = 'sistema'`)), [{ id: bonNova.id, marco_chave: bonNova.marco_chave, status: 'disponivel', valor: 50 }])
    assert.equal((await q(`select pessoa_nome from reconhecimentos where id = $1`, [recNova.id]))[0].pessoa_nome, 'Ana')

    // 4) O motor reconhece a bonificação histórica e NÃO a recria
    assert.equal(await sincronizar(), 0, 'com a chave remapeada, nada é duplicado')

    // 5) Contraexemplo: sem remapear a chave, o motor recriaria a bonificação histórica (duplicidade)
    await db.exec(`delete from bonificacao_eventos where origem = 'sistema-antigo'; delete from bonificacoes where origem = 'sistema-antigo'; delete from reconhecimentos where origem = 'sistema-antigo'`)
    await importar(false)
    assert.equal(await sincronizar(), 1, 'documenta o risco: chave antiga => duplicidade')
})

pg('auditoria de catálogo: antes × depois — nada removido nem alterado, só objetos das 6 tabelas', async () => {
    const db = await novoBanco()
    // Objetos "de produção" preexistentes, para que qualquer efeito colateral apareça no diff.
    await db.exec(`
        ALTER TABLE public.projetos ADD COLUMN status text DEFAULT 'Ativo';
        CREATE INDEX projetos_status_idx ON public.projetos (status);
        ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "Allow all projetos" ON public.projetos FOR ALL USING (true) WITH CHECK (true);
        CREATE TRIGGER update_projetos_updated_at BEFORE UPDATE ON public.projetos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
        GRANT SELECT, INSERT, UPDATE, DELETE ON public.projetos TO anon, authenticated;
        INSERT INTO public.projetos(nome) VALUES ('Projeto A'), ('Projeto B');
        CREATE SEQUENCE public.seq_existente;
        CREATE VIEW public.v_existente AS SELECT id, nome FROM public.projetos;
    `)
    const snapshot = async () => {
        const q = async (sql) => (await db.query(sql)).rows.map(r => JSON.stringify(r))
        return {
            relacoes: await q(`select c.relname, c.relkind, c.relrowsecurity rls, c.relacl::text acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('r','v','S','i') order by 1`),
            colunas: await q(`select table_name, column_name, data_type, is_nullable, coalesce(column_default,'') d from information_schema.columns where table_schema='public' order by 1,2`),
            constraints: await q(`select conrelid::regclass::text t, conname, pg_get_constraintdef(oid) d from pg_constraint where connamespace='public'::regnamespace order by 1,2`),
            indices: await q(`select tablename, indexname, indexdef from pg_indexes where schemaname='public' order by 1,2`),
            triggers: await q(`select event_object_table t, trigger_name, action_statement from information_schema.triggers where event_object_schema='public' order by 1,2`),
            policies: await q(`select tablename, policyname, cmd, qual, with_check from pg_policies where schemaname='public' order by 1,2`),
            funcoes: await q(`select proname, md5(prosrc) h from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' order by 1`),
            grants: await q(`select table_name, grantee, privilege_type from information_schema.role_table_grants where table_schema='public' order by 1,2,3`),
            dados: await q(`select 'projetos' t, count(*)::int n from public.projetos`),
            papeis: await q(`select rolname from pg_roles where rolname in ('anon','authenticated','service_role') order by 1`),
            extensoes: await q(`select extname from pg_extension order by 1`),
        }
    }
    const antes = await snapshot()
    await db.exec(MIGRATION)
    const depois = await snapshot()

    const novas = new Set(TABELAS)
    const ehDasNovas = (linha) => {
        const o = JSON.parse(linha)
        const tabela = o.relname ?? o.table_name ?? o.t ?? o.tablename
        if (o.relkind === 'i') return TABELAS.some(t => String(o.relname).startsWith(t) || String(o.relname).endsWith('_origem_unq'))
        return novas.has(tabela)
    }
    const relatorio = {}
    for (const categoria of Object.keys(antes)) {
        const a = new Set(antes[categoria]), d = new Set(depois[categoria])
        const removidasOuAlteradas = antes[categoria].filter(x => !d.has(x))
        const adicionadas = depois[categoria].filter(x => !a.has(x))
        assert.deepEqual(removidasOuAlteradas, [], `${categoria}: algo preexistente foi removido/alterado`)
        const estranhas = adicionadas.filter(x => !ehDasNovas(x))
        assert.deepEqual(estranhas, [], `${categoria}: objeto novo que não pertence às 6 tabelas`)
        relatorio[categoria] = adicionadas.length
    }
    // A auditoria precisa de fato ter enxergado a criação (não pode ser vácua).
    assert.equal(relatorio.relacoes >= 6 + 6 + 3, true, JSON.stringify(relatorio)) // 6 tabelas + PKs + índices
    assert.equal(relatorio.triggers, 4)
    assert.equal(relatorio.policies, 0)
    assert.equal(relatorio.funcoes, 0)
    assert.equal(relatorio.dados, 0)
    console.log('      objetos novos por categoria:', JSON.stringify(relatorio))
})
