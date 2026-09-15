-- Módulo "PDI — Momentos de Desenvolvimento": colaborador solicita um
-- momento (cronograma, case, dúvida, questões ou outro) com um papel de
-- liderança; quem tiver disponibilidade aceita ou sugere outro horário;
-- o administrador só acompanha. Ver especificação completa no PR.
--
-- Prefixo pdi_ reaproveitado de propósito (mesmo prefixo do antigo "Plano
-- de Desenvolvimento Individual", removido em 2026-09-05) — são conceitos
-- diferentes, mas os nomes de tabela não colidem: o antigo era
-- pdi_planos/pdi_tarefas, este é pdi_solicitacoes e afins.

-- 1) Papéis de liderança (fixos, definidos pela especificação — não
-- editáveis pelo admin). Cada solicitação pede um ou mais destes papéis.
create table if not exists pdi_papeis (
    id text primary key,
    nome text not null,
    ordem int not null
);

insert into pdi_papeis (id, nome, ordem) values
    ('closer', 'Closer', 1),
    ('ger_projetos', 'Gerente de Projetos', 2),
    ('ger_operacoes', 'Gerente de Operações', 3),
    ('ger_gente', 'Gerente de Gente', 4),
    ('ger_cs', 'Gerente de CS', 5),
    ('ger_inovacao', 'Gerente de Inovação', 6),
    ('ger_institucional', 'Gerente Institucional', 7),
    ('tatico', 'Cargo tático', 8),
    ('diretor', 'Diretor', 9)
on conflict (id) do nothing;

-- 2) Mapeamento cargo_atual + nucleo_atual -> papel de liderança. Existe
-- como tabela (em vez de lógica fixa no código) exatamente para permitir
-- corrigir a organização por núcleo com um UPDATE, sem deploy. Uma pessoa
-- resolve para o papel da linha com nucleo_atual IGUAL ao dela; se não
-- houver, cai na linha "catch-all" desse cargo_atual (nucleo_atual null).
create table if not exists pdi_cargos (
    id uuid primary key default gen_random_uuid(),
    papel_id text not null references pdi_papeis(id),
    cargo_atual text not null,
    nucleo_atual text null,
    unique (cargo_atual, nucleo_atual)
);

insert into pdi_cargos (papel_id, cargo_atual, nucleo_atual) values
    ('closer', 'Tático', 'Marketing'),
    ('ger_projetos', 'Tático', 'Projetos'),
    ('ger_cs', 'Tático', 'Customer Success'),
    ('ger_inovacao', 'Tático', 'Inovação'),
    ('ger_gente', 'Tático', 'Gestão de Pessoas'),
    ('ger_institucional', 'Tático', 'Vice Presidência'),
    ('ger_institucional', 'Tático', 'Presidência'),
    ('ger_operacoes', 'Tático', 'Tecnologia'),
    ('tatico', 'Tático', 'Escopos & Produtos'),
    ('tatico', 'Tático', null),
    ('diretor', 'Estratégico', null)
on conflict (cargo_atual, nucleo_atual) do nothing;

-- 3) Tipos de momento (editáveis pelo admin em §7, exceto "Outro").
create table if not exists pdi_tipos_momento (
    id text primary key,
    nome text not null,
    descricao text,
    sub_label text not null,
    sub_opcoes text[] not null default '{}',
    ativo boolean not null default true,
    ordem int not null
);

insert into pdi_tipos_momento (id, nome, descricao, sub_label, sub_opcoes, ordem) values
    ('cronograma', 'Cronograma', 'Planejamento do PDI', 'Áreas', array['Estratégia','Financeiro','Produção'], 1),
    ('case', 'Case', 'Discutir uma situação prática', 'Tipo de case', array['Técnico','Comportamental','Liderança'], 2),
    ('duvida', 'Dúvida', 'Uma pergunta objetiva', 'Áreas', array['Financeiro','Estratégia','Produção'], 3),
    ('questoes', 'Questões', 'Um conjunto de questões para trabalhar', 'Áreas', array['Financeiro','Estratégia','Produção'], 4),
    ('outro', 'Outro', null, '', '{}', 5)
on conflict (id) do nothing;

-- 4) Solicitações de momento.
create table if not exists pdi_solicitacoes (
    id uuid primary key default gen_random_uuid(),
    colaborador_id uuid not null references colaboradores(id),
    cargos text[] not null,              -- ids de pdi_papeis pedidos
    tipos text[] not null,               -- ids de pdi_tipos_momento
    detalhes jsonb not null default '{}', -- { tipo_id: [opções escolhidas] }
    outro_texto text,
    data date not null,
    hora time not null,
    descricao text,
    status text not null default 'aguardando'
        check (status in ('aguardando','agendado','reagendado','concluido','cancelado')),
    sugestao jsonb,                       -- { data, hora, motivo, lider_id }
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

create index if not exists idx_pdi_solicitacoes_colaborador on pdi_solicitacoes(colaborador_id);
create index if not exists idx_pdi_solicitacoes_status on pdi_solicitacoes(status);

-- 5) Aceite por papel pedido — uma linha por papel já na criação da
-- solicitação (lider_id null = ainda aberta para aquele papel). Permite
-- solicitações multi-papel ("Gerente de Projetos e Closer") com aceite
-- independente por papel, conforme a regra "um aceite por cargo".
create table if not exists pdi_solicitacao_lideres (
    solicitacao_id uuid not null references pdi_solicitacoes(id) on delete cascade,
    papel_id text not null references pdi_papeis(id),
    lider_id uuid null references colaboradores(id),
    aceito_em timestamptz null,
    primary key (solicitacao_id, papel_id)
);

create index if not exists idx_pdi_solicitacao_lideres_lider on pdi_solicitacao_lideres(lider_id);

-- 6) Anotações de conclusão (resumo + próximos passos).
create table if not exists pdi_anotacoes (
    id uuid primary key default gen_random_uuid(),
    solicitacao_id uuid not null references pdi_solicitacoes(id) on delete cascade,
    autor_id uuid not null references colaboradores(id),
    texto text not null,
    proximos_passos text,
    criado_em timestamptz not null default now()
);

-- 7) Histórico de eventos (feed do admin, histórico no detalhe, base das
-- mensagens do Slack).
create table if not exists pdi_eventos (
    id uuid primary key default gen_random_uuid(),
    solicitacao_id uuid not null references pdi_solicitacoes(id) on delete cascade,
    tipo text not null check (tipo in (
        'nova','aceite','sugestao','aceite_sugestao','recusa_sugestao',
        'cancelamento','conclusao'
    )),
    autor_id uuid not null references colaboradores(id),
    texto text not null,
    criado_em timestamptz not null default now()
);

create index if not exists idx_pdi_eventos_solicitacao on pdi_eventos(solicitacao_id);

-- 8) Notificações internas.
create table if not exists pdi_notificacoes (
    id uuid primary key default gen_random_uuid(),
    membro_id uuid not null references colaboradores(id),
    texto text not null,
    lida boolean not null default false,
    solicitacao_id uuid null references pdi_solicitacoes(id) on delete set null,
    criado_em timestamptz not null default now()
);

create index if not exists idx_pdi_notificacoes_membro on pdi_notificacoes(membro_id, lida);

-- RLS: mesmo padrão já usado nas demais tabelas do projeto (policy
-- permissiva "allow all"; a validação de papel/liderança de verdade fica
-- nos route handlers do Next.js que fazem as escritas sensíveis — aceitar,
-- sugerir, concluir, cancelar —, na mesma linha do que já existe em
-- /api/ausencias).
alter table pdi_papeis enable row level security;
alter table pdi_cargos enable row level security;
alter table pdi_tipos_momento enable row level security;
alter table pdi_solicitacoes enable row level security;
alter table pdi_solicitacao_lideres enable row level security;
alter table pdi_anotacoes enable row level security;
alter table pdi_eventos enable row level security;
alter table pdi_notificacoes enable row level security;

create policy "Allow all for authenticated users" on pdi_papeis for all using (true) with check (true);
create policy "Allow all for authenticated users" on pdi_cargos for all using (true) with check (true);
create policy "Allow all for authenticated users" on pdi_tipos_momento for all using (true) with check (true);
create policy "Allow all for authenticated users" on pdi_solicitacoes for all using (true) with check (true);
create policy "Allow all for authenticated users" on pdi_solicitacao_lideres for all using (true) with check (true);
create policy "Allow all for authenticated users" on pdi_anotacoes for all using (true) with check (true);
create policy "Allow all for authenticated users" on pdi_eventos for all using (true) with check (true);
create policy "Allow all for authenticated users" on pdi_notificacoes for all using (true) with check (true);
