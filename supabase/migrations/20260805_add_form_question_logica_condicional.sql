-- Lógica condicional para perguntas de seleção única: permite direcionar o
-- respondente para uma seção específica do formulário (ou enviar o
-- formulário imediatamente) com base na opção escolhida — similar ao
-- recurso "ir para seção com base na resposta" do Google Forms.
--
-- Formato armazenado em `logica_condicional` (jsonb):
--   { "<índice da opção em opcoes>": "<alvo>" }
-- onde <alvo> é:
--   - o id (uuid) de uma pergunta do tipo 'secao' do mesmo formulário; ou
--   - "enviar", para enviar o formulário imediatamente ao fim da seção atual.
-- A ausência de uma chave para um índice de opção significa o comportamento
-- padrão: continuar para a próxima seção na ordem do formulário.
ALTER TABLE formulario_perguntas
    ADD COLUMN IF NOT EXISTS logica_condicional jsonb;
