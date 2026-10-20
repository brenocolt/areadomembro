// Gera supabase/dry-run/20261020_reconhecimentos_DRY_RUN.sql a partir da migration REAL (sem copiar/colar à mão).
// O arquivo gerado aplica a migration e roda verificações NO BANCO DE VERDADE dentro de UM ÚNICO comando (DO),
// que termina de propósito com uma exceção: o Postgres desfaz o comando inteiro, então NADA é gravado.
// Uso: node tests/reconhecimentos/gerar-dry-run.mjs   (reescreve o arquivo)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
export const ARQUIVO_MIGRATION = path.join(raiz, 'supabase/migrations/20261020_reconhecimentos_bonificacoes.sql')
export const ARQUIVO_DRY_RUN = path.join(raiz, 'supabase/dry-run/20261020_reconhecimentos_DRY_RUN.sql')

const CABECALHO = `-- DRY-RUN da migration 20261020_reconhecimentos_bonificacoes — NÃO GRAVA NADA
-- (gerado por tests/reconhecimentos/gerar-dry-run.mjs a partir da migration real; não edite à mão)
--
-- O que faz: aplica a migration inteira e roda verificações no banco real — dentro de UM ÚNICO comando (DO).
-- No fim ele lança uma exceção PROPOSITAL; o PostgreSQL desfaz o comando inteiro, então nenhuma tabela, função,
-- trigger ou linha permanece. Por isso o SQL Editor vai mostrar um ERRO em vermelho: é o relatório.
--   * "RESULTADO: TODAS AS N VERIFICAÇÕES PASSARAM" = a migration é segura neste banco.
--   * "FALHA" em qualquer linha = NÃO aplique a migration; envie o texto ao Claude.
--
-- Verifica: (1) nada preexistente foi criado/removido/alterado (relações, triggers, policies, funções, RLS);
-- (2) as 7 tabelas nascem com RLS e sem policies; (3) anon e authenticated NÃO leem nem gravam (mesmo com os
-- privilégios padrão do Supabase); (4) service_role funciona; (5) unicidade de RG, de período e de pessoa por
-- bonificação; (6) CHECKs; (7) histórico automático com autor e imutável (UPDATE/DELETE/TRUNCATE bloqueados).
-- Só lê o catálogo e escreve dados de teste que são descartados junto com tudo.
`

export function gerarDryRun(migration = fs.readFileSync(ARQUIVO_MIGRATION, 'utf8')) {
    if (migration.includes('$mig$') || migration.includes('$dry$')) throw new Error('a migration usa a marca $mig$/$dry$')
    // BEGIN/COMMIT não podem existir dentro de um bloco DO; o próprio bloco já é atômico.
    const corpo = migration.split('\n').filter(l => !/^\s*(BEGIN|COMMIT);\s*$/.test(l)).join('\n')
    return `${CABECALHO}
DO $dry$
DECLARE
  v_mig        text := $mig$
${corpo}
$mig$;
  v_tabelas    text[] := ARRAY['reconhecimento_tipos','reconhecimento_nucleos','reconhecimentos','regras_bonificacao','bonificacoes','bonificacao_entregas','reconhecimento_historico'];
  v_rel_antes  text[]; v_trg_antes text[]; v_pol_antes text[]; v_fun_antes text[]; v_rls_antes text[];
  v_depois     text[];
  v_n          int;
  v_ok         boolean;
  v_msg        text;
  t            record;
  v_linhas     text[] := '{}';
  v_falhas     int := 0;
  v_total      int := 0;
  v_tipo_rg    uuid;
  v_tipo_sdr   uuid;
  v_proj       uuid := gen_random_uuid();
  v_colab      uuid := gen_random_uuid();
  v_colab2     uuid := gen_random_uuid();
  v_bon        uuid := gen_random_uuid();
  v_ins_rec    text := 'INSERT INTO public.reconhecimentos (tipo_id, data_reconhecimento, projeto_id, projeto_nome, numero_rg, criado_por_email) VALUES (%L, current_date, %L, ''Projeto de teste'', %s, ''dry-run@teste'')';
BEGIN
  -- ---------------------------------------------------------------- foto do catálogo ANTES
  SELECT coalesce(array_agg(c.relname::text || ':' || c.relkind::text ORDER BY c.relname), '{}') INTO v_rel_antes
    FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace;
  SELECT coalesce(array_agg(c.relname::text || '.' || g.tgname ORDER BY c.relname, g.tgname), '{}') INTO v_trg_antes
    FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid WHERE c.relnamespace = 'public'::regnamespace AND NOT g.tgisinternal;
  SELECT coalesce(array_agg(p.tablename::text || '.' || p.policyname ORDER BY p.tablename, p.policyname), '{}') INTO v_pol_antes
    FROM pg_policies p WHERE p.schemaname = 'public';
  SELECT coalesce(array_agg(f.proname::text || '(' || oidvectortypes(f.proargtypes) || ')' ORDER BY f.proname, oidvectortypes(f.proargtypes)), '{}') INTO v_fun_antes
    FROM pg_proc f WHERE f.pronamespace = 'public'::regnamespace;
  SELECT coalesce(array_agg(c.relname::text || ':' || c.relrowsecurity::text ORDER BY c.relname), '{}') INTO v_rls_antes
    FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r';

  -- ---------------------------------------------------------------- aplica a migration (será desfeita)
  EXECUTE v_mig;

  -- ---------------------------------------------------------------- 1) nada preexistente foi tocado
  v_total := v_total + 1;
  SELECT count(*) INTO v_n FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace
     AND NOT (c.relname::text || ':' || c.relkind::text = ANY (v_rel_antes))
     AND c.relname::text <> ALL (v_tabelas)
     AND c.oid NOT IN (SELECT i.indexrelid FROM pg_index i JOIN pg_class tc ON tc.oid = i.indrelid
                        WHERE tc.relnamespace = 'public'::regnamespace AND tc.relname::text = ANY (v_tabelas));
  IF v_n = 0 THEN v_linhas := v_linhas || '  OK    nenhuma tabela/view/sequência nova além das 7 tabelas (e seus índices)'::text;
  ELSE v_falhas := v_falhas + 1; v_linhas := v_linhas || format('FALHA  %s objeto(s) novos inesperados em public', v_n); END IF;

  v_total := v_total + 1;
  SELECT count(*) INTO v_n FROM unnest(v_rel_antes) x
   WHERE NOT EXISTS (SELECT 1 FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relname::text || ':' || c.relkind::text = x);
  IF v_n = 0 THEN v_linhas := v_linhas || '  OK    nenhuma tabela/view/sequência/índice preexistente foi removido'::text;
  ELSE v_falhas := v_falhas + 1; v_linhas := v_linhas || format('FALHA  %s objeto(s) preexistentes sumiram', v_n); END IF;

  v_total := v_total + 1;
  SELECT coalesce(array_agg(c.relname::text || '.' || g.tgname), '{}') INTO v_depois
    FROM pg_trigger g JOIN pg_class c ON c.oid = g.tgrelid
   WHERE c.relnamespace = 'public'::regnamespace AND NOT g.tgisinternal;
  SELECT count(*) INTO v_n FROM unnest(v_depois) x
   WHERE NOT (x = ANY (v_trg_antes)) AND split_part(x, '.', 1) <> ALL (v_tabelas);
  v_msg := '';
  SELECT count(*) INTO t FROM unnest(v_trg_antes) x WHERE NOT (x = ANY (v_depois));
  IF v_n = 0 AND t.count = 0 THEN v_linhas := v_linhas || '  OK    triggers: só foram criados os das 7 tabelas novas; nenhum preexistente mudou'::text;
  ELSE v_falhas := v_falhas + 1; v_linhas := v_linhas || 'FALHA  triggers preexistentes alterados ou triggers novos fora das 7 tabelas'::text; END IF;

  v_total := v_total + 1;
  SELECT coalesce(array_agg(p.tablename::text || '.' || p.policyname ORDER BY p.tablename, p.policyname), '{}') INTO v_depois
    FROM pg_policies p WHERE p.schemaname = 'public';
  IF v_depois IS NOT DISTINCT FROM v_pol_antes THEN v_linhas := v_linhas || '  OK    policies: nenhuma criada, removida ou alterada'::text;
  ELSE v_falhas := v_falhas + 1; v_linhas := v_linhas || 'FALHA  o conjunto de policies mudou'::text; END IF;

  v_total := v_total + 1;
  SELECT coalesce(array_agg(f.proname::text || '(' || oidvectortypes(f.proargtypes) || ')'), '{}') INTO v_depois
    FROM pg_proc f WHERE f.pronamespace = 'public'::regnamespace;
  SELECT count(*) INTO v_n FROM unnest(v_depois) x WHERE NOT (x = ANY (v_fun_antes)) AND x NOT LIKE 'rec\\_%';
  SELECT count(*) INTO t FROM unnest(v_fun_antes) x WHERE NOT (x = ANY (v_depois));
  IF v_n = 0 AND t.count = 0 THEN v_linhas := v_linhas || '  OK    funções: só rec_registrar_historico e rec_historico_imutavel foram criadas; nenhuma preexistente mudou'::text;
  ELSE v_falhas := v_falhas + 1; v_linhas := v_linhas || 'FALHA  funções preexistentes alteradas ou funções novas inesperadas'::text; END IF;

  v_total := v_total + 1;
  SELECT count(*) INTO v_n FROM pg_class c
   WHERE c.relnamespace = 'public'::regnamespace AND c.relkind = 'r' AND (c.relname::text || ':' || c.relrowsecurity::text) = ANY (v_rls_antes);
  IF v_n = cardinality(v_rls_antes) THEN v_linhas := v_linhas || format('  OK    RLS das %s tabelas preexistentes inalterado', v_n);
  ELSE v_falhas := v_falhas + 1; v_linhas := v_linhas || 'FALHA  o RLS de alguma tabela preexistente mudou'::text; END IF;

  -- ---------------------------------------------------------------- 2) estado das 7 tabelas novas
  v_total := v_total + 1;
  SELECT count(*) INTO v_n FROM pg_class c WHERE c.relnamespace = 'public'::regnamespace AND c.relname::text = ANY (v_tabelas) AND c.relkind = 'r' AND c.relrowsecurity;
  SELECT count(*) INTO t FROM pg_policies p WHERE p.schemaname = 'public' AND p.tablename = ANY (v_tabelas);
  IF v_n = 7 AND t.count = 0 THEN v_linhas := v_linhas || '  OK    7 tabelas criadas, todas com RLS ligado e 0 policies'::text;
  ELSE v_falhas := v_falhas + 1; v_linhas := v_linhas || format('FALHA  tabelas com RLS = %s (esperado 7); policies = %s (esperado 0)', v_n, t.count); END IF;

  v_total := v_total + 1;
  SELECT count(*) INTO v_n FROM public.reconhecimento_tipos;
  SELECT count(*) INTO t FROM public.regras_bonificacao;
  IF v_n >= 7 AND t.count = 0 THEN v_linhas := v_linhas || format('  OK    dados iniciais: %s tipos e 0 regras (nenhum valor semeado)', v_n);
  ELSE v_falhas := v_falhas + 1; v_linhas := v_linhas || format('FALHA  tipos = %s; regras = %s', v_n, t.count); END IF;

  -- ---------------------------------------------------------------- 3) comportamento (papéis, unicidade, CHECKs, histórico)
  PERFORM set_config('request.headers', '{"x-app-usuario-email":"dry-run@teste","x-app-usuario-id":"00000000-0000-4000-8000-0000000000dd"}', true);
  SELECT id INTO v_tipo_rg  FROM public.reconhecimento_tipos WHERE nome = 'RG / Projeto Reconhecido';
  SELECT id INTO v_tipo_sdr FROM public.reconhecimento_tipos WHERE nome = 'SDR do Mês';

  FOR t IN SELECT * FROM (VALUES
    ('anon NÃO lê reconhecimentos',                    'anon',          'SELECT 1 FROM public.reconhecimentos', '42501'),
    ('anon NÃO lê o histórico',                        'anon',          'SELECT 1 FROM public.reconhecimento_historico', '42501'),
    ('anon NÃO lê os tipos',                           'anon',          'SELECT 1 FROM public.reconhecimento_tipos', '42501'),
    ('anon NÃO grava reconhecimentos',                 'anon',          format(v_ins_rec, v_tipo_rg, v_proj, 99), '42501'),
    ('authenticated NÃO lê bonificações',              'authenticated', 'SELECT 1 FROM public.bonificacoes', '42501'),
    ('authenticated NÃO lê as entregas',               'authenticated', 'SELECT 1 FROM public.bonificacao_entregas', '42501'),
    ('authenticated NÃO grava regras',                 'authenticated', format('INSERT INTO public.regras_bonificacao (nome, tipo_id, gatilho, tipo_premiacao) VALUES (''x'', %L, ''cada_reconhecimento'', ''simbolica'')', v_tipo_rg), '42501'),
    ('service_role grava a 1ª RG de um projeto',      'service_role',  format(v_ins_rec, v_tipo_rg, v_proj, 1), 'OK'),
    ('RG repetida no mesmo projeto é barrada',        'service_role',  format(v_ins_rec, v_tipo_rg, v_proj, 1), '23505'),
    ('2ª RG do mesmo projeto é aceita',               'service_role',  format(v_ins_rec, v_tipo_rg, v_proj, 2), 'OK'),
    ('número de RG 0 é barrado',                      'service_role',  format(v_ins_rec, v_tipo_rg, v_proj, 0), '23514'),
    ('reconhecimento individual com período',         'service_role',  format('INSERT INTO public.reconhecimentos (tipo_id, data_reconhecimento, colaborador_id, colaborador_nome, periodo_referencia, criado_por_email) VALUES (%L, current_date, %L, ''Pessoa de teste'', ''2099-01-01'', ''dry-run@teste'')', v_tipo_sdr, v_colab), 'OK'),
    ('mesmo colaborador/tipo/período é barrado',      'service_role',  format('INSERT INTO public.reconhecimentos (tipo_id, data_reconhecimento, colaborador_id, colaborador_nome, periodo_referencia, criado_por_email) VALUES (%L, current_date, %L, ''Pessoa de teste'', ''2099-01-01'', ''dry-run@teste'')', v_tipo_sdr, v_colab), '23505'),
    ('período fora do dia 1 é barrado',               'service_role',  format('INSERT INTO public.reconhecimentos (tipo_id, data_reconhecimento, colaborador_id, colaborador_nome, periodo_referencia, criado_por_email) VALUES (%L, current_date, %L, ''x'', ''2099-02-15'', ''dry-run@teste'')', v_tipo_sdr, v_colab2), '23514'),
    ('bonificação de teste',                          'service_role',  format('INSERT INTO public.bonificacoes (id, chave_unica, tipo_nome, regra_nome, motivo, tipo_premiacao, liberada_em) VALUES (%L, ''dry-run:1'', ''RG'', ''regra de teste'', ''teste'', ''simbolica'', current_date)', v_bon), 'OK'),
    ('mesma chave única não gera 2ª bonificação',    'service_role',  'INSERT INTO public.bonificacoes (chave_unica, tipo_nome, regra_nome, motivo, tipo_premiacao, liberada_em) VALUES (''dry-run:1'', ''RG'', ''r'', ''t'', ''simbolica'', current_date)', '23505'),
    ('entrega: 1ª pessoa entra na bonificação',      'service_role',  format('INSERT INTO public.bonificacao_entregas (bonificacao_id, colaborador_id, colaborador_nome) VALUES (%L, %L, ''Pessoa 1'')', v_bon, v_colab), 'OK'),
    ('entrega: a mesma pessoa não entra 2 vezes',    'service_role',  format('INSERT INTO public.bonificacao_entregas (bonificacao_id, colaborador_id, colaborador_nome) VALUES (%L, %L, ''Pessoa 1'')', v_bon, v_colab), '23505'),
    ('entrega: "entregue" sem data é barrado',       'service_role',  format('INSERT INTO public.bonificacao_entregas (bonificacao_id, colaborador_id, colaborador_nome, situacao, aprovada_em) VALUES (%L, %L, ''Pessoa 2'', ''entregue'', current_date)', v_bon, v_colab2), '23514'),
    ('entrega: aprovação antes da solicitação barrada','service_role', format('INSERT INTO public.bonificacao_entregas (bonificacao_id, colaborador_id, colaborador_nome, situacao, solicitada_em, aprovada_em) VALUES (%L, %L, ''Pessoa 2'', ''aprovada'', current_date, current_date - 5)', v_bon, v_colab2), '23514'),
    ('histórico: UPDATE é bloqueado',                 'service_role',  'UPDATE public.reconhecimento_historico SET detalhe = ''x''', '42501'),
    ('histórico: DELETE é bloqueado',                 'service_role',  'DELETE FROM public.reconhecimento_historico', '42501'),
    ('histórico: TRUNCATE é bloqueado',               'service_role',  'TRUNCATE public.reconhecimento_historico', '42501')
  ) AS s(descr, papel, comando, esperado) LOOP
    v_total := v_total + 1; v_ok := false; v_msg := '';
    BEGIN
      EXECUTE format('SET LOCAL ROLE %I', t.papel);
      EXECUTE t.comando;
      RESET ROLE;
      v_ok := (t.esperado = 'OK');
      IF NOT v_ok THEN v_msg := ' (o comando NÃO foi barrado)'; END IF;
    EXCEPTION WHEN OTHERS THEN
      RESET ROLE;
      v_ok := (SQLSTATE = t.esperado);
      IF NOT v_ok THEN v_msg := format(' (erro inesperado %s: %s)', SQLSTATE, SQLERRM); END IF;
    END;
    IF v_ok THEN v_linhas := v_linhas || ('  OK    ' || t.descr);
    ELSE v_falhas := v_falhas + 1; v_linhas := v_linhas || ('FALHA  ' || t.descr || v_msg); END IF;
  END LOOP;

  -- ---------------------------------------------------------------- 4) histórico automático com autor
  v_total := v_total + 1;
  SELECT count(*) INTO v_n FROM public.reconhecimento_historico
   WHERE usuario_email = 'dry-run@teste' AND entidade = 'reconhecimento' AND acao = 'criado';
  SELECT count(*) INTO t FROM public.reconhecimento_historico
   WHERE usuario_email = 'dry-run@teste' AND entidade = 'entrega' AND usuario_id = '00000000-0000-4000-8000-0000000000dd';
  IF v_n = 3 AND t.count = 1 THEN v_linhas := v_linhas || '  OK    histórico automático: 3 reconhecimentos e 1 entrega registrados com o autor enviado pelo servidor'::text;
  ELSE v_falhas := v_falhas + 1; v_linhas := v_linhas || format('FALHA  histórico: %s criações (esperado 3) e %s entregas (esperado 1) com autor', v_n, t.count); END IF;

  -- ---------------------------------------------------------------- relatório (a exceção desfaz TUDO)
  RAISE EXCEPTION E'DRY-RUN CONCLUÍDO — NADA FOI GRAVADO (o comando inteiro foi desfeito de propósito).\\n\\n%\\n\\nRESULTADO: %',
    array_to_string(v_linhas, E'\\n'),
    CASE WHEN v_falhas = 0 THEN format('TODAS AS %s VERIFICAÇÕES PASSARAM.', v_total)
         ELSE format('%s FALHA(S) em %s verificações — NÃO aplique a migration; envie este texto ao Claude.', v_falhas, v_total) END;
END
$dry$;
`
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    fs.writeFileSync(ARQUIVO_DRY_RUN, gerarDryRun())
    console.log('gerado:', path.relative(raiz, ARQUIVO_DRY_RUN))
}
