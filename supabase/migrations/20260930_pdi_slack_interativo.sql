-- Integração interativa com o Slack: a mensagem de "novo momento" postada
-- no canal #tático passa a ter botões (Aceitar / Sugerir outro horário) e é
-- atualizada a cada mudança de status. Guardamos onde a mensagem foi postada
-- para poder editá-la depois (chat.update).
alter table pdi_solicitacoes
    add column if not exists slack_channel text,
    add column if not exists slack_ts text;
