-- Integração com o Google Agenda: cada pessoa envolvida num momento (quem
-- pediu e quem aceitou) recebe um evento na própria agenda. Guardamos o id do
-- evento de cada pessoa para atualizar (novo horário) ou remover (cancelamento).
create table if not exists pdi_agenda_eventos (
    solicitacao_id uuid not null references pdi_solicitacoes(id) on delete cascade,
    colaborador_id uuid not null references colaboradores(id),
    email text not null,            -- agenda onde o evento foi criado
    google_event_id text not null,
    primary key (solicitacao_id, colaborador_id)
);

alter table pdi_agenda_eventos enable row level security;
create policy "Allow all for authenticated users" on pdi_agenda_eventos for all using (true) with check (true);
