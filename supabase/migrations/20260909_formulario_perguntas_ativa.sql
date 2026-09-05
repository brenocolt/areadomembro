-- Antes desta migração, remover uma pergunta ao editar um formulário fazia
-- um DELETE físico em formulario_perguntas — que, por causa do
-- "ON DELETE CASCADE" em formulario_respostas_itens.pergunta_id, apagava
-- também TODO o histórico de respostas já dadas àquela pergunta. Ou seja,
-- só de tirar uma pergunta de escala (ex.: "Pontualidade") de um formulário
-- já em uso, as notas antigas dela sumiam de vez das sub-abas de
-- Performance — não só deixavam de ser coletadas dali pra frente.
--
-- `ativa` passa a ser um soft-delete: remover uma pergunta na edição marca
-- ativa=false em vez de apagar a linha, preservando as respostas antigas
-- (a pergunta simplesmente some da tela de resposta e da tela de edição,
-- mas seu histórico continua entrando nas médias/gráficos de quem já foi
-- avaliado com ela — o "critério" só para de aparecer dali pra frente, sem
-- reescrever o passado).
ALTER TABLE formulario_perguntas ADD COLUMN IF NOT EXISTS ativa boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN formulario_perguntas.ativa IS 'false = pergunta removida do formulário (soft-delete): não aparece mais pra responder/editar, mas o histórico de respostas antigas é preservado.';
