-- Add pagina_destino: connects form responses to a target page (performance or nps-gerente)
ALTER TABLE formularios ADD COLUMN IF NOT EXISTS pagina_destino text DEFAULT NULL;

-- Add tipo_formulario: used in penalty descriptions ("Não respondeu o NPS de ...")
ALTER TABLE formularios ADD COLUMN IF NOT EXISTS tipo_formulario text DEFAULT 'formulário';
