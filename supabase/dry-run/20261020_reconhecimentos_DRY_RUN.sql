-- DRY-RUN da migration 20261020_reconhecimentos_bonificacoes — NÃO GRAVA NADA
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

DO $dry$
DECLARE
  v_mig        text := $mig$
-- Reconhecimentos e Bonificações — modelo próprio (aba exclusiva da Vice Presidência)
-- Escrita do zero para o portal; NÃO deriva de nenhum sistema anterior.
--
-- NÃO APLICADA EM PRODUÇÃO. Aplicar somente com autorização explícita.
-- Rollback: supabase/rollbacks/20261020_reconhecimentos_bonificacoes_ROLLBACK.sql
--
-- Impacto: SOMENTE objetos novos — 7 tabelas, 2 funções, índices, triggers, RLS/REVOKE/GRANT
-- nessas tabelas e 7 tipos iniciais. Nenhuma tabela, coluna, policy, trigger, função ou dado
-- preexistente é alterado; não há chaves estrangeiras para tabelas existentes.
-- Pré-requisito: função public.update_updated_at_column() (já usada por outras tabelas). Se não
-- existir, a migration ABORTA sem criar nada.
-- Atômica (BEGIN/COMMIT) e idempotente (pode ser reexecutada).
--
-- Segurança: RLS ligado SEM policies e sem GRANT para anon/authenticated. Todo acesso passa pelas
-- rotas /api/reconhecimentos/*, que validam sessão + (Vice Presidência ativa | ADMIN) no servidor e
-- usam a service role (SUPABASE_SERVICE_ROLE_KEY).
--
-- Auditoria: o histórico é gravado por TRIGGERS (mesma transação da alteração, impossível de esquecer)
-- e é imutável (UPDATE/DELETE/TRUNCATE bloqueados). O autor vem dos cabeçalhos x-app-usuario-id /
-- x-app-usuario-email que o servidor envia ao PostgREST (current_setting('request.headers')).


DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
  ) THEN
    RAISE EXCEPTION 'Pré-requisito ausente: função public.update_updated_at_column(). Nada foi criado. Avise o responsável antes de continuar.';
  END IF;
END $$;

-- 1) Tipos de reconhecimento ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reconhecimento_tipos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         text NOT NULL UNIQUE,
  escopo       text NOT NULL CHECK (escopo IN ('projeto', 'colaborador', 'nucleo')),
  usa_periodo  boolean NOT NULL DEFAULT false,
  ativo        boolean NOT NULL DEFAULT true,
  ordem        integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

-- 2) Elegibilidade dos núcleos (a lista de núcleos vem do sistema; aqui só o que foi configurado) ---
CREATE TABLE IF NOT EXISTS public.reconhecimento_nucleos (
  nucleo      text PRIMARY KEY,
  elegivel    boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 3) Reconhecimentos ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reconhecimentos (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id             uuid NOT NULL REFERENCES public.reconhecimento_tipos(id) ON DELETE RESTRICT,
  data_reconhecimento date NOT NULL,
  projeto_id          uuid,            -- id de public.projetos (sem FK; validado no servidor)
  projeto_nome        text,            -- cópia do nome no momento do registro
  colaborador_id      uuid,            -- id de public.colaboradores (sem FK; validado no servidor)
  colaborador_nome    text,
  nucleo              text,
  numero_rg           integer CHECK (numero_rg IS NULL OR numero_rg >= 1),
  periodo_referencia  date CHECK (periodo_referencia IS NULL OR periodo_referencia = date_trunc('month', periodo_referencia)::date),
  observacoes         text,
  criado_por_id       uuid,
  criado_por_email    text NOT NULL,
  excluido_em         timestamptz,
  excluido_por        text,
  excluido_motivo     text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reconhecimentos_exclusao_check CHECK ((excluido_em IS NULL) = (excluido_por IS NULL))
);
-- Sequência de RGs: o mesmo número não existe duas vezes no mesmo projeto (entre os não excluídos).
CREATE UNIQUE INDEX IF NOT EXISTS reconhecimentos_rg_unq
  ON public.reconhecimentos (projeto_id, numero_rg)
  WHERE numero_rg IS NOT NULL AND projeto_id IS NOT NULL AND excluido_em IS NULL;
-- Reconhecimento individual/de núcleo: não repetir o mesmo tipo + mesmo alvo + mesmo período.
CREATE UNIQUE INDEX IF NOT EXISTS reconhecimentos_individual_periodo_unq
  ON public.reconhecimentos (tipo_id, colaborador_id, periodo_referencia)
  WHERE colaborador_id IS NOT NULL AND periodo_referencia IS NOT NULL AND excluido_em IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reconhecimentos_nucleo_periodo_unq
  ON public.reconhecimentos (tipo_id, nucleo, periodo_referencia)
  WHERE nucleo IS NOT NULL AND periodo_referencia IS NOT NULL AND excluido_em IS NULL;
CREATE INDEX IF NOT EXISTS reconhecimentos_data_idx ON public.reconhecimentos (data_reconhecimento DESC);
CREATE INDEX IF NOT EXISTS reconhecimentos_projeto_idx ON public.reconhecimentos (projeto_id) WHERE projeto_id IS NOT NULL;

-- 4) Regras de bonificação (nenhuma regra e nenhum valor são semeados) ----------------------
CREATE TABLE IF NOT EXISTS public.regras_bonificacao (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                 text NOT NULL,
  tipo_id              uuid NOT NULL REFERENCES public.reconhecimento_tipos(id) ON DELETE RESTRICT,
  gatilho              text NOT NULL CHECK (gatilho IN ('cada_reconhecimento', 'marcos_de_rg')),
  a_partir_de          integer CHECK (a_partir_de IS NULL OR a_partir_de >= 1),
  repetir_a_cada       integer CHECK (repetir_a_cada IS NULL OR repetir_a_cada >= 1),
  tipo_premiacao       text NOT NULL CHECK (tipo_premiacao IN ('financeira', 'item', 'simbolica')),
  valor                numeric CHECK (valor IS NULL OR valor >= 0),
  descricao_premiacao  text NOT NULL DEFAULT '',
  prazo_dias           integer CHECK (prazo_dias IS NULL OR prazo_dias >= 1),
  vigente_desde        timestamptz NOT NULL DEFAULT now(),  -- vale para reconhecimentos REGISTRADOS a partir daqui
  ativo                boolean NOT NULL DEFAULT true,
  criado_por_email     text,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT regras_marcos_check CHECK ((gatilho = 'marcos_de_rg') = (a_partir_de IS NOT NULL)),
  CONSTRAINT regras_repetir_check CHECK (repetir_a_cada IS NULL OR gatilho = 'marcos_de_rg')
);

-- 5) Bonificações geradas ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bonificacoes (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id                    uuid REFERENCES public.regras_bonificacao(id) ON DELETE SET NULL,
  reconhecimento_id           uuid REFERENCES public.reconhecimentos(id) ON DELETE SET NULL,
  chave_unica                 text NOT NULL UNIQUE,   -- idempotência: a mesma bonificação nunca é gerada duas vezes
  marco                       integer,
  tipo_nome                   text NOT NULL,
  regra_nome                  text NOT NULL,
  motivo                      text NOT NULL,
  projeto_id                  uuid,
  projeto_nome                text,
  colaborador_id              uuid,
  colaborador_nome            text,
  nucleo                      text,
  tipo_premiacao              text NOT NULL CHECK (tipo_premiacao IN ('financeira', 'item', 'simbolica')),
  valor                       numeric,
  descricao_premiacao         text NOT NULL DEFAULT '',
  status                      text NOT NULL DEFAULT 'disponivel' CHECK (status IN ('disponivel', 'entregue', 'expirada', 'cancelada')),
  liberada_em                 date NOT NULL,
  prazo_limite                date,
  concluida_em                timestamptz,
  concluida_por               text,
  cancelada_em                timestamptz,
  cancelada_por               text,
  justificativa_cancelamento  text,
  origem_alterada             boolean NOT NULL DEFAULT false,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bonificacoes_cancelamento_check CHECK ((status = 'cancelada') = (cancelada_em IS NOT NULL)),
  CONSTRAINT bonificacoes_conclusao_check CHECK (status <> 'entregue' OR concluida_em IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS bonificacoes_liberada_idx ON public.bonificacoes (liberada_em DESC);
CREATE INDEX IF NOT EXISTS bonificacoes_status_idx ON public.bonificacoes (status);
CREATE INDEX IF NOT EXISTS bonificacoes_reconhecimento_idx ON public.bonificacoes (reconhecimento_id) WHERE reconhecimento_id IS NOT NULL;

-- 6) Entregas individuais: quem solicitou / foi aprovado / recebeu -----------------------
CREATE TABLE IF NOT EXISTS public.bonificacao_entregas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bonificacao_id    uuid NOT NULL REFERENCES public.bonificacoes(id) ON DELETE CASCADE,
  colaborador_id    uuid NOT NULL,   -- id de public.colaboradores (sem FK; validado no servidor)
  colaborador_nome  text NOT NULL,
  situacao          text NOT NULL DEFAULT 'solicitada' CHECK (situacao IN ('solicitada', 'aprovada', 'entregue')),
  solicitada_em     date,
  aprovada_em       date,
  aprovada_por      text,
  entregue_em       date,
  entregue_por      text,
  observacao        text,
  criado_por_email  text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT entregas_unica_por_pessoa UNIQUE (bonificacao_id, colaborador_id),
  CONSTRAINT entregas_aprovacao_check CHECK (situacao = 'solicitada' OR aprovada_em IS NOT NULL),
  CONSTRAINT entregas_entrega_check CHECK ((situacao = 'entregue') = (entregue_em IS NOT NULL)),
  CONSTRAINT entregas_ordem_aprovacao_check CHECK (solicitada_em IS NULL OR aprovada_em IS NULL OR aprovada_em >= solicitada_em),
  CONSTRAINT entregas_ordem_entrega_check CHECK (aprovada_em IS NULL OR entregue_em IS NULL OR entregue_em >= aprovada_em)
);
CREATE INDEX IF NOT EXISTS entregas_colaborador_idx ON public.bonificacao_entregas (colaborador_id);

-- 7) Histórico imutável -----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.reconhecimento_historico (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entidade          text NOT NULL CHECK (entidade IN ('reconhecimento', 'bonificacao', 'entrega', 'regra', 'tipo', 'nucleo')),
  entidade_id       uuid,
  reconhecimento_id uuid,   -- sem FK: o histórico sobrevive a qualquer coisa
  bonificacao_id    uuid,
  acao              text NOT NULL,
  alteracoes        jsonb,
  detalhe           text,
  usuario_id        uuid,
  usuario_email     text NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS historico_criado_idx ON public.reconhecimento_historico (created_at DESC);
CREATE INDEX IF NOT EXISTS historico_reconhecimento_idx ON public.reconhecimento_historico (reconhecimento_id) WHERE reconhecimento_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS historico_bonificacao_idx ON public.reconhecimento_historico (bonificacao_id) WHERE bonificacao_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.rec_historico_imutavel() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
BEGIN
  RAISE EXCEPTION 'reconhecimento_historico é imutável (% bloqueado)', TG_OP USING ERRCODE = 'insufficient_privilege';
END;
$fn$;

DROP TRIGGER IF EXISTS rec_historico_imutavel_linha ON public.reconhecimento_historico;
CREATE TRIGGER rec_historico_imutavel_linha BEFORE UPDATE OR DELETE ON public.reconhecimento_historico
  FOR EACH ROW EXECUTE FUNCTION public.rec_historico_imutavel();
DROP TRIGGER IF EXISTS rec_historico_imutavel_truncate ON public.reconhecimento_historico;
CREATE TRIGGER rec_historico_imutavel_truncate BEFORE TRUNCATE ON public.reconhecimento_historico
  FOR EACH STATEMENT EXECUTE FUNCTION public.rec_historico_imutavel();

-- Registro automático do histórico (autor vindo dos cabeçalhos enviados pelo servidor).
CREATE OR REPLACE FUNCTION public.rec_registrar_historico() RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp AS $fn$
DECLARE
  v_ent     text := TG_ARGV[0];
  v_headers json;
  v_email   text;
  v_uid     uuid;
  v_old     jsonb;
  v_new     jsonb;
  v_ref     jsonb;
  v_alt     jsonb;
  v_acao    text;
  v_rec     uuid;
  v_bon     uuid;
  v_detalhe text;
BEGIN
  BEGIN v_headers := current_setting('request.headers', true)::json; EXCEPTION WHEN others THEN v_headers := NULL; END;
  v_email := coalesce(nullif(v_headers->>'x-app-usuario-email', ''), 'desconhecido');
  BEGIN v_uid := nullif(v_headers->>'x-app-usuario-id', '')::uuid; EXCEPTION WHEN others THEN v_uid := NULL; END;

  IF TG_OP = 'DELETE' THEN v_old := to_jsonb(OLD); v_ref := v_old;
  ELSIF TG_OP = 'INSERT' THEN v_new := to_jsonb(NEW); v_ref := v_new;
  ELSE v_old := to_jsonb(OLD); v_new := to_jsonb(NEW); v_ref := v_new;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT coalesce(jsonb_object_agg(n.key, jsonb_build_object('de', o.value, 'para', n.value)), '{}'::jsonb)
      INTO v_alt
      FROM jsonb_each(v_new) n
      LEFT JOIN jsonb_each(v_old) o ON o.key = n.key
     WHERE n.value IS DISTINCT FROM o.value AND n.key <> 'updated_at';
    IF v_alt = '{}'::jsonb THEN RETURN NULL; END IF;
  ELSIF TG_OP = 'INSERT' THEN
    v_alt := v_new - 'created_at' - 'updated_at';
  ELSE
    v_alt := v_old - 'created_at' - 'updated_at';
  END IF;

  IF v_ent = 'reconhecimento' THEN
    v_rec := (v_ref->>'id')::uuid;
    v_acao := CASE
      WHEN TG_OP = 'INSERT' THEN 'criado'
      WHEN TG_OP = 'DELETE' THEN 'removido_do_banco'
      WHEN (v_old->>'excluido_em') IS NULL AND (v_new->>'excluido_em') IS NOT NULL THEN 'excluido'
      ELSE 'editado' END;
  ELSIF v_ent = 'bonificacao' THEN
    v_bon := (v_ref->>'id')::uuid;
    v_rec := nullif(v_ref->>'reconhecimento_id', '')::uuid;
    v_acao := CASE
      WHEN TG_OP = 'INSERT' THEN 'gerada'
      WHEN TG_OP = 'DELETE' THEN 'removida_do_banco'
      WHEN (v_old->>'status') IS DISTINCT FROM (v_new->>'status') THEN 'status_' || (v_new->>'status')
      WHEN (SELECT array_agg(k) FROM jsonb_object_keys(v_alt) k) = ARRAY['origem_alterada'] THEN 'origem_alterada'
      ELSE 'editada' END;
  ELSIF v_ent = 'entrega' THEN
    v_bon := (v_ref->>'bonificacao_id')::uuid;
    v_detalhe := v_ref->>'colaborador_nome';
    v_acao := CASE
      WHEN TG_OP = 'INSERT' THEN 'entrega_adicionada'
      WHEN TG_OP = 'DELETE' THEN 'entrega_removida_do_banco'
      WHEN (v_old->>'situacao') IS DISTINCT FROM (v_new->>'situacao') THEN 'situacao_' || (v_new->>'situacao')
      ELSE 'entrega_editada' END;
  ELSIF v_ent = 'regra' THEN
    v_detalhe := v_ref->>'nome';
    v_acao := CASE WHEN TG_OP = 'INSERT' THEN 'regra_criada' WHEN TG_OP = 'DELETE' THEN 'regra_removida_do_banco' ELSE 'regra_editada' END;
  ELSIF v_ent = 'tipo' THEN
    v_detalhe := v_ref->>'nome';
    v_acao := CASE WHEN TG_OP = 'INSERT' THEN 'tipo_criado' WHEN TG_OP = 'DELETE' THEN 'tipo_removido_do_banco' ELSE 'tipo_editado' END;
  ELSE -- nucleo
    v_detalhe := v_ref->>'nucleo';
    v_acao := 'nucleo_configurado';
  END IF;

  INSERT INTO public.reconhecimento_historico
    (entidade, entidade_id, reconhecimento_id, bonificacao_id, acao, alteracoes, detalhe, usuario_id, usuario_email)
  VALUES
    (v_ent, nullif(v_ref->>'id', '')::uuid, v_rec, v_bon, v_acao, v_alt, v_detalhe, v_uid, v_email);
  RETURN NULL;
END;
$fn$;

-- Triggers: updated_at e histórico ----------------------------------------------------------
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM (VALUES
    ('reconhecimento_tipos', 'tipo'), ('reconhecimento_nucleos', 'nucleo'), ('reconhecimentos', 'reconhecimento'),
    ('regras_bonificacao', 'regra'), ('bonificacoes', 'bonificacao'), ('bonificacao_entregas', 'entrega')
  ) AS t(tabela, entidade) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'update_' || r.tabela || '_updated_at', r.tabela);
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', 'update_' || r.tabela || '_updated_at', r.tabela);
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.%I', 'historico_' || r.tabela, r.tabela);
    EXECUTE format('CREATE TRIGGER %I AFTER INSERT OR UPDATE OR DELETE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.rec_registrar_historico(%L)', 'historico_' || r.tabela, r.tabela, r.entidade);
  END LOOP;
END $$;

-- Segurança: RLS restritivo --------------------------------------------------------------------
-- RLS ligado e NENHUMA policy => anon e authenticated não enxergam nada. Os REVOKEs removem também os
-- privilégios que o Supabase concede por padrão. A service role ignora RLS e só é usada no servidor.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'reconhecimento_tipos', 'reconhecimento_nucleos', 'reconhecimentos', 'regras_bonificacao',
    'bonificacoes', 'bonificacao_entregas', 'reconhecimento_historico'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.rec_registrar_historico() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rec_historico_imutavel() FROM PUBLIC;

-- Dados iniciais: apenas os 7 tipos pedidos. NENHUMA regra, NENHUM valor. ---------------------
-- (o histórico automático registra a criação dos tipos com o autor "sistema (migração)")
SELECT set_config('request.headers', '{"x-app-usuario-email": "sistema (migração)"}', true);
INSERT INTO public.reconhecimento_tipos (nome, escopo, usa_periodo, ordem) VALUES
  ('RG / Projeto Reconhecido', 'projeto',     false, 1),
  ('Piloto de Elite',          'colaborador', true,  2),
  ('Líder de Voo',             'colaborador', true,  3),
  ('SDR do Mês',               'colaborador', true,  4),
  ('Closer do Mês',            'colaborador', true,  5),
  ('Consultor do Mês',         'colaborador', true,  6),
  ('Núcleo de Impacto',        'nucleo',      true,  7)
ON CONFLICT (nome) DO NOTHING;

NOTIFY pgrst, 'reload schema';


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
  SELECT count(*) INTO v_n FROM unnest(v_depois) x WHERE NOT (x = ANY (v_fun_antes)) AND x NOT LIKE 'rec\_%';
  SELECT count(*) INTO t FROM unnest(v_fun_antes) x WHERE NOT (x = ANY (v_depois));
  IF v_n = 0 AND t.count = 0 THEN v_linhas := v_linhas || '  OK    funções: só rec_registrar_historico e rec_historico_imutavel foram criadas; nenhuma preexistente mudou'::text;
  ELSE v_falhas := v_falhas + 1; v_linhas := v_linhas || 'FALHA  funções preexistentes alteradas ou funções novas inesperadas'::text; END IF;

  v_total := v_total + 1;
  SELECT count(*) INTO v_n FROM pg_proc f
   WHERE f.pronamespace = 'public'::regnamespace AND f.proname IN ('rec_registrar_historico', 'rec_historico_imutavel')
     AND EXISTS (SELECT 1 FROM unnest(coalesce(f.proconfig, '{}')) c WHERE c LIKE 'search_path=%');
  IF v_n = 2 THEN v_linhas := v_linhas || '  OK    as 2 funções novas têm search_path fixo (sem aviso no Security Advisor)'::text;
  ELSE v_falhas := v_falhas + 1; v_linhas := v_linhas || format('FALHA  funções novas sem search_path fixo (%s de 2 com)', v_n); END IF;

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
  RAISE EXCEPTION E'DRY-RUN CONCLUÍDO — NADA FOI GRAVADO (o comando inteiro foi desfeito de propósito).\n\n%\n\nRESULTADO: %',
    array_to_string(v_linhas, E'\n'),
    CASE WHEN v_falhas = 0 THEN format('TODAS AS %s VERIFICAÇÕES PASSARAM.', v_total)
         ELSE format('%s FALHA(S) em %s verificações — NÃO aplique a migration; envie este texto ao Claude.', v_falhas, v_total) END;
END
$dry$;
