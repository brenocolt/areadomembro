-- Migration: Add prazo column to pdi_tarefas
-- Add a deadline field per activity in PDI
ALTER TABLE pdi_tarefas ADD COLUMN IF NOT EXISTS prazo TIMESTAMPTZ;

-- Migration: Create milhas_catalogo table for miles catalog management
CREATE TABLE IF NOT EXISTS milhas_catalogo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nome TEXT NOT NULL,
    preco NUMERIC NOT NULL DEFAULT 0,
    disponivel BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the catalog with default products
INSERT INTO milhas_catalogo (nome, preco, disponivel) VALUES
    ('-1 Ponto', 10, true),
    ('Vale iFood (R$ 30,00)', 30, true),
    ('2 ingressos comuns para o cinema', 35, true),
    ('Camisa de evento MEJ', 50, true),
    ('Almoço camarões', 60, true),
    ('Mouse', 70, true),
    ('Participação em evento sênior de valor', 100, true),
    ('Day use em um hotel', 150, true),
    ('R$ 200 em produtos amazon', 200, true),
    ('Fone de ouvido', 250, true),
    ('Alexa', 300, true),
    ('Ingresso para show local', 400, true),
    ('Kindle', 600, true)
ON CONFLICT DO NOTHING;

-- RLS for milhas_catalogo
ALTER TABLE milhas_catalogo ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "milhas_catalogo_public_read" ON milhas_catalogo
    FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "milhas_catalogo_admin_write" ON milhas_catalogo
    FOR ALL USING (true);

-- Migration: Create pontos_tipos_remocao table for managing point removal types
CREATE TABLE IF NOT EXISTS pontos_tipos_remocao (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grupo TEXT NOT NULL,
    titulo TEXT NOT NULL,
    db_value TEXT NOT NULL,
    pontos INTEGER NOT NULL DEFAULT 1,
    disponivel BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the removal types with defaults
INSERT INTO pontos_tipos_remocao (grupo, titulo, db_value, pontos, disponivel) VALUES
    ('DESENVOLVIMENTO', 'Curso com certificado', 'Fazer um curso que agregue a sua formação e a Produtiva, com certificado', 1, true),
    ('DESENVOLVIMENTO', 'Treinamento interno', 'Dar treinamento interno para Produtiva (Turbinar, Calcificar, PTPJ, Take Off, entre outros)', 1, true),
    ('DESENVOLVIMENTO', 'Participar de um bench', 'Participar de um bench', 1, true),
    ('DESENVOLVIMENTO', 'Indicar lead quente', 'Indicar um lead quente que seja convertido em reunião de proposta', 1, true),
    ('DESENVOLVIMENTO', 'Participação de GT', 'Participação de GT (Grupo de Trabalho)', 1, true),
    ('CRESCIMENTO', 'Treinamento outra EJ', 'Dar treinamento para outra EJ', 2, true),
    ('CRESCIMENTO', 'Consultoria externa', 'Dar treinamento em consultoria/assessoria desde que esse não esteja previsto em cronograma', 2, true),
    ('CRESCIMENTO', 'CSAT 5 ou NPS 10', 'Obter CSAT 5 ou NPS 10 em uma consultoria/assessoria', 2, true),
    ('CRESCIMENTO', 'Fidelizar projeto', 'Fidelizar projeto que o membro faça parte da equipe de consultoria', 2, true),
    ('CRESCIMENTO', 'Finalizar edital', 'Finalizar a participação em edital (PSC, PSGP, Edital de Coordenadorias do PTPJ Edital de Diretoria)', 2, true),
    ('CRESCIMENTO', 'Finalizar PDI no prazo', 'Finalizar um PDI no prazo', 2, true),
    ('CRESCIMENTO', 'Concretização parcerias', 'Auxiliar na concretização de parcerias em conjunto com o núcleo da presidência', 2, true),
    ('FORTALECIMENTO', 'Escrever um case', 'Escrever um case (mesmo que não tenha sido montado um edital, para ficar no banco de dados)', 3, true),
    ('FORTALECIMENTO', 'Projeto de melhoria', 'Desenvolver e finalizar um projeto de melhoria/iniciativa interna juntamente a algum dos núcleos', 3, true)
ON CONFLICT DO NOTHING;

-- RLS for pontos_tipos_remocao
ALTER TABLE pontos_tipos_remocao ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "pontos_tipos_remocao_public_read" ON pontos_tipos_remocao
    FOR SELECT USING (true);

CREATE POLICY IF NOT EXISTS "pontos_tipos_remocao_admin_write" ON pontos_tipos_remocao
    FOR ALL USING (true);
