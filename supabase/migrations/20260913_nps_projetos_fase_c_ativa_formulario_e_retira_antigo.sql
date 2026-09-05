-- NPS Projetos — Fase C: só o formulário genérico fica de pé como entrada.
-- O código já removeu o card "NPS Projeto"/página dedicada (/nps-projeto
-- agora só redireciona) e os controles administrativos do fluxo antigo —
-- esta migração faz a contraparte no banco: ativa o formulário novo, que
-- até aqui ficava em rascunho esperando revisão.
--
-- avaliacoes_nps e nps_projeto_submissoes NÃO são tocadas — o histórico
-- continua intacto e continua entrando nas contas de quem já lê as duas
-- fontes (ver src/lib/nps-projetos-generico.ts, Fase B).
UPDATE formularios SET status = 'ativo' WHERE id = 'f0a00000-0000-4000-8000-000000000000' AND status = 'rascunho';
