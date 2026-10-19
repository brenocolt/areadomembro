// Valida que estrutura/schema.sql == cadeia de migrations originais (colunas, constraints, triggers, políticas)
// usando PostgreSQL em memória (PGlite). Não toca em nenhum banco real.
// Uso:  mkdir /tmp/v && cd /tmp/v && npm init -y && npm i @electric-sql/pglite
//       cp <esta-pasta>/validar-schema.mjs . && PACOTE=<caminho>/docs/migracao-reconhecimentos node validar-schema.mjs
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const R=process.env.PACOTE;
const M=R+'/codigo-fonte/aba-exclusiva/supabase/migrations/';
const stub = `
CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
CREATE TABLE public.projetos_entradas (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger AS \$\$ BEGIN NEW.updated_at = now(); RETURN NEW; END; \$\$ LANGUAGE plpgsql;
`;
const tabs=['reconhecimento_tipos','regras_bonificacao','reconhecimentos','bonificacoes','bonificacao_eventos','bonificacoes_config'];
const dump = async (db) => {
  const cols = await db.query(`select table_name, column_name, data_type, is_nullable, column_default from information_schema.columns where table_schema='public' and table_name = any($1) order by 1,column_name`, [tabs]);
  const cons = await db.query(`select conrelid::regclass::text t, pg_get_constraintdef(oid) d, contype from pg_constraint where connamespace='public'::regnamespace and conrelid::regclass::text = any($1) order by 1,3,2`, [tabs]);
  const trg = await db.query(`select event_object_table t, trigger_name from information_schema.triggers where event_object_schema='public' order by 1,2`);
  const pol = await db.query(`select tablename t, policyname from pg_policies where schemaname='public' order by 1,2`);
  return JSON.stringify({cols:cols.rows, cons:cons.rows, trg:trg.rows, pol:pol.rows});
};
// A) cadeia de migrations originais
const a = new PGlite(); await a.exec(stub);
for (const f of fs.readdirSync(M).sort()) { await a.exec(fs.readFileSync(M+f,'utf8')); }
// B) schema.sql consolidado (projeto_id sem FK => não precisa de projetos_entradas)
const b = new PGlite(); await b.exec(stub.replace(/CREATE TABLE public.projetos_entradas[^;]*;/,''));
await b.exec(fs.readFileSync(R+'/estrutura/schema.sql','utf8'));
const da = JSON.parse(await dump(a)), db_ = JSON.parse(await dump(b));
console.log('colunas A/B:', da.cols.length, db_.cols.length, '| igual:', JSON.stringify(da.cols)===JSON.stringify(db_.cols));
const norm = (x)=>x.map(r=>JSON.stringify(r)).sort();
const diff=(k)=>{const A=new Set(norm(da[k])),B=new Set(norm(db_[k])); return {soNaOrigem:[...A].filter(x=>!B.has(x)), soNoConsolidado:[...B].filter(x=>!A.has(x))}};
for (const k of ['cons','trg','pol']) console.log(k, JSON.stringify(diff(k)));
console.log('constraints (migrations):'); for (const r of da.cons) console.log(' ',r.t,r.contype,r.d);
// teste funcional rápido do consolidado: UNIQUE e CHECK
let e1,e2,e3;
await b.exec(`insert into reconhecimento_tipos(id,nome) values ('00000000-0000-0000-0000-000000000001','T')`);
await b.exec(`insert into bonificacoes(marco_chave) values ('k1')`);
try{await b.exec(`insert into bonificacoes(marco_chave) values ('k1')`)}catch(e){e1=e.message}
try{await b.exec(`insert into reconhecimentos(tipo_id,data,nucleo_impacto) values ('00000000-0000-0000-0000-000000000001','2026-01-01','Inexistente')`)}catch(e){e2=e.message}
await b.exec(`delete from reconhecimento_tipos`); // cascade
console.log('UNIQUE marco_chave:', e1); console.log('CHECK núcleo:', e2);
