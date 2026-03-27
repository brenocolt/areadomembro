-- Migration: create_forms_tables
-- Creates the complete forms system schema

-- Templates de formulários
CREATE TABLE IF NOT EXISTS formularios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo text NOT NULL,
  descricao text,
  status text DEFAULT 'rascunho',
  data_inicio timestamptz,
  data_prazo timestamptz,
  created_by uuid REFERENCES colaboradores(id),
  created_at timestamptz DEFAULT now()
);

-- Perguntas do formulário
CREATE TABLE IF NOT EXISTS formulario_perguntas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulario_id uuid REFERENCES formularios(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  descricao text,
  tipo text NOT NULL,
  opcoes jsonb,
  obrigatoria boolean DEFAULT true,
  ordem int NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Respostas (1 registro por colaborador por formulário)
CREATE TABLE IF NOT EXISTS formulario_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  formulario_id uuid REFERENCES formularios(id) ON DELETE CASCADE,
  colaborador_id uuid REFERENCES colaboradores(id),
  enviado_em timestamptz DEFAULT now(),
  UNIQUE(formulario_id, colaborador_id)
);

-- Itens individuais de resposta
CREATE TABLE IF NOT EXISTS formulario_respostas_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  resposta_id uuid REFERENCES formulario_respostas(id) ON DELETE CASCADE,
  pergunta_id uuid REFERENCES formulario_perguntas(id) ON DELETE CASCADE,
  valor text,
  valores jsonb
);

-- Observação interna no PDI
ALTER TABLE pdi_planos ADD COLUMN IF NOT EXISTS observacao_interna text;

-- Enable RLS
ALTER TABLE formularios ENABLE ROW LEVEL SECURITY;
ALTER TABLE formulario_perguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE formulario_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE formulario_respostas_itens ENABLE ROW LEVEL SECURITY;

-- Policies (allow all for authenticated users - same pattern as existing tables)
CREATE POLICY "Allow all for authenticated users" ON formularios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON formulario_perguntas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON formulario_respostas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON formulario_respostas_itens FOR ALL USING (true) WITH CHECK (true);
