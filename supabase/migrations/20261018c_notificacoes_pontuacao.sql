-- Notifica quem solicitou uma pontuação (Operacional/Tático, via fila de
-- aprovação em solicitacoes_pontuacao) quando o pedido é recusado. Lida
-- pelo sino de notificações da Área do Membro (ver
-- src/components/pdi-notification-bell.tsx), que já existia só pro PDI.
CREATE TABLE IF NOT EXISTS pontuacao_notificacoes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    texto TEXT NOT NULL,
    lida BOOLEAN NOT NULL DEFAULT false,
    solicitacao_id UUID REFERENCES solicitacoes_pontuacao(id),
    criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
COMMENT ON TABLE pontuacao_notificacoes IS 'Avisos pro solicitante quando uma pontuação pendente é aprovada/recusada';

ALTER TABLE pontuacao_notificacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_anon_select ON pontuacao_notificacoes;
CREATE POLICY allow_anon_select ON pontuacao_notificacoes FOR SELECT USING (true);
DROP POLICY IF EXISTS allow_anon_insert ON pontuacao_notificacoes;
CREATE POLICY allow_anon_insert ON pontuacao_notificacoes FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS allow_anon_update ON pontuacao_notificacoes;
CREATE POLICY allow_anon_update ON pontuacao_notificacoes FOR UPDATE USING (true);
