-- OPCIONAL — só rode esta migração se você realmente quiser apagar os dados
-- de PDI para sempre. As telas "Meus PDIs" e "Gestão de PDIs" já foram
-- removidas do site (nenhum código lê/escreve nessas tabelas mais); esta
-- migração é só para quem também quiser liberar o espaço/apagar o histórico.
--
-- Não há CREATE TABLE de pdi_planos/pdi_tarefas rastreado nas migrações deste
-- repositório (foram criadas fora do histórico versionado) — confira a
-- estrutura real no painel do Supabase antes de rodar, se tiver dúvida.
-- CASCADE cobre qualquer dependência (FK, view) que não esteja mapeada aqui.
DROP TABLE IF EXISTS pdi_tarefas CASCADE;
DROP TABLE IF EXISTS pdi_planos CASCADE;
