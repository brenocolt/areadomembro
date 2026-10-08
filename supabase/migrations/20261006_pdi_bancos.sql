-- PDI: bancos de cases, de questões e de cronogramas, visíveis só para
-- líderes (Tático = gerente do núcleo, Estratégico = diretor). Uma única
-- tabela com o campo `tipo`; a validação de quem pode ler/escrever fica nas
-- rotas /api/pdi/banco (mesmo padrão das demais tabelas pdi_*).
create table if not exists pdi_banco_itens (
    id uuid primary key default gen_random_uuid(),
    tipo text not null check (tipo in ('case', 'questao', 'cronograma')),
    titulo text not null,
    conteudo text,                -- descrição do case / enunciado / descrição do cronograma
    resposta text,                -- resolução (case) ou gabarito (questão); não usado em cronograma
    categoria text,               -- área / tipo de case (opções de pdi_tipos_momento.sub_opcoes)
    link text,                    -- material de apoio (Drive, Notion etc.)
    autor_id uuid not null references colaboradores(id),
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);

create index if not exists idx_pdi_banco_itens_tipo on pdi_banco_itens(tipo, criado_em desc);

alter table pdi_banco_itens enable row level security;
create policy "Allow all for authenticated users" on pdi_banco_itens for all using (true) with check (true);
