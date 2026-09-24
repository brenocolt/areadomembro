-- Módulo "Reuniões — Presença por QR code": o organizador agenda uma
-- reunião com horário de início, limite de chegada e encerramento, e
-- apresenta um QR code na sala. O membro lê o QR pela área do membro até o
-- limite de chegada (presente); depois do limite, só consegue confirmar
-- digitando o código exibido na tela do organizador (atrasado — gera
-- pré-pontuação na hora); quem não confirmar até o encerramento vira falta
-- (pré-pontuação gerada automaticamente). Pré-pontuações caem na aba
-- "Usuários Pré Pontuados" da Gestão de Pontos para confirmar ou revogar.
--
-- O token do QR e o código de atraso NÃO ficam no banco: são derivados no
-- servidor por HMAC com AUTH_SECRET (ver src/lib/reunioes.ts), para não
-- vazarem por uma leitura da tabela com a chave anon.

create table if not exists reunioes (
    id uuid primary key default gen_random_uuid(),
    titulo text not null,
    descricao text,
    local text,
    inicio timestamptz not null,
    limite_chegada timestamptz not null,
    encerramento timestamptz not null,
    status text not null default 'agendada'
        check (status in ('agendada','cancelada')),
    criado_por uuid null references colaboradores(id),
    -- Preenchido quando as faltas foram geradas (idempotência do job que
    -- roda depois do encerramento).
    faltas_processadas_em timestamptz null,
    criado_em timestamptz not null default now(),
    check (inicio <= limite_chegada and limite_chegada < encerramento)
);

create index if not exists idx_reunioes_inicio on reunioes(inicio);

-- Quem é esperado na reunião — lista fixada na criação.
create table if not exists reuniao_participantes (
    reuniao_id uuid not null references reunioes(id) on delete cascade,
    colaborador_id uuid not null references colaboradores(id) on delete cascade,
    primary key (reuniao_id, colaborador_id)
);

create index if not exists idx_reuniao_participantes_colaborador on reuniao_participantes(colaborador_id);

-- Confirmações de presença (uma por membro por reunião).
create table if not exists reuniao_presencas (
    reuniao_id uuid not null references reunioes(id) on delete cascade,
    colaborador_id uuid not null references colaboradores(id) on delete cascade,
    situacao text not null check (situacao in ('presente','atrasado')),
    metodo text not null check (metodo in ('qr','codigo','manual')),
    registrado_em timestamptz not null default now(),
    primary key (reuniao_id, colaborador_id)
);

-- Vínculo da pré-pontuação com a reunião que a originou (análogo a
-- formulario_id).
alter table pontos_pre_pontuacao add column if not exists reuniao_id uuid null references reunioes(id) on delete set null;
