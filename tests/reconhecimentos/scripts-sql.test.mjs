// Scripts SQL de apoio à aplicação, exercitados em PostgreSQL real (PGlite) com a base do portal:
//   * DRY-RUN: aplica a migration + verificações e DESFAZ tudo (nada fica gravado);
//   * LIMPEZA dos dados de teste: simulação por padrão, confirmação explícita, histórico volta a ser imutável.
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { novoBanco, bancoComMigration, comAutor, TABELAS } from './pg-base.mjs'
import { gerarDryRun, ARQUIVO_DRY_RUN, ARQUIVO_MIGRATION } from './gerar-dry-run.mjs'

const DRY = fs.readFileSync(ARQUIVO_DRY_RUN, 'utf8')
const LIMPEZA = fs.readFileSync(new URL('../../supabase/rollbacks/20261020_reconhecimentos_LIMPAR_DADOS_DE_TESTE.sql', import.meta.url), 'utf8')

// Banco "de produção" simulado: as tabelas do portal + um pouco de estrutura própria para provar que nada muda.
async function banco() {
    const pg = await novoBanco()
    await pg.exec(`
        ALTER TABLE public.projetos ENABLE ROW LEVEL SECURITY;
        CREATE POLICY projetos_leitura ON public.projetos FOR SELECT USING (true);
        CREATE TRIGGER projetos_updated BEFORE UPDATE ON public.projetos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
        CREATE VIEW public.v_projetos AS SELECT id, nome FROM public.projetos;
        INSERT INTO public.projetos (nome) VALUES ('Prorestaure'), ('Aries');`)
    return pg
}
const rodar = async (pg, sql) => { try { await pg.exec(sql); return { ok: true, msg: '' } } catch (e) { return { ok: false, msg: e.message } } }
const existe = async (pg, tabela) => (await pg.query(`select to_regclass($1) as r`, [`public.${tabela}`])).rows[0].r !== null
const foto = async (pg) => JSON.stringify((await pg.query(`
    select 'rel', relname::text || relkind::text, relrowsecurity::text from pg_class where relnamespace = 'public'::regnamespace
    union all select 'trg', tgname::text, tgrelid::regclass::text from pg_trigger where not tgisinternal
    union all select 'pol', policyname::text, tablename::text from pg_policies where schemaname = 'public'
    union all select 'fun', proname::text, '' from pg_proc where pronamespace = 'public'::regnamespace
    union all select 'dado', nome, status from public.projetos order by 1, 2, 3`)).rows)

test('o DRY-RUN versionado é exatamente o gerado a partir da migration atual', () => {
    assert.equal(DRY, gerarDryRun(fs.readFileSync(ARQUIVO_MIGRATION, 'utf8')))
})

test('DRY-RUN em banco SEM as tabelas: todas as verificações passam e NADA fica gravado', async () => {
    const pg = await banco()
    const antes = await foto(pg)
    const r = await rodar(pg, DRY)
    assert.equal(r.ok, false, 'o dry-run termina de propósito com uma exceção')
    assert.match(r.msg, /DRY-RUN CONCLUÍDO — NADA FOI GRAVADO/)
    assert.match(r.msg, /RESULTADO: TODAS AS \d+ VERIFICAÇÕES PASSARAM\./, r.msg)
    assert.ok(!/FALHA/.test(r.msg), r.msg)
    for (const t of TABELAS) assert.equal(await existe(pg, t), false, `${t} não deveria existir`)
    assert.equal((await pg.query(`select count(*)::int n from pg_proc where proname like 'rec\\_%'`)).rows[0].n, 0)
    assert.equal(await foto(pg), antes, 'o catálogo e os dados são idênticos antes e depois')
    assert.ok(r.msg.includes('anon NÃO lê reconhecimentos') && r.msg.includes('histórico: TRUNCATE é bloqueado'))
})

test('DRY-RUN em banco que JÁ tem a migration: passa e não altera nem apaga nada', async () => {
    const pg = await bancoComMigration()
    await comAutor(pg, 'real@pj.com')
    await pg.query(`insert into reconhecimentos (tipo_id, data_reconhecimento, colaborador_id, colaborador_nome, periodo_referencia, criado_por_email)
        select id, current_date, gen_random_uuid(), 'Real', '2026-01-01', 'real@pj.com' from reconhecimento_tipos where nome = 'SDR do Mês'`)
    const linhas = async () => JSON.stringify((await pg.query(`select 'rec', id::text from reconhecimentos union all select 'his', id::text from reconhecimento_historico order by 1, 2`)).rows)
    const antes = await linhas()
    const r = await rodar(pg, DRY)
    assert.match(r.msg, /TODAS AS \d+ VERIFICAÇÕES PASSARAM/, r.msg)
    assert.equal(await linhas(), antes)
})

test('DRY-RUN detecta problema de verdade: se anon puder ler, reporta FALHA', async () => {
    const pg = await banco()
    const defeituosa = fs.readFileSync(ARQUIVO_MIGRATION, 'utf8').replace(`REVOKE ALL ON public.%I FROM anon, authenticated`, `SELECT 1 /* %I */`)
    assert.notEqual(defeituosa, fs.readFileSync(ARQUIVO_MIGRATION, 'utf8'))
    const r = await rodar(pg, gerarDryRun(defeituosa))
    assert.match(r.msg, /FALHA\s+anon NÃO lê reconhecimentos/, r.msg)
    assert.match(r.msg, /NÃO aplique a migration/)
    assert.equal(await existe(pg, 'reconhecimentos'), false, 'mesmo com falha nada foi gravado')
})

test('DRY-RUN sem a função compartilhada: aborta com mensagem clara e nada é criado', async () => {
    const pg = await novoBanco({ semFuncao: true })
    const r = await rodar(pg, DRY)
    assert.match(r.msg, /Pré-requisito ausente: função public\.update_updated_at_column/)
    assert.equal(await existe(pg, 'reconhecimentos'), false)
})

test('DRY-RUN detecta objeto preexistente alterado pela migration (policy criada em tabela existente)', async () => {
    const pg = await banco()
    const suja = fs.readFileSync(ARQUIVO_MIGRATION, 'utf8').replace('NOTIFY pgrst', `CREATE POLICY intrusa ON public.projetos FOR DELETE USING (true);\nNOTIFY pgrst`)
    const r = await rodar(pg, gerarDryRun(suja))
    assert.match(r.msg, /FALHA\s+policies: nenhuma criada, removida ou alterada|FALHA\s+o conjunto de policies mudou/, r.msg)
})

test('LIMPEZA: por padrão é só simulação (mostra o que seria apagado e quem criou) e não apaga nada', async () => {
    const pg = await bancoComMigration()
    await comAutor(pg, 'teste@pj.com')
    await pg.query(`insert into reconhecimentos (tipo_id, data_reconhecimento, projeto_id, numero_rg, criado_por_email) select id, current_date, gen_random_uuid(), 1, 'teste@pj.com' from reconhecimento_tipos where nome like 'RG%'`)
    const r = await rodar(pg, LIMPEZA)
    assert.match(r.msg, /SIMULAÇÃO — nada foi apagado/)
    assert.match(r.msg, /1 reconhecimentos/); assert.match(r.msg, /teste@pj\.com \(1 eventos\)/)
    assert.equal((await pg.query(`select count(*)::int n from reconhecimentos`)).rows[0].n, 1)
})

test('LIMPEZA confirmada: zera só os dados da aba, mantém os 7 tipos e o histórico volta a ser imutável', async () => {
    const pg = await banco()
    await pg.exec(await (async () => fs.readFileSync(ARQUIVO_MIGRATION, 'utf8'))())
    await comAutor(pg, 'teste@pj.com')
    await pg.query(`insert into reconhecimentos (tipo_id, data_reconhecimento, projeto_id, numero_rg, criado_por_email) select id, current_date, gen_random_uuid(), 1, 'teste@pj.com' from reconhecimento_tipos where nome like 'RG%'`)
    await pg.query(`insert into regras_bonificacao (nome, tipo_id, gatilho, tipo_premiacao) select 'r', id, 'cada_reconhecimento', 'simbolica' from reconhecimento_tipos limit 1`)
    const projetosAntes = JSON.stringify((await pg.query(`select * from projetos order by nome`)).rows)
    const r = await rodar(pg, LIMPEZA.replace('confirmar constant boolean := false', 'confirmar constant boolean := true'))
    assert.equal(r.ok, true, r.msg)
    for (const t of ['reconhecimentos', 'regras_bonificacao', 'bonificacoes', 'bonificacao_entregas', 'reconhecimento_historico'])
        assert.equal((await pg.query(`select count(*)::int n from ${t}`)).rows[0].n, 0, t)
    assert.equal((await pg.query(`select count(*)::int n from reconhecimento_tipos`)).rows[0].n, 7)
    assert.equal(JSON.stringify((await pg.query(`select * from projetos order by nome`)).rows), projetosAntes, 'tabelas preexistentes intactas')
    // o bloqueio voltou: novo histórico é gravado e continua imutável
    await comAutor(pg, 'real@pj.com')
    await pg.query(`insert into reconhecimentos (tipo_id, data_reconhecimento, projeto_id, numero_rg, criado_por_email) select id, current_date, gen_random_uuid(), 1, 'real@pj.com' from reconhecimento_tipos where nome like 'RG%'`)
    assert.equal((await pg.query(`select count(*)::int n from reconhecimento_historico`)).rows[0].n, 1)
    await assert.rejects(pg.query(`delete from reconhecimento_historico`), /imutável/)
    await assert.rejects(pg.query(`truncate reconhecimento_historico`), /imutável/)
})
