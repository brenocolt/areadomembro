-- Rastreia quem realizou um ajuste manual de saldo PIPJ, para a nova aba
-- de "Registros de Alterações" em pipj-management.
ALTER TABLE transacoes_pipj ADD COLUMN IF NOT EXISTS realizado_por text;
