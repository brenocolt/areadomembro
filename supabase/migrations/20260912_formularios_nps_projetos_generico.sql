-- NPS Projetos — Fase B: marca formulários (do motor genérico) que devem
-- alimentar o NPS Projetos, junto com o avaliacoes_nps atual. Mesmo padrão
-- de formularios.nps_interno (20260905_formularios_subaba_nome_nps_interno.sql),
-- mas como flag SEPARADA: NPS Projetos e NPS Interno são fontes distintas e
-- não devem se misturar uma na outra.
ALTER TABLE formularios ADD COLUMN IF NOT EXISTS nps_projetos_generico boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN formularios.nps_projetos_generico IS 'true = este formulário alimenta o NPS Projetos (junto com avaliacoes_nps) — ver src/lib/nps-projetos-generico.ts. Vários formulários podem estar marcados ao mesmo tempo.';

-- Marca o formulário criado na Fase A (20260911) como fonte do NPS
-- Projetos — ele já nasceu pra isso, só precisava da coluna existir.
UPDATE formularios SET nps_projetos_generico = true WHERE id = 'f0a00000-0000-4000-8000-000000000000';
