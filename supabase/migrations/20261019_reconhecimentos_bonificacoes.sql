-- Reconhecimentos e Bonificações (aba exclusiva da Vice Presidência)
-- Reconstrução do pacote docs/migracao-reconhecimentos (estrutura/schema.sql).
--
-- NÃO APLICADA EM PRODUÇÃO. Aplicar somente com autorização explícita.
-- Rollback: supabase/rollbacks/20261019_reconhecimentos_bonificacoes_ROLLBACK.sql
--
-- Diferenças em relação ao schema original (todas compatíveis com os dados
-- que a interface original conseguia gravar):
--   * RLS ligado SEM nenhuma policy e sem GRANT para anon/authenticated:
--     as chaves públicas não leem nem gravam nada. Todo acesso passa pelas
--     rotas /api/reconhecimentos/*, que validam sessão + VP no servidor e
--     usam a service role (SUPABASE_SERVICE_ROLE_KEY).
--   * CHECKs de status/escopo/critério/premiação/evento (o original só tinha
--     CHECK em nucleo_impacto e UNIQUE em marco_chave).
--   * projeto_id continua SEM chave estrangeira (como no original): guarda o
--     id de public.projetos, e projeto_nome é snapshot.
--
--   * Colunas de PROCEDÊNCIA (origem, origem_id, importado_em) em reconhecimentos,
--     bonificacoes e bonificacao_eventos: permitem importar depois o histórico do
--     sistema anterior de forma idempotente e sem tocar nos registros novos
--     (ver docs/reconhecimentos-implementacao/IMPORTACAO-HISTORICA.md).
--
-- Impacto: apenas CREATE em objetos NOVOS. Nenhuma tabela, coluna, policy,
-- trigger ou dado preexistente é alterado. Pré-requisito: função
-- public.update_updated_at_column() (criada em 001_create_all_tables.sql); se por
-- algum motivo não existir, é criada com o corpo padrão (se existir, não é tocada).
-- Idempotente: pode ser reexecutada sem duplicar estrutura nem dados.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'update_updated_at_column'
  ) THEN
    EXECUTE $f$
      CREATE FUNCTION public.update_updated_at_column() RETURNS trigger AS $b$
      BEGIN NEW.updated_at = now(); RETURN NEW; END;
      $b$ LANGUAGE plpgsql
    $f$;
  END IF;
END $$;

-- 1) Tipos de reconhecimento ---------------------------------------------
CREATE TABLE IF NOT EXISTS public.reconhecimento_tipos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  escopo      text NOT NULL DEFAULT 'pessoa' CHECK (escopo IN ('projeto', 'pessoa')),
  ativo       boolean NOT NULL DEFAULT true,
  ordem       integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2) Regras de bonificação -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.regras_bonificacao (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                      text NOT NULL,
  tipo_id                   uuid REFERENCES public.reconhecimento_tipos(id) ON DELETE CASCADE,
  criterio                  text NOT NULL DEFAULT 'por_reconhecimento'
                              CHECK (criterio IN ('simbolico', 'por_reconhecimento', 'acumulado')),
  quantidade_necessaria     integer NOT NULL DEFAULT 1,
  ciclo                     integer NOT NULL DEFAULT 0,
  requer_rg_adiantada       boolean NOT NULL DEFAULT false,
  requer_projeto_adiantado  boolean NOT NULL DEFAULT false, -- legado: a UI grava sempre false
  tipo_premiacao            text NOT NULL DEFAULT 'financeira'
                              CHECK (tipo_premiacao IN ('financeira', 'premio', 'simbolica')),
  valor                     numeric NOT NULL DEFAULT 0,
  descricao_premiacao       text NOT NULL DEFAULT '',
  prazo_dias                integer,
  ativo                     boolean NOT NULL DEFAULT true,
  ordem                     integer NOT NULL DEFAULT 0,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- 3) Reconhecimentos registrados -----------------------------------------
CREATE TABLE IF NOT EXISTS public.reconhecimentos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id            uuid NOT NULL REFERENCES public.reconhecimento_tipos(id) ON DELETE CASCADE,
  data               date NOT NULL,
  projeto_id         uuid,           -- id de public.projetos (sem FK, como no original)
  projeto_nome       text,
  pessoa_nome        text,
  rg_adiantada       boolean NOT NULL DEFAULT false,  -- legado
  projeto_adiantado  boolean NOT NULL DEFAULT false,  -- legado
  adiantado          boolean NOT NULL DEFAULT false,
  nucleo_impacto     text,
  observacao         text,
  criado_por         text,
  origem             text NOT NULL DEFAULT 'sistema',
  origem_id          text,
  importado_em       timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reconhecimentos_procedencia_check CHECK ((origem = 'sistema') = (origem_id IS NULL)),
  CONSTRAINT reconhecimentos_nucleo_impacto_check
    CHECK (nucleo_impacto IS NULL OR nucleo_impacto IN
      ('Gestão de Pessoas', 'Presidência', 'Vice-Presidência', 'Marketing', 'CIT', 'CIEP', 'CS'))
);

-- 4) Bonificações geradas ---------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bonificacoes (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id                    uuid REFERENCES public.regras_bonificacao(id) ON DELETE SET NULL,
  reconhecimento_id           uuid REFERENCES public.reconhecimentos(id) ON DELETE SET NULL,
  marco_chave                 text NOT NULL UNIQUE,
  marco                       integer NOT NULL DEFAULT 1,
  projeto_id                  uuid,
  projeto_nome                text,
  pessoa_nome                 text,
  tipo_nome                   text NOT NULL DEFAULT '',
  regra_nome                  text NOT NULL DEFAULT '',
  motivo                      text NOT NULL DEFAULT '',
  tipo_premiacao              text NOT NULL DEFAULT 'financeira',
  valor                       numeric NOT NULL DEFAULT 0,
  descricao_premiacao         text NOT NULL DEFAULT '',
  status                      text NOT NULL DEFAULT 'disponivel'
                                CHECK (status IN ('disponivel', 'entregue', 'expirada', 'cancelada')),
  liberada_em                 date NOT NULL DEFAULT CURRENT_DATE,
  prazo_limite                date,
  entregue_em                 timestamptz,
  entregue_por                text,
  entregue_para               text,
  observacao_entrega          text,
  cancelada_em                timestamptz,
  cancelada_por               text,
  justificativa_cancelamento  text,
  nucleo_impacto              text,
  origem             text NOT NULL DEFAULT 'sistema',
  origem_id          text,
  importado_em       timestamptz,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bonificacoes_procedencia_check CHECK ((origem = 'sistema') = (origem_id IS NULL)),
  CONSTRAINT bonificacoes_nucleo_impacto_check
    CHECK (nucleo_impacto IS NULL OR nucleo_impacto IN
      ('Gestão de Pessoas', 'Presidência', 'Vice-Presidência', 'Marketing', 'CIT', 'CIEP', 'CS'))
);

-- 5) Histórico de eventos das bonificações ---------------------------------
CREATE TABLE IF NOT EXISTS public.bonificacao_eventos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bonificacao_id  uuid NOT NULL REFERENCES public.bonificacoes(id) ON DELETE CASCADE,
  evento          text NOT NULL CHECK (evento IN ('criada', 'entregue', 'cancelada', 'expirada')),
  detalhe         text,
  usuario         text,
  origem             text NOT NULL DEFAULT 'sistema',
  origem_id          text,
  importado_em       timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bonificacao_eventos_procedencia_check CHECK ((origem = 'sistema') = (origem_id IS NULL))
);

-- 6) Configuração geral (uma linha) ----------------------------------------
CREATE TABLE IF NOT EXISTS public.bonificacoes_config (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prazo_padrao_dias  integer,   -- NULL = sem prazo
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Unicidade da procedência: o mesmo registro do sistema anterior nunca entra duas vezes.
CREATE UNIQUE INDEX IF NOT EXISTS reconhecimentos_origem_unq ON public.reconhecimentos (origem, origem_id) WHERE origem_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bonificacoes_origem_unq ON public.bonificacoes (origem, origem_id) WHERE origem_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS bonificacao_eventos_origem_unq ON public.bonificacao_eventos (origem, origem_id) WHERE origem_id IS NOT NULL;

-- Triggers de updated_at (mesmas 4 tabelas do original) --------------------
DROP TRIGGER IF EXISTS update_reconhecimento_tipos_updated_at ON public.reconhecimento_tipos;
CREATE TRIGGER update_reconhecimento_tipos_updated_at BEFORE UPDATE ON public.reconhecimento_tipos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_regras_bonificacao_updated_at ON public.regras_bonificacao;
CREATE TRIGGER update_regras_bonificacao_updated_at BEFORE UPDATE ON public.regras_bonificacao
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_reconhecimentos_updated_at ON public.reconhecimentos;
CREATE TRIGGER update_reconhecimentos_updated_at BEFORE UPDATE ON public.reconhecimentos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS update_bonificacoes_updated_at ON public.bonificacoes;
CREATE TRIGGER update_bonificacoes_updated_at BEFORE UPDATE ON public.bonificacoes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Segurança: RLS restritivo --------------------------------------------------
-- RLS ligado e NENHUMA policy => anon e authenticated não enxergam nada.
-- Os REVOKEs removem também os privilégios que o Supabase concede por padrão.
-- A service role ignora RLS e é usada apenas no servidor (rotas de API).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'reconhecimento_tipos', 'regras_bonificacao', 'reconhecimentos',
    'bonificacoes', 'bonificacao_eventos', 'bonificacoes_config'
  ] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- Dados iniciais (somente o que está comprovado no pacote) ------------------
-- Tipos: migration original 20260921004534 (6 tipos) + 20260921005732 (Núcleo de Impacto).
INSERT INTO public.reconhecimento_tipos (nome, escopo, ativo, ordem)
SELECT v.nome, v.escopo, true, v.ordem
FROM (VALUES
  ('RG / Projeto reconhecido', 'projeto', 1),
  ('Piloto de Elite',          'pessoa',  2),
  ('Líder de Voo',             'pessoa',  3),
  ('SDR do Mês',               'pessoa',  4),
  ('Closer do Mês',            'pessoa',  5),
  ('Consultor do Mês',         'pessoa',  6),
  ('Núcleo de Impacto',        'pessoa',  7)
) AS v(nome, escopo, ordem)
WHERE NOT EXISTS (SELECT 1 FROM public.reconhecimento_tipos t WHERE t.nome = v.nome);

-- Regras comprovadas (sem ambiguidade nas migrations originais):
--   SDR / Closer / Consultor do Mês, 2 ciclos de RGs adiantadas e Núcleo de Impacto.
-- NÃO semeadas (pendência P-1/P-2, ver docs/reconhecimentos-implementacao/PENDENCIAS-VALIDACAO.md):
--   regras de "Piloto de Elite" e "Líder de Voo" — o estado final em produção
--   depende de UUIDs que só existem no banco de origem. Crie/valide em
--   Configurações depois de rodar a consulta V-1 na origem.
INSERT INTO public.regras_bonificacao
  (nome, tipo_id, criterio, quantidade_necessaria, ciclo, requer_rg_adiantada,
   tipo_premiacao, valor, descricao_premiacao, ativo, ordem)
SELECT v.nome, t.id, v.criterio, v.qtd, v.ciclo, v.exige_adiantado,
       v.tipo_premiacao, v.valor, v.descricao, true, v.ordem
FROM (VALUES
  ('SDR do Mês',        'SDR do Mês',              'por_reconhecimento', 1, 0, false, 'financeira', 50, 'R$ 50,00',                    2),
  ('Closer do Mês',     'Closer do Mês',           'por_reconhecimento', 1, 0, false, 'financeira', 50, 'R$ 50,00',                    3),
  ('Consultor do Mês',  'Consultor do Mês',        'por_reconhecimento', 1, 0, false, 'financeira', 50, 'R$ 50,00',                    4),
  ('RGs adiantadas — ciclo R$ 12',
                        'RG / Projeto reconhecido','acumulado',          2, 4, true,  'financeira', 12, 'R$ 12,00',                    6),
  ('RGs adiantadas — ciclo R$ 30 / McDonald''s',
                        'RG / Projeto reconhecido','acumulado',          4, 4, true,  'premio',     30, 'R$ 30 / McDonald''s',         7),
  ('Núcleo de Impacto', 'Núcleo de Impacto',       'por_reconhecimento', 1, 0, false, 'financeira', 30, 'R$ 30 por membro do núcleo',  8)
) AS v(nome, tipo_nome, criterio, qtd, ciclo, exige_adiantado, tipo_premiacao, valor, descricao, ordem)
JOIN public.reconhecimento_tipos t ON t.nome = v.tipo_nome
WHERE NOT EXISTS (SELECT 1 FROM public.regras_bonificacao r WHERE r.nome = v.nome);

-- Configuração: prazo padrão vazio (sem prazo). Pendência P-4.
INSERT INTO public.bonificacoes_config (prazo_padrao_dias)
SELECT NULL
WHERE NOT EXISTS (SELECT 1 FROM public.bonificacoes_config);

NOTIFY pgrst, 'reload schema';
