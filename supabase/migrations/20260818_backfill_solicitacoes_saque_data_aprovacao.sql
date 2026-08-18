-- Aprovações antigas de solicitacoes_saque nunca tiveram data_aprovacao
-- preenchida (a coluna já existia, mas a rota de aprovação nunca a
-- gravava). Como aproximação razoável para os registros já aprovados,
-- usamos data_solicitacao — melhor do que ficar nulo e sumir do total
-- mensal de aprovações usado no limite mensal do PIPJ.
UPDATE solicitacoes_saque
SET data_aprovacao = data_solicitacao
WHERE status = 'APROVADO' AND data_aprovacao IS NULL;
