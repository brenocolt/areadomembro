CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  colaborador_id UUID REFERENCES colaboradores(id) ON DELETE CASCADE,
  campo TEXT NOT NULL,
  valor_antigo TEXT,
  valor_novo TEXT,
  editado_por TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated" ON audit_logs FOR ALL USING (true);
