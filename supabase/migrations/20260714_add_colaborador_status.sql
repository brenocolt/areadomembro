-- Adiciona status de desligamento para colaboradores.
-- Membros desligados saem de circulação (rankings, totais agregados e
-- aprovação de resgates/saques), mas mantêm milhas, pontos e saldo PIPJ
-- vinculados à conta, podendo ser reativados a qualquer momento.
ALTER TABLE colaboradores
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'Ativo',
  ADD COLUMN IF NOT EXISTS desligado_em TIMESTAMPTZ;

COMMENT ON COLUMN colaboradores.status IS 'Ativo ou Desligado';
COMMENT ON COLUMN colaboradores.desligado_em IS 'Data/hora do desligamento, null se ativo';
