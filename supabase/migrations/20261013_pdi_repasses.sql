-- PDI: "repasses" — a logística inversa do pedido de momento. Em vez de o
-- membro pedir, um tático (gerente) ou o diretor oferece um momento (ex.:
-- formulação de cronograma). O repasse cai no canal do Slack (#repassespdi),
-- os membros entram até o prazo de adesão e, depois dele, o tático confirma e
-- o momento vai para o Google Agenda com todos que entraram.
create table if not exists pdi_repasses (
    id uuid primary key default gen_random_uuid(),
    criador_id uuid not null references colaboradores(id),
    titulo text not null,
    descricao text,
    categoria text,                       -- área (opções de pdi_tipos_momento.sub_opcoes)
    data date not null,
    hora time not null,
    duracao_min int not null default 60,
    prazo_adesao timestamptz not null,    -- até quando os membros podem entrar
    vagas int,                            -- limite opcional de participantes
    status text not null default 'aberto' check (status in ('aberto', 'confirmado', 'cancelado')),
    slack_channel text,
    slack_ts text,
    google_event_id text,                 -- evento criado automaticamente (se o Google Agenda estiver configurado)
    google_email text,                    -- agenda onde ele foi criado
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

create index if not exists idx_pdi_repasses_criador on pdi_repasses(criador_id, criado_em desc);

create table if not exists pdi_repasse_participantes (
    repasse_id uuid not null references pdi_repasses(id) on delete cascade,
    colaborador_id uuid not null references colaboradores(id),
    entrou_em timestamptz not null default now(),
    primary key (repasse_id, colaborador_id)
);

alter table pdi_repasses enable row level security;
alter table pdi_repasse_participantes enable row level security;
drop policy if exists "Allow all for authenticated users" on pdi_repasses;
drop policy if exists "Allow all for authenticated users" on pdi_repasse_participantes;
create policy "Allow all for authenticated users" on pdi_repasses for all using (true) with check (true);
create policy "Allow all for authenticated users" on pdi_repasse_participantes for all using (true) with check (true);

notify pgrst, 'reload schema';
