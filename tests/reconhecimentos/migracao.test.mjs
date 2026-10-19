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
async function novoBanco() {
    const db = new PGlite()
    await db.exec(BASE)
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

pg('estrutura de colunas == schema.sql do pacote (mesmas 73 colunas, tipos e defaults)', async () => {
    const a = await novoBanco(); await a.exec(MIGRATION)
    const b = await novoBanco(); await b.exec(SCHEMA_ORIGINAL)
    const q = `select table_name, column_name, data_type, is_nullable, coalesce(column_default,'') d from information_schema.columns where table_schema='public' and table_name = any($1) order by 1,2`
    const ca = (await a.query(q, [TABELAS])).rows, cb = (await b.query(q, [TABELAS])).rows
    assert.equal(ca.length, 73)
    assert.deepEqual(ca, cb)
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
