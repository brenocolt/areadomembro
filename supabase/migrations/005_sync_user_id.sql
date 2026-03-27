-- Atualiza os IDs da tabela users para serem iguais aos do colaborador_id
UPDATE users 
SET id = colaborador_id 
WHERE colaborador_id IS NOT NULL;
