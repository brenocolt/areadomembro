-- Zera as exceções manuais de acesso (paginas_permitidas) de todo mundo.
-- Antes da padronização (ver src/lib/access-control.ts), uma lista
-- explícita podia ter ficado com páginas que não fazem mais sentido pro
-- cargo/núcleo da pessoa — como paginas_permitidas agora é só exceção
-- aditiva (nunca restringe abaixo do padrão), qualquer coisa que estivesse
-- ali continuaria valendo pra sempre. Zerando, o acesso de todo mundo
-- passa a ser 100% definido pelo cargo/núcleo; quem precisar de algo além
-- disso recebe de novo, deliberadamente, por um Estratégico/ADM.
UPDATE colaboradores
SET paginas_permitidas = NULL
WHERE paginas_permitidas IS NOT NULL;
