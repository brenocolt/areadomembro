-- =====================================================================
-- Reconhecimentos e Bonificações — ESTADO FINAL CONSOLIDADO DO ESQUEMA
-- Origem: [VP] Acompanhamento Fin (Supabase/PostgreSQL)
-- Consolidado das migrations 20260921004534, 20260921005732,
-- 20260921011221 e 20260923135114. Sem dados — apenas estrutura.
--
-- NÍVEL DE VERIFICAÇÃO
--  CONFIRMADO no banco de produção (information_schema): nomes, tipos, nulabilidade e DEFAULTs de todas as colunas.
--  CONFIRMADO no types.ts gerado (reflete o banco): as 5 chaves estrangeiras existentes e a AUSÊNCIA de FK em projeto_id.
--  NÃO CONFIRMADO em produção (vem só das migrations): ON DELETE das FKs, CHECK de nucleo_impacto, UNIQUE de marco_chave,
--    triggers de updated_at, políticas RLS e GRANTs. A consulta de constraints não foi concluída nesta extração.
--
-- Pré-requisito externo: função public.update_updated_at_column()
--   (trigger genérico que faz NEW.updated_at = now()) e, opcionalmente,
--   a tabela public.projetos_entradas (ver README, seção "Dependências").
-- =====================================================================

-- 1) Tipos de reconhecimento --------------------------------------------
CREATE TABLE public.reconhecimento_tipos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        text NOT NULL,
  escopo      text NOT NULL DEFAULT 'pessoa',      -- 'projeto' | 'pessoa'
  ativo       boolean NOT NULL DEFAULT true,
  ordem       integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- 2) Regras de bonificação ----------------------------------------------
CREATE TABLE public.regras_bonificacao (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                      text NOT NULL,
  tipo_id                   uuid REFERENCES public.reconhecimento_tipos(id) ON DELETE CASCADE,
  criterio                  text NOT NULL DEFAULT 'por_reconhecimento', -- 'simbolico' | 'por_reconhecimento' | 'acumulado'
  quantidade_necessaria     integer NOT NULL DEFAULT 1,
  ciclo                     integer NOT NULL DEFAULT 0,   -- 0 = não repete; n = repete a cada n
  requer_rg_adiantada       boolean NOT NULL DEFAULT false, -- campo efetivamente usado na UI
  requer_projeto_adiantado  boolean NOT NULL DEFAULT false, -- legado: a UI sempre grava false e unifica em requer_rg_adiantada
  tipo_premiacao            text NOT NULL DEFAULT 'financeira', -- 'financeira' | 'premio' | 'simbolica'
  valor                     numeric NOT NULL DEFAULT 0,
  descricao_premiacao       text NOT NULL DEFAULT '',
  prazo_dias                integer,                       -- NULL = usa o prazo padrão
  ativo                     boolean NOT NULL DEFAULT true,
  ordem                     integer NOT NULL DEFAULT 0,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

-- 3) Reconhecimentos registrados ----------------------------------------
CREATE TABLE public.reconhecimentos (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_id            uuid NOT NULL REFERENCES public.reconhecimento_tipos(id) ON DELETE CASCADE,
  data               date NOT NULL,
  projeto_id         uuid,           -- era FK p/ projetos_entradas; a FK foi REMOVIDA (migration 20260921005732). Hoje guarda o id de um centro_custo_entradas.
  projeto_nome       text,
  pessoa_nome        text,
  rg_adiantada       boolean NOT NULL DEFAULT false,  -- legado (UI grava false)
  projeto_adiantado  boolean NOT NULL DEFAULT false,  -- legado (UI grava false)
  adiantado          boolean NOT NULL DEFAULT false,  -- campo atual
  nucleo_impacto     text,
  observacao         text,
  criado_por         text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reconhecimentos_nucleo_impacto_check
    CHECK (nucleo_impacto IS NULL OR nucleo_impacto IN
      ('Gestão de Pessoas','Presidência','Vice-Presidência','Marketing','CIT','CIEP','CS'))
);

-- 4) Bonificações geradas -----------------------------------------------
CREATE TABLE public.bonificacoes (
  id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id                    uuid REFERENCES public.regras_bonificacao(id) ON DELETE SET NULL,
  reconhecimento_id           uuid REFERENCES public.reconhecimentos(id) ON DELETE SET NULL,
  marco_chave                 text NOT NULL UNIQUE,   -- chave de idempotência (ver motor)
  marco                       integer NOT NULL DEFAULT 1,
  projeto_id                  uuid,                   -- sem FK
  projeto_nome                text,
  pessoa_nome                 text,
  tipo_nome                   text NOT NULL DEFAULT '',   -- SNAPSHOT do nome do tipo
  regra_nome                  text NOT NULL DEFAULT '',   -- SNAPSHOT do nome da regra
  motivo                      text NOT NULL DEFAULT '',
  tipo_premiacao              text NOT NULL DEFAULT 'financeira',
  valor                       numeric NOT NULL DEFAULT 0, -- SNAPSHOT do valor da regra
  descricao_premiacao         text NOT NULL DEFAULT '',   -- SNAPSHOT
  status                      text NOT NULL DEFAULT 'disponivel', -- disponivel | entregue | expirada | cancelada (sem CHECK no banco)
  liberada_em                 date NOT NULL DEFAULT CURRENT_DATE,
  prazo_limite                date,
  entregue_em                 timestamptz,
  entregue_por                text,
  entregue_para               text,                   -- nomes separados por "; "
  observacao_entrega          text,
  cancelada_em                timestamptz,
  cancelada_por               text,
  justificativa_cancelamento  text,
  nucleo_impacto              text,
  created_at                  timestamptz NOT NULL DEFAULT now(),
  updated_at                  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bonificacoes_nucleo_impacto_check
    CHECK (nucleo_impacto IS NULL OR nucleo_impacto IN
      ('Gestão de Pessoas','Presidência','Vice-Presidência','Marketing','CIT','CIEP','CS'))
);

-- 5) Histórico de eventos das bonificações -------------------------------
CREATE TABLE public.bonificacao_eventos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bonificacao_id uuid NOT NULL REFERENCES public.bonificacoes(id) ON DELETE CASCADE,
  evento         text NOT NULL,        -- 'criada' | 'entregue' | 'cancelada' | 'expirada'
  detalhe        text,
  usuario        text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- 6) Configuração geral (tabela de 1 linha) -----------------------------
CREATE TABLE public.bonificacoes_config (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prazo_padrao_dias  integer,          -- NULL = sem prazo
  updated_at         timestamptz NOT NULL DEFAULT now()
);

-- Triggers de updated_at (apenas 4 tabelas têm; bonificacoes_config NÃO tem) --
CREATE TRIGGER update_reconhecimento_tipos_updated_at BEFORE UPDATE ON public.reconhecimento_tipos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_regras_bonificacao_updated_at   BEFORE UPDATE ON public.regras_bonificacao   FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_reconhecimentos_updated_at      BEFORE UPDATE ON public.reconhecimentos      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_bonificacoes_updated_at         BEFORE UPDATE ON public.bonificacoes         FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Segurança: RLS ligado em todas, com política totalmente aberta (USING true / WITH CHECK true)
-- e GRANT total para anon + authenticated. O controle de acesso é só do lado do app
-- (login por e-mail + ProtectedRoute). Reavaliar no sistema de destino.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['reconhecimento_tipos','regras_bonificacao','reconhecimentos','bonificacoes','bonificacao_eventos','bonificacoes_config'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "Allow all %1$s" ON public.%1$I FOR ALL USING (true) WITH CHECK (true)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;
