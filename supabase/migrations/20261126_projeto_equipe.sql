-- Equipe de cada projeto: quem é o GERENTE e quem são os CONSULTORES.
--
-- Até hoje a Área do Membro só guardava QUANTOS e QUAIS projetos cada pessoa
-- tem (colaboradores.projetos / projetos_ativos_detalhe), sem dizer se ela
-- é gerente ou consultora naquele projeto — a sincronização com o Monday
-- juntava as colunas "Gerente" e "Consultores" numa lista só. Sem o papel,
-- o formulário NPS Projetos não tem como saber quem cada pessoa deve avaliar.
--
-- Esta tabela é preenchida pela sincronização diária com o Monday (ver
-- syncMondayEquipes em src/lib/monday-sync.ts) e é INDEPENDENTE de
-- colaboradores.projetos: não altera a contagem usada no cálculo do PIPJ.
--
-- Uma pessoa só tem um papel por projeto (se aparecer nas duas colunas do
-- Monday, vale "gerente"). Só projetos ativos têm linhas aqui — ao terminar,
-- a sincronização remove a equipe.

create table if not exists projeto_equipe (
    id uuid primary key default gen_random_uuid(),
    projeto_id text not null references projetos(id) on delete cascade,
    colaborador_id text not null references colaboradores(id) on delete cascade,
    papel text not null check (papel in ('gerente', 'consultor')),
    atualizado_em timestamptz not null default now(),
    unique (projeto_id, colaborador_id)
);

create index if not exists idx_projeto_equipe_colaborador on projeto_equipe(colaborador_id);
create index if not exists idx_projeto_equipe_projeto on projeto_equipe(projeto_id);

comment on table projeto_equipe is 'Gerente e consultores de cada projeto ativo (sincronizado do Monday).';
