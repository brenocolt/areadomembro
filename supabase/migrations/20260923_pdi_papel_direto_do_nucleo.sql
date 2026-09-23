-- PDI: papel de liderança passa a ser resolvido direto do cargo_atual/
-- nucleo_atual do colaborador, em vez de um catálogo fixo de 9 nomes
-- (pdi_papeis) com um mapeamento mantido à parte (pdi_cargos).
--
-- Motivo: o mapeamento pdi_cargos ficava desatualizado sempre que alguém
-- trocava de núcleo, e a grafia cadastrada nele podia divergir do valor
-- real em colaboradores.nucleo_atual (ex.: "Vice Presidência" no
-- mapeamento vs "Vice-Presidência" no cadastro real) — isso fazia
-- solicitações para papéis como "Gerente de Operações"/"Gerente
-- Institucional" nunca chegarem a ninguém, mesmo com a pessoa certa
-- cadastrada. Ver src/lib/pdi.ts (resolverPapelId, construirPapeisPorNucleo).
--
-- A partir de agora, pdi_solicitacao_lideres.papel_id e
-- pdi_solicitacoes.cargos guardam 'diretor' (cargo_atual = Estratégico)
-- ou o texto exato de colaboradores.nucleo_atual (cargo_atual = Tático) —
-- por isso papel_id deixa de referenciar um catálogo fixo (pdi_papeis).
alter table pdi_solicitacao_lideres drop constraint if exists pdi_solicitacao_lideres_papel_id_fkey;

-- pdi_papeis e pdi_cargos ficam na base sem uso (não há mais leitura delas
-- no código) — mantidas só para não quebrar nada que ainda aponte pra
-- elas; podem ser removidas numa limpeza futura.

-- Limpeza das solicitações de teste feitas com o modelo antigo (todas do
-- mesmo colaborador, usadas para testar o módulo antes de ir ao ar) —
-- ficariam com cargos apontando pra ids que não existem mais (ex.:
-- 'ger_operacoes', 'tatico'), sem nenhum líder capaz de aceitá-las.
delete from pdi_solicitacoes where cargos && array['ger_operacoes','ger_projetos','ger_gente','ger_cs','ger_inovacao','ger_institucional','closer','tatico'];
