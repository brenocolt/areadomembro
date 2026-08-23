-- Simplifica colaboradores.cargo_atual dos cargos granulares antigos para
-- os 3 níveis hierárquicos + a conta de uso administrativo do sistema (ver
-- src/lib/cargos.ts):
--   Operacional:   Assessor, Consultor, SDR
--   Tático:        Closer + todos os cargos de Gerência (Gerente de
--                  Projetos, Gerente de Inovação, Gerente de Operações,
--                  Gerente de CS, Gerente de Gente, Gerente Institucional)
--   Estratégico:   Diretor
--   Administrador: mantido — não precisa de UPDATE.
--
-- Não mexe em colunas de histórico/auditoria (historico_cargos.cargo,
-- ocorrencias.cargo_na_epoca, transacoes_pipj.cargo_no_periodo) — elas
-- registram o cargo válido NA ÉPOCA de cada evento e devem continuar
-- refletindo o valor granular original, não o esquema novo.
--
-- A diferenciação que o PIPJ fazia entre Gerente de Projetos, Closer e
-- demais gerentes passa a ser recuperada cruzando o novo cargo "Tático" com
-- colaboradores.nucleo_atual — ver src/lib/pipj-cargo-rules.ts. Isso só
-- funciona corretamente se o núcleo de cada Tático já reflete sua função
-- (ex.: núcleo "Projetos" para quem era Gerente de Projetos, "Marketing"
-- para quem era Closer); núcleo continua em texto livre e pode ser
-- corrigido depois, na aba Gestão de Usuários, por quem tem acesso.
UPDATE colaboradores SET cargo_atual = 'Operacional'
  WHERE cargo_atual IN ('Assessor', 'Consultor', 'SDR');

UPDATE colaboradores SET cargo_atual = 'Tático'
  WHERE cargo_atual IN (
    'Closer',
    'Gerente de Projetos',
    'Gerente de Inovação',
    'Gerente de Operações',
    'Gerente de CS',
    'Gerente de Gente',
    'Gerente Institucional'
  );

UPDATE colaboradores SET cargo_atual = 'Estratégico'
  WHERE cargo_atual = 'Diretor';

-- 'Administrador' já está correto — nenhum UPDATE necessário para ele.
-- Qualquer outro valor residual (fora da lista antiga em src/lib/cargos.ts)
-- é deixado como está, para não sobrescrever um dado que ninguém confirmou
-- — quem tem acesso à aba Gestão de Usuários corrige manualmente pelo novo
-- dropdown.
