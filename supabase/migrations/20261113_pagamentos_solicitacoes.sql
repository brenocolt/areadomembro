-- Formulário próprio "Solicitar Pagamento ou Reembolso" (substitui o
-- WorkForms do Monday). Só cria coisas novas: não altera nem apaga dado
-- existente.
--
-- SEGURANÇA — diferente das demais tabelas do portal:
--   RLS ligado e NENHUMA política. A chave anon (que fica no navegador) não lê
--   nem grava nada aqui. Só o servidor do portal acessa, com a chave
--   service_role (SUPABASE_SERVICE_ROLE_KEY, configurada só no Coolify), e
--   decide quem pode o quê nas rotas /api/pagamentos/*.
--   O bucket de comprovantes também é privado: arquivos só por link
--   temporário gerado pelo servidor.

create table if not exists pagamentos_solicitacoes (
    id uuid primary key default gen_random_uuid(),
    numero bigint generated always as identity unique,   -- protocolo legível (#123)
    colaborador_id uuid not null references colaboradores(id) on delete restrict,
    solicitante_nome text not null,                       -- foto do cadastro no envio
    solicitante_email text,
    versao_formulario int not null,

    tipo text not null check (tipo in ('REEMBOLSO', 'PAGAMENTO')),
    forma_pagamento text,
    dados_bancarios text,
    descricao text not null,
    fornecedor text not null,
    valor numeric(12,2) not null check (valor > 0),
    centro_custo text not null,
    categoria text,
    categoria_execucao text,
    outra_categoria text,
    chave_pix text,
    eh_pipj boolean not null,
    eh_retirada_milha boolean not null,
    tipo_retirada_milha text,
    evento_mej text,
    respostas jsonb not null,             -- respostas como enviadas (auditoria)

    -- Envio duplicado (duplo clique / reenvio da tela) devolve a mesma solicitação.
    chave_idempotencia text not null unique,

    -- Automações (n8n)
    status_processamento text not null default 'recebida' check (status_processamento in (
        'recebida', 'enviada_n8n', 'erro_envio', 'em_processamento',
        'aguardando_aprovacao', 'aprovada', 'recusada', 'erro_processamento')),
    decisao text check (decisao in ('aprovada', 'recusada')),
    motivo_decisao text,
    decidido_por text,
    decidido_em timestamptz,
    n8n_tentativas int not null default 0,
    n8n_ultimo_envio_em timestamptz,
    n8n_ultimo_erro text,

    -- Reservado para o futuro Kanban financeiro (ainda em formulação).
    kanban_item_id text,

    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now()
);
create index if not exists idx_pag_solic_colab on pagamentos_solicitacoes(colaborador_id, criado_em desc);
create index if not exists idx_pag_solic_status on pagamentos_solicitacoes(status_processamento, criado_em);

create table if not exists pagamentos_anexos (
    id uuid primary key default gen_random_uuid(),
    solicitacao_id uuid not null references pagamentos_solicitacoes(id) on delete cascade,
    campo text not null check (campo in ('comprovante', 'workday_sdr')),
    caminho text not null unique,         -- caminho no bucket pagamentos-comprovantes
    nome_original text not null,
    tipo_mime text not null,
    tamanho_bytes bigint not null,
    criado_em timestamptz not null default now()
);
create index if not exists idx_pag_anexos_solic on pagamentos_anexos(solicitacao_id);

-- Histórico de tudo que acontece com a solicitação (envio, respostas do
-- n8n, erros). chave_idempotencia evita registrar duas vezes a mesma ação
-- do n8n quando ele reprocessa.
create table if not exists pagamentos_eventos (
    id uuid primary key default gen_random_uuid(),
    solicitacao_id uuid not null references pagamentos_solicitacoes(id) on delete cascade,
    origem text not null check (origem in ('portal', 'n8n')),
    tipo text not null,
    chave_idempotencia text unique,
    status_anterior text,
    status_novo text,
    detalhes jsonb,
    erro text,
    criado_em timestamptz not null default now()
);
create index if not exists idx_pag_eventos_solic on pagamentos_eventos(solicitacao_id, criado_em);

alter table pagamentos_solicitacoes enable row level security;
alter table pagamentos_anexos enable row level security;
alter table pagamentos_eventos enable row level security;
-- (sem "create policy" de propósito — ver o topo do arquivo)

-- Bucket privado, 10 MB por arquivo, só PDF e imagens. Sem políticas em
-- storage.objects: só a service_role (servidor) envia e gera links.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('pagamentos-comprovantes', 'pagamentos-comprovantes', false, 10485760,
        array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do update set public = false;
