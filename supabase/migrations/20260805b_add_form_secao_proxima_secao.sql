-- Navegação padrão ao final de uma seção do formulário — o admin escolhe,
-- por seção, o que acontece quando o respondente termina aquela seção sem
-- que nenhuma lógica condicional de pergunta (formulario_perguntas.
-- logica_condicional) tenha decidido o próximo passo:
--
--   - null (ou "continuar"): segue para a próxima seção na ordem do formulário
--   - "enviar": envia o formulário imediatamente
--   - id (uuid) de outra pergunta do tipo 'secao' do mesmo formulário: pula
--     diretamente para aquela seção
--
-- Só é lido/gravado em perguntas do tipo 'secao'. A lógica condicional por
-- resposta (logica_condicional, em perguntas de seleção única) tem
-- precedência sobre esse padrão quando ambas se aplicam.
ALTER TABLE formulario_perguntas
    ADD COLUMN IF NOT EXISTS proxima_secao text;
