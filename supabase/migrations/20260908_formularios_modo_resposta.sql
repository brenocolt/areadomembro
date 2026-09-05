-- Modo de resposta por formulário: controla quantas vezes cada pessoa pode
-- responder. 'multipla' preserva o comportamento de sempre (cada envio cria
-- uma resposta nova, sem limite) — é o valor padrão, então formulários já
-- existentes não mudam de comportamento.
--   'unica'          -> só pode responder uma vez; depois disso a pessoa
--                       (ou, em formulário direcionado, aquele alvo
--                       específico) fica bloqueada para reenviar.
--   'unica_editavel' -> só uma resposta "vale", mas pode ser reaberta e
--                       corrigida — reenviar atualiza a mesma resposta em
--                       vez de criar uma nova.
--   'multipla'        -> ilimitado (padrão atual).
ALTER TABLE formularios ADD COLUMN IF NOT EXISTS modo_resposta TEXT NOT NULL DEFAULT 'multipla';

COMMENT ON COLUMN formularios.modo_resposta IS 'unica | unica_editavel | multipla — controla quantas vezes cada pessoa pode responder este formulário.';
