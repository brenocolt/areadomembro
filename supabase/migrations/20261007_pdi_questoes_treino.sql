-- PDI: treino de questões. Questões do banco passam a poder ter alternativas
-- e a resposta certa (índice, a partir de 0); qualquer membro pode treinar
-- com elas, sem marcar horário, e ver o gabarito e o índice de acerto depois
-- de responder. As respostas certas nunca saem do servidor antes da correção
-- (ver /api/pdi/questoes).
alter table pdi_banco_itens
    add column if not exists alternativas jsonb,   -- ["texto A", "texto B", ...] (só tipo = 'questao')
    add column if not exists correta int;          -- índice da alternativa certa

create table if not exists pdi_questoes_tentativas (
    id uuid primary key default gen_random_uuid(),
    colaborador_id uuid not null references colaboradores(id),
    total int not null,
    acertos int not null,
    -- [{ questao_id, categoria, escolha, correta, acertou }]
    itens jsonb not null default '[]',
    criado_em timestamptz not null default now()
);

create index if not exists idx_pdi_questoes_tentativas_colaborador on pdi_questoes_tentativas(colaborador_id, criado_em desc);

alter table pdi_questoes_tentativas enable row level security;
create policy "Allow all for authenticated users" on pdi_questoes_tentativas for all using (true) with check (true);
