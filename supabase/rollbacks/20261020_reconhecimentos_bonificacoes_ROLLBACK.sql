-- ROLLBACK de supabase/migrations/20261020_reconhecimentos_bonificacoes.sql
-- NÃO APLICAR sem autorização explícita. IRREVERSÍVEL: apaga as 7 tabelas e TODOS os dados da aba
-- Reconhecimentos e Bonificações (inclusive o histórico). Não toca em nada preexistente
-- (public.update_updated_at_column() e as tabelas projetos/colaboradores/users ficam intactas).
-- Ordem respeita as FKs (filhas primeiro). Triggers, índices e policies caem junto.

BEGIN;

DROP TABLE IF EXISTS public.reconhecimento_historico;
DROP TABLE IF EXISTS public.bonificacao_entregas;
DROP TABLE IF EXISTS public.bonificacoes;
DROP TABLE IF EXISTS public.regras_bonificacao;
DROP TABLE IF EXISTS public.reconhecimentos;
DROP TABLE IF EXISTS public.reconhecimento_nucleos;
DROP TABLE IF EXISTS public.reconhecimento_tipos;
DROP FUNCTION IF EXISTS public.rec_registrar_historico();
DROP FUNCTION IF EXISTS public.rec_historico_imutavel();

NOTIFY pgrst, 'reload schema';

COMMIT;
