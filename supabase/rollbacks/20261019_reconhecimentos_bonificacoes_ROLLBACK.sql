-- ROLLBACK de supabase/migrations/20261019_reconhecimentos_bonificacoes.sql
-- NÃO APLICAR sem autorização explícita. IRREVERSÍVEL: apaga as 6 tabelas e
-- TODOS os dados da aba Reconhecimentos e Bonificações.
-- Não toca em nenhuma tabela/função preexistente (public.update_updated_at_column()
-- e as tabelas projetos/colaboradores/users continuam intactas).
-- Ordem respeita as FKs (filhas primeiro). Triggers e policies caem junto.

BEGIN;

DROP TABLE IF EXISTS public.bonificacao_eventos;
DROP TABLE IF EXISTS public.bonificacoes;
DROP TABLE IF EXISTS public.reconhecimentos;
DROP TABLE IF EXISTS public.regras_bonificacao;
DROP TABLE IF EXISTS public.reconhecimento_tipos;
DROP TABLE IF EXISTS public.bonificacoes_config;

NOTIFY pgrst, 'reload schema';

COMMIT;
