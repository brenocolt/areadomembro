-- Sub-abas de Performance + competências e "Não avaliar" nas perguntas de
-- escala. Ver src/lib/forms-publico.ts, src/app/(dashboard)/performance e a
-- aba "Público" em CreateFormDialog.

-- Sinaliza que o formulário gera uma sub-aba dentro de Performance, com a
-- mesma visualização do NPS (cards de competência, média, gráfico de
-- evolução e detalhamento por competência). Só faz sentido em formulário
-- direcionado (com linhas em formulario_publico_recebe) — a UI só deixa
-- ligar nesse caso.
ALTER TABLE formularios
    ADD COLUMN IF NOT EXISTS gerar_subaba boolean NOT NULL DEFAULT false;

-- Nome curto da competência avaliada por uma pergunta de escala. A sub-aba
-- de Performance mostra a COMPETÊNCIA (ex.: "Pontualidade") no lugar do
-- texto da pergunta (ex.: "O quanto esse membro foi PONTUAL?"). Vazio/NULL
-- cai de volta no título da pergunta.
ALTER TABLE formulario_perguntas
    ADD COLUMN IF NOT EXISTS competencia text;

-- Permite que o respondente marque "Não avaliar" numa pergunta de escala
-- quando não tem insumo para julgar. A resposta não é gravada e, portanto,
-- não entra em nenhuma média.
ALTER TABLE formulario_perguntas
    ADD COLUMN IF NOT EXISTS permite_nao_avaliar boolean NOT NULL DEFAULT false;

-- Competências do NPS Interno (formulário "Piloto de Elite"), conforme
-- definido pela Gestão de Pessoas. O casamento é por palavra-chave no
-- título da pergunta, para não depender da pontuação/acentuação exata.
DO $$
DECLARE
    form_ids uuid[];
BEGIN
    SELECT array_agg(id) INTO form_ids
    FROM formularios
    WHERE titulo ILIKE '%piloto%' OR titulo ILIKE '%elite%';

    IF form_ids IS NULL THEN
        RAISE NOTICE 'Formulário "Piloto de Elite" não encontrado — competências do NPS Interno não foram preenchidas.';
        RETURN;
    END IF;

    UPDATE formulario_perguntas SET competencia = 'Inovatividade'
      WHERE formulario_id = ANY(form_ids) AND tipo = 'escala' AND titulo ILIKE '%inovativ%';
    UPDATE formulario_perguntas SET competencia = 'Participação'
      WHERE formulario_id = ANY(form_ids) AND tipo = 'escala' AND titulo ILIKE '%particip%';
    UPDATE formulario_perguntas SET competencia = 'Organização'
      WHERE formulario_id = ANY(form_ids) AND tipo = 'escala' AND titulo ILIKE '%organizad%';
    UPDATE formulario_perguntas SET competencia = 'Pontualidade'
      WHERE formulario_id = ANY(form_ids) AND tipo = 'escala' AND titulo ILIKE '%pontual%';
    UPDATE formulario_perguntas SET competencia = 'Proatividade'
      WHERE formulario_id = ANY(form_ids) AND tipo = 'escala' AND titulo ILIKE '%proativ%';
    UPDATE formulario_perguntas SET competencia = 'Compromisso com prazo'
      WHERE formulario_id = ANY(form_ids) AND tipo = 'escala' AND titulo ILIKE '%prazo%';
END $$;
