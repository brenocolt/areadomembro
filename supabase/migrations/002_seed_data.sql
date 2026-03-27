-- ============================================================
-- SEED DATA: Dados iniciais para Produtiva Portal
-- ============================================================

-- Colaborador: Breno Colt
INSERT INTO colaboradores (id, nome, foto, data_nascimento, cpf, endereco, telefone, email_pessoal, email_corporativo, hobby, chocolate_favorito, serie_filme_favorito, safra, semestre_ingresso, nucleo_atual, cargo_atual, matricula, saldo_pipj, pontos_negativos)
VALUES (
    'c0000001-0001-4000-8000-000000000001',
    'Breno Colt', NULL,
    '2000-10-26', '126.552.964-78',
    'Alameda dos Bosques, 270 - Casa 272',
    '84 99449-5885', 'coltbreno@gmail.com',
    'brenocolt@produtivajunior.com.br',
    'Tênis', 'Branco', NULL,
    'EB 32', '25.2', 'Projetos', 'Consultor', NULL,
    200.00, 2
) ON CONFLICT (id) DO NOTHING;

-- User (login)
INSERT INTO users (id, email, senha, role, colaborador_id)
VALUES (
    'a0000001-0001-4000-8000-000000000001',
    'brenocolt@produtivajunior.com.br',
    '$2a$10$example_hashed_password',
    'COLABORADOR',
    'c0000001-0001-4000-8000-000000000001'
) ON CONFLICT (id) DO NOTHING;

-- Histórico de Cargos
INSERT INTO historico_cargos (colaborador_id, cargo, semestre_inicio, semestre_fim)
VALUES ('c0000001-0001-4000-8000-000000000001', 'Consultor', '25.2', NULL)
ON CONFLICT DO NOTHING;

-- Ocorrência (punição)
INSERT INTO ocorrencias (colaborador_id, data, cargo_na_epoca, motivo, descricao, pontuacao, supervisor, gravidade)
VALUES (
    'c0000001-0001-4000-8000-000000000001',
    '2025-12-02', 'Consultor',
    'Má conduta em sala da PJ',
    'Uso inadequado do espaço de coworking durante reunião de diretoria.',
    2, 'Ana Silva', 'GRAVE'
) ON CONFLICT DO NOTHING;

-- Avaliações NPS
INSERT INTO avaliacoes_nps (colaborador_id, mes, ano, comunicacao, dedicacao, confianca, pontualidade, organizacao, proatividade, qualidade_entregas, dominio_tecnico, nps_geral)
VALUES
    ('c0000001-0001-4000-8000-000000000001', 7, 2025, 8.0, 8.5, 8.0, 9.0, 8.5, 8.0, 8.5, 8.0, 8.5),
    ('c0000001-0001-4000-8000-000000000001', 8, 2025, 8.5, 9.0, 9.0, 9.0, 9.0, 8.5, 9.0, 8.5, 9.0),
    ('c0000001-0001-4000-8000-000000000001', 9, 2025, 9.5, 9.5, 9.5, 9.8, 9.5, 10.0, 9.8, 9.0, 9.8),
    ('c0000001-0001-4000-8000-000000000001', 10, 2025, 9.0, 9.5, 9.5, 9.5, 9.5, 9.5, 9.5, 9.0, 9.5),
    ('c0000001-0001-4000-8000-000000000001', 11, 2025, 9.5, 9.5, 9.8, 10.0, 9.0, 10.0, 9.8, 9.5, 9.6),
    ('c0000001-0001-4000-8000-000000000001', 12, 2025, 9.8, 10.0, 10.0, 10.0, 9.5, 10.0, 10.0, 9.8, 9.8)
ON CONFLICT (colaborador_id, mes, ano) DO NOTHING;

-- Transações PIPJ
INSERT INTO transacoes_pipj (colaborador_id, tipo, periodo, semestre, cargo_no_periodo, nps_no_periodo, valor, status, data)
VALUES
    ('c0000001-0001-4000-8000-000000000001', 'ENTRADA', 'Novembro 2025', '25.2', 'Consultor', 9.6, 200.00, 'CREDITADO', '2025-11-15'),
    ('c0000001-0001-4000-8000-000000000001', 'SAIDA', NULL, NULL, NULL, NULL, 50.00, 'APROVADO', '2025-11-20')
ON CONFLICT DO NOTHING;

INSERT INTO transacoes_pipj (colaborador_id, tipo, descricao_resgate, valor, status, data)
VALUES ('c0000001-0001-4000-8000-000000000001', 'SAIDA', 'Vale Refeição Extra', 50.00, 'APROVADO', '2025-11-20')
ON CONFLICT DO NOTHING;

-- Catálogo de Benefícios
INSERT INTO beneficios_catalogo (id, nome, valor, icone, desbloqueado)
VALUES
    ('b0000001-0001-4000-8000-000000000001', 'Vale Refeição Extra', 50.00, 'coffee', true),
    ('b0000001-0002-4000-8000-000000000002', 'Voucher Uber', 30.00, 'car', true),
    ('b0000001-0003-4000-8000-000000000003', 'Curso Udemy', 100.00, 'graduation-cap', true),
    ('b0000001-0004-4000-8000-000000000004', 'Headset Noise Cancelling', 400.00, 'shopping-bag', false)
ON CONFLICT (id) DO NOTHING;

-- Milhas - Saldo
INSERT INTO milhas_saldo (colaborador_id, saldo_total, saldo_disponivel, milhas_mes_atual)
VALUES ('c0000001-0001-4000-8000-000000000001', 25400, 15400, 2450)
ON CONFLICT (colaborador_id) DO NOTHING;

-- Milhas - Produtos
INSERT INTO milhas_produtos (id, nome, descricao, custo_milhas, categoria, icone, disponivel, destaque)
VALUES
    ('d0000001-0001-4000-8000-000000000001', 'Garrafa Térmica Premium', 'Garrafa de aço inox 500ml', 850, 'acessorios', 'cup-soda', true, true),
    ('d0000001-0002-4000-8000-000000000002', 'Mousepad Ergonômico', 'Mousepad com apoio de pulso', 600, 'acessorios', 'mouse', true, false),
    ('d0000001-0003-4000-8000-000000000003', 'Voucher iFood R$100', 'Crédito de R$100 no iFood', 1200, 'vouchers', 'utensils', true, true),
    ('d0000001-0004-4000-8000-000000000004', 'Kit Camiseta Produtiva', 'Camiseta oficial da EJ', 500, 'vestuario', 'shirt', true, false),
    ('d0000001-0005-4000-8000-000000000005', 'Rio de Janeiro (Voo)', 'Passagem aérea ida e volta', 4500, 'viagens', 'plane', true, true),
    ('d0000001-0006-4000-8000-000000000006', 'Cartão Amazon R$50', 'Gift card Amazon', 1000, 'vouchers', 'credit-card', true, false)
ON CONFLICT (id) DO NOTHING;

-- Milhas - Trocas (histórico)
INSERT INTO milhas_trocas (colaborador_id, produto_id, item_nome, milhas_gastas, status, data_troca)
VALUES
    ('c0000001-0001-4000-8000-000000000001', 'd0000001-0005-4000-8000-000000000005', 'Rio de Janeiro (Voo)', 4500, 'APROVADA', '2025-11-12'),
    ('c0000001-0001-4000-8000-000000000001', 'd0000001-0006-4000-8000-000000000006', 'Cartão Amazon R$50', 1000, 'PENDENTE', '2025-11-08'),
    ('c0000001-0001-4000-8000-000000000001', 'd0000001-0003-4000-8000-000000000003', 'Voucher iFood R$100', 1200, 'REPROVADA', '2025-10-28')
ON CONFLICT DO NOTHING;

-- Mais colaboradores para "Top Offenders" na gestão de pontos
INSERT INTO colaboradores (id, nome, email_corporativo, safra, semestre_ingresso, nucleo_atual, cargo_atual, saldo_pipj, pontos_negativos)
VALUES
    ('c0000002-0002-4000-8000-000000000002', 'Maria Santos', 'mariasantos@produtivajunior.com.br', 'EB 31', '25.1', 'Financeiro', 'Consultor', 150.00, 5),
    ('c0000003-0003-4000-8000-000000000003', 'João Silva', 'joaosilva@produtivajunior.com.br', 'EB 30', '24.2', 'Comercial', 'Gerente', 300.00, 4),
    ('c0000004-0004-4000-8000-000000000004', 'Ana Oliveira', 'anaoliveira@produtivajunior.com.br', 'EB 32', '25.2', 'Projetos', 'Trainee', 50.00, 3),
    ('c0000005-0005-4000-8000-000000000005', 'Pedro Lima', 'pedrolima@produtivajunior.com.br', 'EB 31', '25.1', 'Marketing', 'Consultor', 175.00, 2)
ON CONFLICT (id) DO NOTHING;

-- Ocorrências dos outros colaboradores
INSERT INTO ocorrencias (colaborador_id, data, cargo_na_epoca, motivo, descricao, pontuacao, supervisor, gravidade)
VALUES
    ('c0000002-0002-4000-8000-000000000002', '2025-11-15', 'Consultor', 'Atraso em entregas', 'Atraso recorrente no prazo de entrega de relatórios.', 3, 'Carlos Souza', 'MODERADO'),
    ('c0000002-0002-4000-8000-000000000002', '2025-12-01', 'Consultor', 'Falta não justificada', 'Não compareceu à reunião semanal.', 2, 'Carlos Souza', 'LEVE'),
    ('c0000003-0003-4000-8000-000000000003', '2025-10-20', 'Gerente', 'Relatório incompleto', 'Entregou relatório financeiro com dados incompletos.', 2, 'Diretor RH', 'MODERADO'),
    ('c0000003-0003-4000-8000-000000000003', '2025-11-25', 'Gerente', 'Falta não justificada', 'Não compareceu ao evento institucional.', 2, 'Diretor RH', 'LEVE'),
    ('c0000004-0004-4000-8000-000000000004', '2025-12-10', 'Trainee', 'Uso indevido de recursos', 'Utilizou impressora da EJ para uso pessoal.', 1, 'Ana Silva', 'LEVE'),
    ('c0000004-0004-4000-8000-000000000004', '2025-12-15', 'Trainee', 'Atraso em entregas', 'Não entregou relatório no prazo.', 2, 'Ana Silva', 'MODERADO'),
    ('c0000005-0005-4000-8000-000000000005', '2025-11-28', 'Consultor', 'Conduta inadequada', 'Uso de celular durante apresentação ao cliente.', 2, 'João Gerente', 'MODERADO')
ON CONFLICT DO NOTHING;

-- Solicitações de remoção de pontos
INSERT INTO solicitacoes_remocao (colaborador_id, motivo, status)
VALUES
    ('c0000002-0002-4000-8000-000000000002', 'Comprometimento compensatório demonstrado nos últimos meses.', 'PENDENTE'),
    ('c0000004-0004-4000-8000-000000000004', 'Primeira ocorrência, solicito revisão.', 'PENDENTE')
ON CONFLICT DO NOTHING;
