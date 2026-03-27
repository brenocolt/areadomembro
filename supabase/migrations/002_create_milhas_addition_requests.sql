CREATE TABLE IF NOT EXISTS solicitacoes_adicao_milhas (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    motivo TEXT NOT NULL,
    quantidade INTEGER NOT NULL,
    status status_solicitacao DEFAULT 'PENDENTE',
    analisado_por TEXT,
    data_analise TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE solicitacoes_adicao_milhas IS 'Solicitações para adicionar milhas ao colaborador';

ALTER TABLE solicitacoes_adicao_milhas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_anon_select_adicao_milhas ON solicitacoes_adicao_milhas;
CREATE POLICY allow_anon_select_adicao_milhas ON solicitacoes_adicao_milhas FOR SELECT USING (true);
DROP POLICY IF EXISTS allow_anon_insert_adicao_milhas ON solicitacoes_adicao_milhas;
CREATE POLICY allow_anon_insert_adicao_milhas ON solicitacoes_adicao_milhas FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS allow_anon_update_adicao_milhas ON solicitacoes_adicao_milhas;
CREATE POLICY allow_anon_update_adicao_milhas ON solicitacoes_adicao_milhas FOR UPDATE USING (true);
