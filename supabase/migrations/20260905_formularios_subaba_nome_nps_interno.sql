-- Nome customizado da sub-aba de Performance + marcação explícita do
-- formulário "NPS Interno", substituindo a heurística por título ("contém
-- piloto/elite") usada até aqui em ~4 lugares do código (src/lib/pipj-nps-interno.ts,
-- performance/page.tsx, feedback-agent, assistente-pessoal). Ver
-- src/app/(dashboard)/performance/page.tsx e CreateFormDialog.

-- Nome mostrado na aba de Performance no lugar do título do formulário
-- (ex: título "Piloto de Elite" → sub-aba "NPS Interno"). Vazio/NULL cai de
-- volta no título do formulário.
ALTER TABLE formularios
    ADD COLUMN IF NOT EXISTS subaba_nome text;

-- Marca QUAL formulário é "o" NPS Interno — usado pelo PIPJ (nota final),
-- Feedback Agent e Assistente Pessoal para localizar as respostas certas,
-- no lugar de adivinhar pelo título. Só um formulário deve ter isto
-- marcado; a tela de edição garante isso desmarcando qualquer outro ao
-- marcar um novo.
ALTER TABLE formularios
    ADD COLUMN IF NOT EXISTS nps_interno boolean NOT NULL DEFAULT false;

-- Migra automaticamente o formulário que já era reconhecido pela heurística
-- antiga, para que nada deixe de funcionar assim que esta migração rodar —
-- sem exigir que um admin reconfigure nada manualmente.
DO $$
DECLARE
    form_id uuid;
BEGIN
    SELECT id INTO form_id
    FROM formularios
    WHERE titulo ILIKE '%piloto%' OR titulo ILIKE '%elite%'
    LIMIT 1;

    IF form_id IS NULL THEN
        RAISE NOTICE 'Formulário "Piloto de Elite" não encontrado — nps_interno não foi marcado em nenhum formulário.';
        RETURN;
    END IF;

    UPDATE formularios
    SET nps_interno = true,
        subaba_nome = COALESCE(NULLIF(TRIM(subaba_nome), ''), 'NPS Interno')
    WHERE id = form_id;
END $$;
