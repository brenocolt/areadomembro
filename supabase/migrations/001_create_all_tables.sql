-- ============================================================
-- MIGRAÇÃO COMPLETA: Produtiva Portal → Supabase
-- Tabelas organizadas por domínio
-- ============================================================

-- ============================================================
-- ENUMS
-- ============================================================

DO $$ BEGIN
    CREATE TYPE role_type AS ENUM ('ADMIN', 'RH', 'GESTOR', 'COLABORADOR');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE status_transacao AS ENUM ('PENDENTE', 'CREDITADO', 'PROCESSANDO', 'APROVADO', 'PAGO', 'REJEITADO');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tipo_transacao AS ENUM ('ENTRADA', 'SAIDA');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE tipo_citacao AS ENUM ('ENTRADA', 'RETIRADA');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE status_troca_milhas AS ENUM ('PENDENTE', 'APROVADA', 'REPROVADA');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE status_solicitacao AS ENUM ('PENDENTE', 'APROVADA', 'REJEITADA');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ============================================================
-- CORE: Identidade e Estrutura
-- ============================================================

-- Usuários para autenticação
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    senha TEXT NOT NULL,
    role role_type DEFAULT 'COLABORADOR',
    colaborador_id UUID UNIQUE,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE users IS 'Usuários do sistema - autenticação e controle de acesso';

-- Colaboradores (perfil completo)
CREATE TABLE IF NOT EXISTS colaboradores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Identidade
    nome TEXT NOT NULL,
    foto TEXT,

    -- Dados Pessoais
    data_nascimento DATE,
    cpf TEXT UNIQUE,
    endereco TEXT,
    telefone TEXT,
    email_pessoal TEXT,
    email_corporativo TEXT UNIQUE NOT NULL,

    -- Preferências
    hobby TEXT,
    chocolate_favorito TEXT,
    serie_filme_favorito TEXT,

    -- Dados Profissionais
    safra TEXT NOT NULL,
    semestre_ingresso TEXT NOT NULL,
    nucleo_atual TEXT NOT NULL,
    cargo_atual TEXT NOT NULL,
    matricula TEXT,

    -- Financeiro (cache)
    saldo_pipj NUMERIC(10,2) DEFAULT 0,
    pontos_negativos INTEGER DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE colaboradores IS 'Dados completos do colaborador - perfil, dados pessoais e profissionais';

-- FK: users → colaboradores
ALTER TABLE users
    DROP CONSTRAINT IF EXISTS fk_users_colaborador;
ALTER TABLE users
    ADD CONSTRAINT fk_users_colaborador
    FOREIGN KEY (colaborador_id) REFERENCES colaboradores(id) ON DELETE SET NULL;

-- Histórico de Cargos
CREATE TABLE IF NOT EXISTS historico_cargos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    cargo TEXT NOT NULL,
    semestre_inicio TEXT NOT NULL,
    semestre_fim TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE historico_cargos IS 'Histórico de progressão de cargos do colaborador';

-- Projetos (catálogo)
CREATE TABLE IF NOT EXISTS projetos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT UNIQUE NOT NULL,
    cor TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE projetos IS 'Catálogo de projetos da empresa júnior';

-- Projetos Finalizados
CREATE TABLE IF NOT EXISTS projetos_finalizados (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    empresa TEXT NOT NULL,
    servico TEXT NOT NULL,
    duracao_dias INTEGER NOT NULL,
    semestres TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE projetos_finalizados IS 'Projetos concluídos pelo colaborador';

-- ============================================================
-- PERFORMANCE: Avaliações e NPS
-- ============================================================

-- Avaliações NPS
CREATE TABLE IF NOT EXISTS avaliacoes_nps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    mes INTEGER NOT NULL CHECK (mes BETWEEN 1 AND 12),
    ano INTEGER NOT NULL,

    comunicacao NUMERIC(3,1),
    dedicacao NUMERIC(3,1),
    confianca NUMERIC(3,1),
    pontualidade NUMERIC(3,1),
    organizacao NUMERIC(3,1),
    proatividade NUMERIC(3,1),
    qualidade_entregas NUMERIC(3,1),
    dominio_tecnico NUMERIC(3,1),

    nps_geral NUMERIC(3,1),
    avaliador_id TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),

    UNIQUE(colaborador_id, mes, ano)
);
COMMENT ON TABLE avaliacoes_nps IS 'Avaliações mensais de desempenho por competência';

-- Citações
CREATE TABLE IF NOT EXISTS citacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    avaliador_id TEXT NOT NULL,
    data TIMESTAMPTZ DEFAULT now(),
    pontos INTEGER NOT NULL,
    descricao TEXT NOT NULL,
    tipo tipo_citacao NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE citacoes IS 'Citações positivas e negativas recebidas por colaboradores';

-- ============================================================
-- FINANCEIRO: PIPJ, Saques e Benefícios
-- ============================================================

-- Transações PIPJ
CREATE TABLE IF NOT EXISTS transacoes_pipj (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    tipo tipo_transacao NOT NULL,

    periodo TEXT,
    semestre TEXT,
    cargo_no_periodo TEXT,
    nps_no_periodo NUMERIC(3,1),
    descricao_resgate TEXT,

    valor NUMERIC(10,2) NOT NULL,
    status status_transacao DEFAULT 'PENDENTE',
    data TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE transacoes_pipj IS 'Entradas e saídas do saldo PIPJ do colaborador';

-- Solicitações de Saque
CREATE TABLE IF NOT EXISTS solicitacoes_saque (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    valor NUMERIC(10,2) NOT NULL,
    data_solicitacao TIMESTAMPTZ DEFAULT now(),

    status status_transacao DEFAULT 'PENDENTE',
    aprovado_por TEXT,
    data_aprovacao TIMESTAMPTZ,
    data_pagamento TIMESTAMPTZ,
    motivo_rejeicao TEXT,

    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE solicitacoes_saque IS 'Solicitações de saque do saldo PIPJ';

-- Catálogo de Benefícios
CREATE TABLE IF NOT EXISTS beneficios_catalogo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    valor NUMERIC(10,2) NOT NULL,
    icone TEXT DEFAULT 'gift',
    desbloqueado BOOLEAN DEFAULT true,
    ativo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE beneficios_catalogo IS 'Catálogo de benefícios resgatáveis com saldo PIPJ';

-- Resgates de Benefícios
CREATE TABLE IF NOT EXISTS resgates_beneficios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    beneficio_id UUID NOT NULL REFERENCES beneficios_catalogo(id),
    valor NUMERIC(10,2) NOT NULL,
    status status_transacao DEFAULT 'PENDENTE',
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE resgates_beneficios IS 'Resgates de benefícios feitos pelos colaboradores';

-- ============================================================
-- DISCIPLINA: Punições e Ocorrências
-- ============================================================

-- Ocorrências (punições)
CREATE TABLE IF NOT EXISTS ocorrencias (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    data TIMESTAMPTZ NOT NULL,
    cargo_na_epoca TEXT NOT NULL,
    motivo TEXT NOT NULL,
    descricao TEXT,
    pontuacao INTEGER NOT NULL,
    supervisor TEXT,
    gravidade TEXT DEFAULT 'LEVE',
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE ocorrencias IS 'Registro de ocorrências disciplinares e pontos negativos';

-- Solicitações de Remoção de Pontos
CREATE TABLE IF NOT EXISTS solicitacoes_remocao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    ocorrencia_id UUID REFERENCES ocorrencias(id),
    motivo TEXT NOT NULL,
    status status_solicitacao DEFAULT 'PENDENTE',
    analisado_por TEXT,
    data_analise TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE solicitacoes_remocao IS 'Solicitações de remoção/revisão de pontos negativos';

-- ============================================================
-- MILHAS: Acúmulo e Resgate
-- ============================================================

-- Saldo de Milhas
CREATE TABLE IF NOT EXISTS milhas_saldo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID UNIQUE NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    saldo_total INTEGER DEFAULT 0,
    saldo_disponivel INTEGER DEFAULT 0,
    milhas_mes_atual INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE milhas_saldo IS 'Saldo acumulado de milhas do colaborador';

-- Catálogo de Produtos para Troca de Milhas
CREATE TABLE IF NOT EXISTS milhas_produtos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    descricao TEXT,
    custo_milhas INTEGER NOT NULL,
    categoria TEXT DEFAULT 'geral',
    icone TEXT DEFAULT 'gift',
    disponivel BOOLEAN DEFAULT true,
    destaque BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE milhas_produtos IS 'Catálogo de produtos disponíveis para troca com milhas';

-- Histórico de Trocas de Milhas
CREATE TABLE IF NOT EXISTS milhas_trocas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    produto_id UUID REFERENCES milhas_produtos(id),
    item_nome TEXT NOT NULL,
    milhas_gastas INTEGER NOT NULL,
    status status_troca_milhas DEFAULT 'PENDENTE',
    data_troca TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE milhas_trocas IS 'Histórico de trocas de milhas por produtos/benefícios';

-- ============================================================
-- RLS (Row Level Security)
-- ============================================================

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_cargos ENABLE ROW LEVEL SECURITY;
ALTER TABLE projetos ENABLE ROW LEVEL SECURITY;
ALTER TABLE projetos_finalizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE avaliacoes_nps ENABLE ROW LEVEL SECURITY;
ALTER TABLE citacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE transacoes_pipj ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacoes_saque ENABLE ROW LEVEL SECURITY;
ALTER TABLE beneficios_catalogo ENABLE ROW LEVEL SECURITY;
ALTER TABLE resgates_beneficios ENABLE ROW LEVEL SECURITY;
ALTER TABLE ocorrencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE solicitacoes_remocao ENABLE ROW LEVEL SECURITY;
ALTER TABLE milhas_saldo ENABLE ROW LEVEL SECURITY;
ALTER TABLE milhas_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE milhas_trocas ENABLE ROW LEVEL SECURITY;

-- Política permissiva para anon key (leitura pública para o app)
-- Em produção, refinar por user_id autenticado
DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY[
            'users', 'colaboradores', 'historico_cargos', 'projetos',
            'projetos_finalizados', 'avaliacoes_nps', 'citacoes',
            'transacoes_pipj', 'solicitacoes_saque', 'beneficios_catalogo',
            'resgates_beneficios', 'ocorrencias', 'solicitacoes_remocao',
            'milhas_saldo', 'milhas_produtos', 'milhas_trocas'
        ])
    LOOP
        EXECUTE format('
            DROP POLICY IF EXISTS allow_anon_select ON %I;
            CREATE POLICY allow_anon_select ON %I FOR SELECT USING (true);
            DROP POLICY IF EXISTS allow_anon_insert ON %I;
            CREATE POLICY allow_anon_insert ON %I FOR INSERT WITH CHECK (true);
            DROP POLICY IF EXISTS allow_anon_update ON %I;
            CREATE POLICY allow_anon_update ON %I FOR UPDATE USING (true);
        ', t, t, t, t, t, t);
    END LOOP;
END $$;

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t TEXT;
BEGIN
    FOR t IN
        SELECT unnest(ARRAY['users', 'colaboradores', 'milhas_saldo'])
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS set_updated_at ON %I;
            CREATE TRIGGER set_updated_at
                BEFORE UPDATE ON %I
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        ', t, t);
    END LOOP;
END $$;
