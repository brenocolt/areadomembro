-- Padroniza colaboradores.cargo_atual com valores fora da nova lista fixa
-- de cargos (ver src/lib/cargos.ts) para o cargo correspondente mais
-- próximo, mantendo a mesma regra de remuneração que a pessoa já tinha.
UPDATE colaboradores SET cargo_atual = 'Gerente de Projetos'
  WHERE cargo_atual = 'Gerente';

UPDATE colaboradores SET cargo_atual = 'Consultor'
  WHERE cargo_atual = 'Consultor de Projetos';

UPDATE colaboradores SET cargo_atual = 'Assessor'
  WHERE cargo_atual IN (
    'Assessor de projetos',
    'Assessora de Gestão de Pessoas ',
    'Assessor da presidência e consultor de projetos '
  );
