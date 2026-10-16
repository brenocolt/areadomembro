-- Fila de aprovação para pontuação de punição lançada por membros
-- Operacional em "Pontuar Membros": o lançamento não entra direto em
-- ocorrencias/colaboradores.pontos_negativos — fica pendente em
-- solicitacoes_pontuacao até alguém do núcleo Gestão de Pessoas aprovar
-- (ver src/app/(dashboard)/points-management/components/addition-requests.tsx).
-- Lançamentos de Tático/Estratégico continuam entrando direto em
-- ocorrencias, como sempre — essa tabela só existe pra guardar o que ainda
-- não foi decidido.
CREATE TABLE IF NOT EXISTS solicitacoes_pontuacao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    colaborador_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    solicitado_por_id UUID NOT NULL REFERENCES colaboradores(id) ON DELETE CASCADE,
    cargo_solicitante TEXT,
    motivo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    pontuacao INTEGER NOT NULL,
    status status_solicitacao DEFAULT 'PENDENTE',
    analisado_por TEXT,
    data_analise TIMESTAMPTZ,
    ocorrencia_id UUID REFERENCES ocorrencias(id),
    created_at TIMESTAMPTZ DEFAULT now()
);
COMMENT ON TABLE solicitacoes_pontuacao IS 'Lançamentos de punição feitos por Operacionais, pendentes de aprovação da Gestão de Pessoas';

ALTER TABLE solicitacoes_pontuacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS allow_anon_select ON solicitacoes_pontuacao;
CREATE POLICY allow_anon_select ON solicitacoes_pontuacao FOR SELECT USING (true);
DROP POLICY IF EXISTS allow_anon_insert ON solicitacoes_pontuacao;
CREATE POLICY allow_anon_insert ON solicitacoes_pontuacao FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS allow_anon_update ON solicitacoes_pontuacao;
CREATE POLICY allow_anon_update ON solicitacoes_pontuacao FOR UPDATE USING (true);
