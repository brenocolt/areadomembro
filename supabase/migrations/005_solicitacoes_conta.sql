CREATE TABLE IF NOT EXISTS solicitacoes_conta (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    cargo TEXT NOT NULL,
    nucleo TEXT NOT NULL,
    safra TEXT NOT NULL,
    semestre_ingresso TEXT NOT NULL,
    data_nascimento DATE,
    cpf TEXT,
    endereco TEXT,
    matricula TEXT,
    telefone TEXT,
    email_pessoal TEXT,
    email_corporativo TEXT NOT NULL,
    hobby TEXT,
    chocolate_favorito TEXT,
    serie_filme_favorito TEXT,
    senha TEXT NOT NULL,
    status status_solicitacao DEFAULT 'PENDENTE',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE solicitacoes_conta IS 'Tabela que armazena os pedidos de criação de conta do site.';
