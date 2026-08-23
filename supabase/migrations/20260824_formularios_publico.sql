-- Público de um formulário: para quem ele aparece ("quem responde") e sobre
-- quem ele pode ser respondido ("quem recebe"), cada um como uma lista de
-- pares (cargo, núcleo) — ver src/lib/forms-publico.ts.
--
-- Ausência de linhas em formulario_publico_responde = "Todos" (todo mundo
-- vê o formulário — o comportamento padrão de hoje, sem nenhuma alteração).
-- Ausência de linhas em formulario_publico_recebe = "Ninguém" (formulário
-- comum, sem direcionamento — cada resposta é sobre o próprio respondente).
-- Essa é a formatação básica de todo formulário já existente.
CREATE TABLE IF NOT EXISTS formulario_publico_responde (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    formulario_id uuid NOT NULL REFERENCES formularios(id) ON DELETE CASCADE,
    cargo text NOT NULL,
    nucleo text NOT NULL,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_formulario_publico_responde_formulario ON formulario_publico_responde(formulario_id);

CREATE TABLE IF NOT EXISTS formulario_publico_recebe (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    formulario_id uuid NOT NULL REFERENCES formularios(id) ON DELETE CASCADE,
    cargo text NOT NULL,
    nucleo text NOT NULL,
    created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_formulario_publico_recebe_formulario ON formulario_publico_recebe(formulario_id);

ALTER TABLE formulario_publico_responde ENABLE ROW LEVEL SECURITY;
ALTER TABLE formulario_publico_recebe ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for authenticated users" ON formulario_publico_responde FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for authenticated users" ON formulario_publico_recebe FOR ALL USING (true) WITH CHECK (true);

-- Quando o formulário é direcionado (linhas em formulario_publico_recebe),
-- cada resposta passa a ser "sobre" um colaborador específico — uma aba de
-- preenchimento por alvo, todas usando as mesmas perguntas do formulário,
-- mas salvas como envelopes (formulario_respostas) independentes e
-- editáveis separadamente. NULL preserva o comportamento de hoje (resposta
-- sobre o próprio respondente).
ALTER TABLE formulario_respostas
    ADD COLUMN IF NOT EXISTS alvo_colaborador_id uuid REFERENCES colaboradores(id);
CREATE INDEX IF NOT EXISTS idx_formulario_respostas_alvo ON formulario_respostas(alvo_colaborador_id);

-- A UNIQUE(formulario_id, colaborador_id) rastreada na migração
-- 20260319_create_forms_tables.sql impediria tanto múltiplas respostas por
-- mês (já usado hoje via "Responder novamente") quanto uma resposta por
-- alvo diferente — removida por segurança, caso ainda exista no banco.
ALTER TABLE formulario_respostas
    DROP CONSTRAINT IF EXISTS formulario_respostas_formulario_id_colaborador_id_key;
