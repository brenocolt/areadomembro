-- NÃO APLICADO. Só executar após confirmação explícita do responsável.
-- Remove as 6 tabelas exclusivas da aba "Reconhecimentos e Bonificações". IRREVERSÍVEL (apaga os dados).
-- Não toca em: categorias_entradas, centros_custo_entradas, projetos_entradas,
-- nem na função public.update_updated_at_column() (compartilhada com outras tabelas).
-- Ordem respeita as FKs (filhas primeiro). CASCADE não é necessário.

DROP TABLE IF EXISTS public.bonificacao_eventos;
DROP TABLE IF EXISTS public.bonificacoes;
DROP TABLE IF EXISTS public.reconhecimentos;
DROP TABLE IF EXISTS public.regras_bonificacao;
DROP TABLE IF EXISTS public.reconhecimento_tipos;
DROP TABLE IF EXISTS public.bonificacoes_config;
