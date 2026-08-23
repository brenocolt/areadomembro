-- Simplificação de cargo em níveis (Operacional/Tático/Estratégico/
-- Administrador) e padronização de núcleo em dropdown — Gestão de Usuários.
--
-- `cargo_atual` (função específica: Assessor, Consultor, SDR, Closer, cada
-- "Gerente de X", Diretor, Administrador) e `nucleo_atual` são mantidos como
-- estão — outras páginas do site (NPS Gerente/Projeto, Agente de Feedback,
-- menu lateral, cálculo de PIPJ) continuam funcionando sem alteração.
-- `nivel_cargo` é a nova coluna, exibida/editada como "Cargo" em Gestão de
-- Usuários, e usada (junto com `nucleo_atual`) no novo cálculo de PIPJ por
-- nível (ver src/lib/pipj-niveis.ts).

-- 1) Nível de cargo simplificado -------------------------------------------

ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS nivel_cargo TEXT;

-- Backfill de todos os colaboradores existentes a partir da função
-- específica atual, seguindo a mesma régua usada em src/lib/cargos.ts
-- (CARGO_PARA_NIVEL).
UPDATE colaboradores SET nivel_cargo = CASE
  WHEN cargo_atual IN ('Assessor', 'Consultor', 'SDR') THEN 'Operacional'
  WHEN cargo_atual IN (
    'Closer', 'Gerente de Projetos', 'Gerente de Inovação',
    'Gerente de Operações', 'Gerente de CS', 'Gerente de Gente',
    'Gerente Institucional'
  ) THEN 'Tático'
  WHEN cargo_atual = 'Diretor' THEN 'Estratégico'
  WHEN cargo_atual = 'Administrador' THEN 'Administrador'
  -- Defensivo: qualquer função fora da lista padrão (dado legado) cai em
  -- Operacional, mesmo fallback usado no código (cargoParaNivel).
  ELSE 'Operacional'
END
WHERE nivel_cargo IS NULL;

ALTER TABLE colaboradores ALTER COLUMN nivel_cargo SET DEFAULT 'Operacional';
ALTER TABLE colaboradores ALTER COLUMN nivel_cargo SET NOT NULL;

ALTER TABLE colaboradores DROP CONSTRAINT IF EXISTS chk_colaboradores_nivel_cargo;
ALTER TABLE colaboradores ADD CONSTRAINT chk_colaboradores_nivel_cargo
  CHECK (nivel_cargo IN ('Operacional', 'Tático', 'Estratégico', 'Administrador'));

COMMENT ON COLUMN colaboradores.nivel_cargo IS
  'Cargo simplificado exibido/editado em Gestão de Usuários: Operacional (Assessor/Consultor/SDR), Tático (Gerentes e Closer), Estratégico (Diretor) ou Administrador (conta fantasma do sistema).';

-- 2) Catálogo de níveis de cargo (referência para futuras aplicações) ------

CREATE TABLE IF NOT EXISTS niveis_cargo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT UNIQUE NOT NULL,
    descricao TEXT,
    ordem INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE niveis_cargo IS 'Catálogo dos níveis de cargo simplificados usados em Gestão de Usuários e no cálculo de PIPJ.';

INSERT INTO niveis_cargo (nome, descricao, ordem) VALUES
  ('Operacional', 'Assessor, Consultor e SDR', 1),
  ('Tático', 'Gerentes e Closer', 2),
  ('Estratégico', 'Diretor', 3),
  ('Administrador', 'Conta administrativa do sistema', 4)
ON CONFLICT (nome) DO NOTHING;

-- 3) Catálogo de núcleos (dropdown de Gestão de Usuários / cadastro) -------

CREATE TABLE IF NOT EXISTS nucleos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT UNIQUE NOT NULL,
    ordem INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE nucleos IS 'Catálogo dos núcleos existentes, usado no dropdown de núcleo (Gestão de Usuários e cadastro) e disponível para futuras integrações.';

INSERT INTO nucleos (nome, ordem) VALUES
  ('Marketing', 1),
  ('Projetos', 2),
  ('Vice Presidência', 3),
  ('Presidência', 4),
  ('Gestão de Pessoas', 5),
  ('Customer Success', 6),
  ('Inovação', 7),
  ('Tecnologia', 8),
  ('Escopos & Produtos', 9)
ON CONFLICT (nome) DO NOTHING;

-- `nucleo_atual` em colaboradores permanece TEXT livre (não uma FK) para
-- preservar exatamente os valores já cadastrados, inclusive fora da lista
-- acima — a tela de Gestão de Usuários passa a oferecer essa lista como
-- dropdown, mas quem tem acesso pode corrigir caso a caso.

-- 4) RLS — mesmo padrão permissivo usado nas demais tabelas do app
--    (001_create_all_tables.sql): leitura/escrita liberada via anon key,
--    já que o controle de acesso acontece na aplicação.

ALTER TABLE niveis_cargo ENABLE ROW LEVEL SECURITY;
ALTER TABLE nucleos ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY['niveis_cargo', 'nucleos'])
    LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS allow_anon_select ON %I;
            CREATE POLICY allow_anon_select ON %I FOR SELECT USING (true);
        ', t, t);
    END LOOP;
END $$;
