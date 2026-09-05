-- Correção de dados: títulos de pergunta e descrições de formulário criados
-- ANTES do editor de negrito/itálico (RichTextInput) muitas vezes tinham as
-- tags <b>/<i> digitadas como texto literal — sem espaço real entre a tag e
-- a palavra vizinha, já que a própria tag "ocupava" visualmente esse espaço
-- (ex.: "Qual o nível de<b>comunicação</b>hoje?"). Agora que essas tags são
-- interpretadas de verdade como HTML (negrito/itálico renderizados, não o
-- texto literal da tag), o espaço que nunca existiu de fato ficou faltando:
-- as palavras coladas ("nível decomunicaçãohoje").
--
-- Este script insere um espaço nos dois únicos pontos onde isso acontece:
-- texto logo ANTES de uma tag de abertura (<b>, <i>, <strong> ou <em>), e
-- texto logo DEPOIS de uma tag de fechamento — nunca entre a tag e o
-- conteúdo que ela envolve (isso já está correto: "<b>comunicação" não deve
-- virar "<b> comunicação"). Idempotente: rodar de novo não faz nada, pois
-- depois da primeira passada já existe espaço nesses pontos.
UPDATE formulario_perguntas
SET titulo = regexp_replace(
    regexp_replace(titulo, '([^\s<>])(<(?:b|i|strong|em)>)', '\1 \2', 'g'),
    '(</(?:b|i|strong|em)>)([^\s<>])', '\1 \2', 'g'
)
WHERE titulo ~ '<(?:b|i|strong|em)>';

UPDATE formularios
SET descricao = regexp_replace(
    regexp_replace(descricao, '([^\s<>])(<(?:b|i|strong|em)>)', '\1 \2', 'g'),
    '(</(?:b|i|strong|em)>)([^\s<>])', '\1 \2', 'g'
)
WHERE descricao ~ '<(?:b|i|strong|em)>';
