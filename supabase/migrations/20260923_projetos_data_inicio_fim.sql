-- Guarda a data de início (do Monday, quando disponível) e a data de fim
-- de cada projeto. Como o board do Monday pode não ter uma coluna
-- explícita de "data de fim", data_fim também é preenchida por auto-
-- rastreamento: na primeira sincronização em que o status vira
-- "Concluído", grava a data daquela sincronização e nunca mais sobrescreve
-- (ver syncMondayProjects em src/lib/monday-sync.ts) — assim o histórico
-- de finalização não se perde mesmo sem a coluna no Monday.
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS data_inicio date;
ALTER TABLE projetos ADD COLUMN IF NOT EXISTS data_fim date;
