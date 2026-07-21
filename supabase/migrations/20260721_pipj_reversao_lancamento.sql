-- Suporte à reversão de lançamentos de PIPJ: liga cada transação ao
-- lançamento que a gerou (para reverter só o que pertence àquele
-- lançamento) e marca o lançamento como revertido para impedir reversão
-- duplicada. Também adiciona uma descrição livre nas transações, usada
-- para deixar claro no histórico quando um crédito foi estornado.
ALTER TABLE lancamentos_pipj ADD COLUMN IF NOT EXISTS revertido_em timestamptz;
ALTER TABLE lancamentos_pipj ADD COLUMN IF NOT EXISTS revertido_por text;
ALTER TABLE transacoes_pipj ADD COLUMN IF NOT EXISTS lancamento_id uuid REFERENCES lancamentos_pipj(id);
ALTER TABLE transacoes_pipj ADD COLUMN IF NOT EXISTS descricao text;
