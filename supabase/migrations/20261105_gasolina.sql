-- Reembolso de gasolina na Área do Membro — substitui a planilha
-- "REEMBOLSO GASOLINA" (uma aba por membro), o Google Form de autonomia dos
-- carros e o print anexado ao formulário "Processos de Pagamento" do Monday.
--
-- Regras herdadas da planilha (fórmulas da aba "EXEMPLO BASE"):
--   litros = distância (km) ÷ autonomia (km/L) do carro escolhido
--   preço  = preço médio do mês da DATA DA VIAGEM ("Histórico de preços")
--   valor  = litros × preço do mês (sem preço no mês, a viagem não é
--            reembolsável ainda)
--   Pendente vira Vencido 2 meses após a data da viagem (antes: Apps Script)
--
-- Só cria coisas novas (tabelas + colaboradores.chave_pix): não altera nem
-- apaga dado existente. Mesmo padrão de RLS de 20261013_pdi_repasses.sql —
-- o app usa a chave anon, então quem pode o quê é decidido nas rotas de API
-- (src/app/api/gasolina/*).

-- Chave Pix cadastrada uma vez pelo membro e enviada no card do Monday.
alter table colaboradores add column if not exists chave_pix text;

-- Carros do membro. "Excluir" = ativo=false, para não perder o histórico das
-- viagens já lançadas com aquele carro. O membro não edita a autonomia depois
-- de cadastrar (exclui e cadastra de novo, com nova foto); só a VP corrige.
create table if not exists gasolina_veiculos (
    id uuid primary key default gen_random_uuid(),
    colaborador_id uuid not null references colaboradores(id) on delete cascade,
    modelo text not null,
    ano int,
    combustivel text not null,
    autonomia_informada numeric(6,2) not null,  -- o que o membro declarou
    autonomia_km_l numeric(6,2) not null,       -- a que vale no cálculo (VP pode corrigir)
    foto_painel_url text not null,
    autonomia_alterada_por uuid references colaboradores(id),
    autonomia_alterada_em timestamptz,
    ativo boolean not null default true,
    excluido_em timestamptz,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),
    check (autonomia_informada > 0 and autonomia_km_l > 0)
);
create index if not exists idx_gasolina_veiculos_colab on gasolina_veiculos(colaborador_id, ativo);

-- Preço médio do litro por mês (mes = 1º dia do mês), lançado pela VP.
create table if not exists gasolina_precos (
    mes date primary key,
    preco_litro numeric(8,3) not null check (preco_litro > 0),
    atualizado_por uuid references colaboradores(id),
    atualizado_em timestamptz not null default now(),
    check (extract(day from mes) = 1)
);

-- Centros de custo que o membro escolhe ao lançar a viagem — editáveis pela
-- VP, como as opções do formulário do Monday. `tipo`:
--   'projeto' -> o membro escolhe o projeto da lista do Monday
--               (coluna monday_coluna_projeto, ex.: Categorias Consultoria)
--   'fixo'    -> sem projeto; vale o rótulo fixo (ex.: Prospecção)
-- monday_colunas: valores extras gravados no card, [{coluna, valor}].
create table if not exists gasolina_centros_custo (
    id uuid primary key default gen_random_uuid(),
    nome text not null,
    tipo text not null check (tipo in ('projeto', 'fixo')),
    rotulo_fixo text,                     -- tipo 'fixo': o que aparece como projeto (ex.: PROSPECÇÃO)
    monday_centro_custo text not null,    -- rótulo da coluna "Centro de Custo" do Monday
    monday_coluna_projeto text,           -- tipo 'projeto': coluna dropdown com a lista de projetos
    monday_colunas jsonb not null default '[]'::jsonb,
    ativo boolean not null default true,
    ordem int not null default 0,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

-- Os dois centros de hoje (ver JSON "AUTOMAÇÃO PAGAMENTO VP"):
--   Projetos executados -> Consultorias/Assessorias, categoria de execução Gasolina
--   Prospecção          -> Marketing, categoria Prospecção, categoria Gasolina
insert into gasolina_centros_custo (nome, tipo, rotulo_fixo, monday_centro_custo, monday_coluna_projeto, monday_colunas, ordem)
select 'Projetos (Consultorias/Assessorias)', 'projeto', null, 'Consultorias/Assessorias', 'dropdown_mkxcfwdz',
       '[{"coluna": "color_mkqc58qf", "valor": "Gasolina"}]'::jsonb, 1
where not exists (select 1 from gasolina_centros_custo where monday_centro_custo = 'Consultorias/Assessorias');

insert into gasolina_centros_custo (nome, tipo, rotulo_fixo, monday_centro_custo, monday_coluna_projeto, monday_colunas, ordem)
select 'Prospecção (Marketing)', 'fixo', 'PROSPECÇÃO', 'Marketing', null,
       '[{"coluna": "color_mkqcw2p1", "valor": "Prospecção"}, {"coluna": "color_mkqcr4af", "valor": "Gasolina"}]'::jsonb, 2
where not exists (select 1 from gasolina_centros_custo where monday_centro_custo = 'Marketing');

-- Pedido de reembolso: 1 por projeto/prospecção (mesma lógica de hoje). O
-- status espelha o kanban do Monday; recusado devolve as viagens a Pendente.
create table if not exists gasolina_solicitacoes (
    id uuid primary key default gen_random_uuid(),
    colaborador_id uuid not null references colaboradores(id) on delete cascade,
    centro_custo_id uuid references gasolina_centros_custo(id),
    projeto text not null,
    qtd_viagens int not null,
    litros_total numeric(10,3) not null,
    valor_total numeric(10,2) not null,
    chave_pix text,
    monday_item_id text unique,
    status text not null default 'Solicitado'
        check (status in ('Solicitado', 'Aprovado', 'Lançado', 'Pago', 'Recusado')),
    motivo_recusa text,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);
create index if not exists idx_gasolina_solicitacoes_colab on gasolina_solicitacoes(colaborador_id, criado_em desc);
create index if not exists idx_gasolina_solicitacoes_status on gasolina_solicitacoes(status);

-- Viagens. litros/preço/valor são snapshot: o histórico importado da planilha
-- guarda exatamente o que foi pago; viagens do app são recalculadas enquanto
-- estiverem Pendentes (ex.: VP corrigiu a autonomia ou lançou o preço do mês).
create table if not exists gasolina_viagens (
    id uuid primary key default gen_random_uuid(),
    colaborador_id uuid not null references colaboradores(id) on delete cascade,
    veiculo_id uuid references gasolina_veiculos(id),
    centro_custo_id uuid references gasolina_centros_custo(id),
    projeto text not null,
    projeto_original text,                -- importação: texto exatamente como estava na planilha
    origem_local text not null,
    destino_local text not null,
    paradas jsonb not null default '[]'::jsonb,  -- caronas (lista de endereços)
    distancia_km numeric(8,2) not null check (distancia_km > 0),
    data_viagem date not null,
    autonomia_usada numeric(6,2),
    litros numeric(10,3),
    preco_litro numeric(8,3),
    valor numeric(10,2),
    status text not null default 'Pendente'
        check (status in ('Pendente', 'Em solicitação', 'Reembolsado', 'Vencido')),
    solicitacao_id uuid references gasolina_solicitacoes(id) on delete set null,
    origem text not null default 'app' check (origem in ('app', 'planilha')),
    rota jsonb,                           -- fase Google Maps
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);
create index if not exists idx_gasolina_viagens_colab on gasolina_viagens(colaborador_id, data_viagem desc);
create index if not exists idx_gasolina_viagens_status on gasolina_viagens(status, data_viagem);
create index if not exists idx_gasolina_viagens_solicitacao on gasolina_viagens(solicitacao_id);

alter table gasolina_veiculos enable row level security;
alter table gasolina_precos enable row level security;
alter table gasolina_centros_custo enable row level security;
alter table gasolina_solicitacoes enable row level security;
alter table gasolina_viagens enable row level security;
drop policy if exists "Allow all for authenticated users" on gasolina_veiculos;
drop policy if exists "Allow all for authenticated users" on gasolina_precos;
drop policy if exists "Allow all for authenticated users" on gasolina_centros_custo;
drop policy if exists "Allow all for authenticated users" on gasolina_solicitacoes;
drop policy if exists "Allow all for authenticated users" on gasolina_viagens;
create policy "Allow all for authenticated users" on gasolina_veiculos for all using (true) with check (true);
create policy "Allow all for authenticated users" on gasolina_precos for all using (true) with check (true);
create policy "Allow all for authenticated users" on gasolina_centros_custo for all using (true) with check (true);
create policy "Allow all for authenticated users" on gasolina_solicitacoes for all using (true) with check (true);
create policy "Allow all for authenticated users" on gasolina_viagens for all using (true) with check (true);

-- Fotos do painel (autonomia), mesmo padrão de 20260906_profile_avatars_bucket.sql
-- com nomes de política próprios do bucket.
insert into storage.buckets (id, name, public)
values ('gasolina-paineis', 'gasolina-paineis', true)
on conflict (id) do nothing;

drop policy if exists "Gasolina Paineis Public Access" on storage.objects;
create policy "Gasolina Paineis Public Access" on storage.objects for select using (bucket_id = 'gasolina-paineis');

drop policy if exists "Gasolina Paineis Upload" on storage.objects;
create policy "Gasolina Paineis Upload" on storage.objects for insert with check (bucket_id = 'gasolina-paineis');

notify pgrst, 'reload schema';
