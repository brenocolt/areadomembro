-- Lista de nomes dos projetos ativos de cada colaborador (usada pelo menu
-- retrátil em allocations-management), preenchida pela sincronização com o
-- Monday (syncMondayAlocacoes, src/lib/monday-sync.ts).
ALTER TABLE colaboradores ADD COLUMN IF NOT EXISTS projetos_ativos_detalhe jsonb DEFAULT '[]'::jsonb;
