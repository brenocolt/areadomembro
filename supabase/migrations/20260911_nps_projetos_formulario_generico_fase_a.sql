-- NPS Projetos — Fase A da migração pro motor genérico de formulários.
--
-- Cria um ÚNICO formulário novo, em modo RASCUNHO (não aparece pra ninguém
-- responder até um admin ativá-lo em Gestão de Formulários), que replica o
-- fluxo de hoje (src/app/(dashboard)/formularios/components/nps-projeto-form.tsx)
-- usando perguntas/seções/lógica condicional 100% editáveis — ao contrário
-- do NPS Projeto atual, que tem perguntas fixas e grava em avaliacoes_nps.
--
-- Nada do sistema atual é tocado: /nps-projeto, avaliacoes_nps, PIPJ,
-- Performance, NPS Gerente, Wallet e o Agente de Feedback continuam
-- funcionando exatamente como hoje. Este formulário roda EM PARALELO — a
-- integração com esses consumidores é uma fase futura, só depois de
-- validado.
--
-- Fluxo (uma seção "implícita" inicial + 4 seções, com lógica condicional):
--   1. (implícita) Selecionar o projeto + "Você é o gerente responsável por
--      este projeto?" — "Sim" pula direto pra "Avalie sua Dupla"; "Não"
--      segue a sequência normal.
--   2. "Avalie o Gerente do Projeto" (só quem respondeu "Não" acima) — quem
--      é o gerente (filtrado por cargo Tático fora do núcleo Marketing,
--      equivalente a isCargoGerencial) + 5 notas + feedback.
--   3-5. "Avalie sua Dupla" (Consultor 1/2/3) — quem é o colega + 8 notas +
--      feedback + (nas duas primeiras) "há outro consultor?", repetindo a
--      seção seguinte se "Sim" ou encerrando se "Não".
--
-- Uma mesma resposta pode ter até 4 perguntas "Selecionar 1 Colaborador"
-- (gerente + até 3 duplas), cada uma sobre uma pessoa diferente — por isso
-- os consumidores genéricos (Assistente Pessoal, Agente de Feedback,
-- Pastas de Formulários) foram ensinados a atribuir cada pergunta ao
-- colaborador_unico da MESMA SEÇÃO (ver avaliadoPerguntaPorSecao em
-- src/lib/forms-runtime.ts), em vez de tratar a resposta inteira como
-- sendo sobre uma pessoa só.

INSERT INTO formularios (id, titulo, descricao, status, tipo_formulario, gerar_subaba, nps_interno, modo_resposta, created_at)
VALUES (
    'f0a00000-0000-4000-8000-000000000000',
    'NPS Projetos (Novo)',
    'Avaliação mensal de desempenho por projeto — gerente e dupla de consultores. Formulário em teste, rodando em paralelo à Avaliação NPS do Projeto atual.',
    'rascunho',
    'NPS Projetos',
    false,
    false,
    'multipla',
    now()
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO formulario_perguntas (id, formulario_id, titulo, descricao, tipo, opcoes, obrigatoria, ordem, competencia, permite_nao_avaliar)
VALUES
-- Seção implícita inicial: projeto + papel de quem responde
('f0a00000-0000-4000-8000-000000000001', 'f0a00000-0000-4000-8000-000000000000', 'Sobre qual projeto é esta avaliação?', null, 'selecionar_projeto', null, true, 1, null, false),
('f0a00000-0000-4000-8000-000000000002', 'f0a00000-0000-4000-8000-000000000000', 'Você é o gerente responsável por este projeto?', null, 'selecao_unica', '["Sim", "Não"]'::jsonb, true, 2, null, false),

-- Seção "Avalie o Gerente do Projeto" (só pra quem respondeu "Não" acima)
('f0a00000-0000-4000-8000-000000000003', 'f0a00000-0000-4000-8000-000000000000', 'Avalie o Gerente do Projeto', null, 'secao', null, true, 3, null, false),
('f0a00000-0000-4000-8000-000000000004', 'f0a00000-0000-4000-8000-000000000000', 'Quem é o gerente deste projeto?', null, 'colaborador_unico',
    '{"filtroPares": [{"cargo":"Tático","nucleo":"Projetos"},{"cargo":"Tático","nucleo":"Vice Presidência"},{"cargo":"Tático","nucleo":"Presidência"},{"cargo":"Tático","nucleo":"Gestão de Pessoas"},{"cargo":"Tático","nucleo":"Customer Success"},{"cargo":"Tático","nucleo":"Inovação"},{"cargo":"Tático","nucleo":"Tecnologia"},{"cargo":"Tático","nucleo":"Escopos & Produtos"}]}'::jsonb,
    true, 4, null, false),
('f0a00000-0000-4000-8000-000000000005', 'f0a00000-0000-4000-8000-000000000000', 'Quão clara foi a COMUNICAÇÃO do seu gerente, tanto na escuta quanto na fala, neste mês?', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 5, 'Comunicação', false),
('f0a00000-0000-4000-8000-000000000006', 'f0a00000-0000-4000-8000-000000000000', 'Avalie o quão você ficou satisfeito(a) com o SUPORTE do seu gerente em relação à EXECUÇÃO do projeto durante esse mês.', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 6, 'Suporte à Execução', false),
('f0a00000-0000-4000-8000-000000000007', 'f0a00000-0000-4000-8000-000000000000', 'Avalie o quão você ficou satisfeito(a) com o RELACIONAMENTO do seu gerente em relação à EQUIPE do projeto durante esse mês.', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 7, 'Relacionamento com a Equipe', false),
('f0a00000-0000-4000-8000-000000000008', 'f0a00000-0000-4000-8000-000000000000', 'Avalie o nível de RESOLUTIVIDADE do seu gerente do projeto durante esse mês.', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 8, 'Resolutividade', false),
('f0a00000-0000-4000-8000-000000000009', 'f0a00000-0000-4000-8000-000000000000', 'Avalie o quão satisfeito(a) você ficou com a LIDERANÇA do seu gerente em relação ao projeto neste mês.', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 9, 'Liderança', false),
('f0a0000a-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Compartilhe suas percepções sobre o gerente (pontos fortes e de melhoria).', null, 'texto', null, true, 10, null, false),
('f0a0000b-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'O gerente precisa de um feedback mais aprofundado?', null, 'selecao_unica', '["Sim", "Não"]'::jsonb, true, 11, null, false),

-- Seção "Avalie sua Dupla (Consultor 1)"
('f0a0000c-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Avalie sua Dupla (Consultor 1)', null, 'secao', null, true, 12, null, false),
('f0a0000d-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Quem é o(a) consultor(a) que você está avaliando?', null, 'colaborador_unico', null, true, 13, null, false),
('f0a0000e-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'O quão eficaz foi a COMUNICAÇÃO do(a) consultor(a) com a equipe esse mês?', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 14, 'Comunicação', false),
('f0a0000f-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Avalie o quanto o(a) consultor(a) SE DEDICOU ao projeto esse mês:', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 15, 'Dedicação', false),
('f0a00010-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Avalie o quanto você tem CONFIANÇA no trabalho deste(a) consultor(a) no projeto esse mês:', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 16, 'Confiança', false),
('f0a00011-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'O quanto esse(a) consultor(a) foi PONTUAL durante o mês? <i>Lembrando que Pontualidade não é só em reuniões com o cliente, mas também em reuniões internas, como sprints e construções, e cumprimento de prazos com as entregas.</i>', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 17, 'Pontualidade', false),
('f0a00012-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'O quanto esse(a) consultor(a) foi ORGANIZADO durante esse mês?', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 18, 'Organização', false),
('f0a00013-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'O quanto esse(a) consultor(a) foi PROATIVO durante esse mês?', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 19, 'Proatividade', false),
('f0a00014-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Como você se sentiu em relação à QUALIDADE das ENTREGAS desse(a) consultor(a) nesse último mês?', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 20, 'Qualidade das Entregas', false),
('f0a00015-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Como você avalia o DOMÍNIO TÉCNICO desse(a) consultor(a) durante o último mês?', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 21, 'Domínio Técnico', false),
('f0a00016-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Compartilhe suas percepções sobre este(a) consultor(a) (pontos fortes e de melhoria).', null, 'texto', null, true, 22, null, false),
('f0a00017-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Este(a) consultor(a) precisa de um feedback mais aprofundado?', null, 'selecao_unica', '["Sim", "Não"]'::jsonb, true, 23, null, false),
('f0a00018-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Há outro consultor no projeto que você gostaria de avaliar?', null, 'selecao_unica', '["Sim", "Não"]'::jsonb, true, 24, null, false),

-- Seção "Avalie sua Dupla (Consultor 2)"
('f0a00019-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Avalie sua Dupla (Consultor 2)', null, 'secao', null, true, 25, null, false),
('f0a0001a-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Quem é o(a) consultor(a) que você está avaliando?', null, 'colaborador_unico', null, true, 26, null, false),
('f0a0001b-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'O quão eficaz foi a COMUNICAÇÃO do(a) consultor(a) com a equipe esse mês?', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 27, 'Comunicação', false),
('f0a0001c-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Avalie o quanto o(a) consultor(a) SE DEDICOU ao projeto esse mês:', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 28, 'Dedicação', false),
('f0a0001d-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Avalie o quanto você tem CONFIANÇA no trabalho deste(a) consultor(a) no projeto esse mês:', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 29, 'Confiança', false),
('f0a0001e-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'O quanto esse(a) consultor(a) foi PONTUAL durante o mês? <i>Lembrando que Pontualidade não é só em reuniões com o cliente, mas também em reuniões internas, como sprints e construções, e cumprimento de prazos com as entregas.</i>', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 30, 'Pontualidade', false),
('f0a0001f-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'O quanto esse(a) consultor(a) foi ORGANIZADO durante esse mês?', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 31, 'Organização', false),
('f0a00020-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'O quanto esse(a) consultor(a) foi PROATIVO durante esse mês?', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 32, 'Proatividade', false),
('f0a00021-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Como você se sentiu em relação à QUALIDADE das ENTREGAS desse(a) consultor(a) nesse último mês?', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 33, 'Qualidade das Entregas', false),
('f0a00022-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Como você avalia o DOMÍNIO TÉCNICO desse(a) consultor(a) durante o último mês?', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 34, 'Domínio Técnico', false),
('f0a00023-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Compartilhe suas percepções sobre este(a) consultor(a) (pontos fortes e de melhoria).', null, 'texto', null, true, 35, null, false),
('f0a00024-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Este(a) consultor(a) precisa de um feedback mais aprofundado?', null, 'selecao_unica', '["Sim", "Não"]'::jsonb, true, 36, null, false),
('f0a00025-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Há outro consultor no projeto que você gostaria de avaliar?', null, 'selecao_unica', '["Sim", "Não"]'::jsonb, true, 37, null, false),

-- Seção "Avalie sua Dupla (Consultor 3)" — último possível (máximo de 3 duplas, igual ao formulário atual)
('f0a00026-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Avalie sua Dupla (Consultor 3)', null, 'secao', null, true, 38, null, false),
('f0a00027-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Quem é o(a) consultor(a) que você está avaliando?', null, 'colaborador_unico', null, true, 39, null, false),
('f0a00028-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'O quão eficaz foi a COMUNICAÇÃO do(a) consultor(a) com a equipe esse mês?', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 40, 'Comunicação', false),
('f0a00029-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Avalie o quanto o(a) consultor(a) SE DEDICOU ao projeto esse mês:', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 41, 'Dedicação', false),
('f0a0002a-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Avalie o quanto você tem CONFIANÇA no trabalho deste(a) consultor(a) no projeto esse mês:', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 42, 'Confiança', false),
('f0a0002b-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'O quanto esse(a) consultor(a) foi PONTUAL durante o mês? <i>Lembrando que Pontualidade não é só em reuniões com o cliente, mas também em reuniões internas, como sprints e construções, e cumprimento de prazos com as entregas.</i>', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 43, 'Pontualidade', false),
('f0a0002c-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'O quanto esse(a) consultor(a) foi ORGANIZADO durante esse mês?', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 44, 'Organização', false),
('f0a0002d-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'O quanto esse(a) consultor(a) foi PROATIVO durante esse mês?', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 45, 'Proatividade', false),
('f0a0002e-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Como você se sentiu em relação à QUALIDADE das ENTREGAS desse(a) consultor(a) nesse último mês?', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 46, 'Qualidade das Entregas', false),
('f0a0002f-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Como você avalia o DOMÍNIO TÉCNICO desse(a) consultor(a) durante o último mês?', null, 'escala',
    '{"criterios": {"1":{"titulo":"Abaixo das expectativas"},"2":{"titulo":"Pode melhorar"},"3":{"titulo":"Razoável/Neutro"},"4":{"titulo":"Satisfatório"},"5":{"titulo":"Acima das expectativas"}}}'::jsonb,
    true, 47, 'Domínio Técnico', false),
('f0a00030-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Compartilhe suas percepções sobre este(a) consultor(a) (pontos fortes e de melhoria).', null, 'texto', null, true, 48, null, false),
('f0a00031-0000-4000-8000-000000000000', 'f0a00000-0000-4000-8000-000000000000', 'Este(a) consultor(a) precisa de um feedback mais aprofundado?', null, 'selecao_unica', '["Sim", "Não"]'::jsonb, true, 49, null, false)
ON CONFLICT (id) DO NOTHING;

-- Lógica condicional (ver src/lib/forms-runtime.ts resolveNextTarget):
-- chave = índice da opção (0-based, na ordem de "opcoes"), valor = id da
-- pergunta 'secao' de destino, ou o literal 'enviar' pra encerrar ali.
UPDATE formulario_perguntas SET logica_condicional =
    '{"0": "f0a0000c-0000-4000-8000-000000000000"}'::jsonb
    -- "Sim" (índice 0, é gerente) pula direto pra "Avalie sua Dupla (Consultor 1)".
    -- "Não" (índice 1) não tem entrada: segue a sequência normal, caindo em
    -- "Avalie o Gerente do Projeto".
WHERE id = 'f0a00000-0000-4000-8000-000000000002';

UPDATE formulario_perguntas SET logica_condicional =
    '{"0": "f0a00019-0000-4000-8000-000000000000", "1": "enviar"}'::jsonb
    -- "Sim" (há outro consultor) -> Consultor 2. "Não" -> encerra o envio.
WHERE id = 'f0a00018-0000-4000-8000-000000000000';

UPDATE formulario_perguntas SET logica_condicional =
    '{"0": "f0a00026-0000-4000-8000-000000000000", "1": "enviar"}'::jsonb
    -- "Sim" (há outro consultor) -> Consultor 3. "Não" -> encerra o envio.
WHERE id = 'f0a00025-0000-4000-8000-000000000000';
