-- Listas editáveis do formulário "Solicitar Pagamento ou Reembolso" e campo
-- Projeto (Consultorias/Assessorias). Só cria coisas novas / acrescenta uma
-- coluna na tabela do próprio formulário (20261113); não altera outras
-- funcionalidades. Pode rodar mais de uma vez.
--
-- Mesma segurança de 20261113: RLS ligado e nenhuma política — só o
-- servidor do portal (service_role) lê e grava. Quem edita (VP e
-- administradores) é decidido em /api/pagamentos/opcoes.

-- Projeto escolhido quando o centro de custo é Consultorias/Assessorias.
alter table pagamentos_solicitacoes add column if not exists projeto text;

-- Uma linha por opção. lista:
--   'projeto'                 -> projetos (consultorias/assessorias)
--   'evento_mej'              -> pergunta "Evento MEJ"
--   'categoria:<centro>'      -> categorias de um centro de custo
-- "Excluir" = ativo=false (some do formulário, mas o histórico continua).
create table if not exists pagamentos_opcoes (
    id uuid primary key default gen_random_uuid(),
    lista text not null,
    valor text not null check (length(btrim(valor)) between 1 and 120),
    ordem int not null default 0,
    ativo boolean not null default true,
    atualizado_por uuid references colaboradores(id) on delete set null,
    criado_em timestamptz not null default now(),
    atualizado_em timestamptz not null default now(),
    unique (lista, valor)
);
create index if not exists idx_pag_opcoes_lista on pagamentos_opcoes(lista, ordem);

alter table pagamentos_opcoes enable row level security;
-- (sem "create policy" de propósito)

-- Carga inicial: listas da planilha "VP Categorias" (as mesmas do código).
insert into pagamentos_opcoes (lista, valor, ordem) values
    ('categoria:Consultorias/Assessorias', 'Gasolina', 1),
    ('categoria:Consultorias/Assessorias', 'Uber', 2),
    ('categoria:Consultorias/Assessorias', 'Estacionamento', 3),
    ('categoria:Consultorias/Assessorias', 'Jantar de Finalização', 4),
    ('categoria:Consultorias/Assessorias', 'Material para projetos', 5),
    ('categoria:Consultorias/Assessorias', 'Manual de finalização para consultoria', 6),
    ('categoria:Consultorias/Assessorias', 'Hospedagem Projetos', 7),
    ('categoria:Consultorias/Assessorias', 'Placa de finalização', 8),
    ('categoria:Consultorias/Assessorias', 'Mimo de finalização', 9),
    ('categoria:Consultorias/Assessorias', 'Engajamento com o cliente', 10),
    ('categoria:Consultorias/Assessorias', 'Tercerizada para projetos', 11),
    ('categoria:Consultorias/Assessorias', 'Aluguel de sala', 12),
    ('categoria:Consultorias/Assessorias', 'Cliente oculto', 13),
    ('categoria:Consultorias/Assessorias', 'Estorno de projeto', 14),
    ('categoria:Diretoria Executiva', 'Cogestão', 1),
    ('categoria:Diretoria Executiva', 'Conquistas e planos', 2),
    ('categoria:Diretoria Executiva', 'Engajamento empresa', 3),
    ('categoria:Diretoria Executiva', 'Relacionamento com Departamento', 4),
    ('categoria:Diretoria Executiva', 'PlaneJa', 5),
    ('categoria:Diretoria Executiva', 'Apresentação de case', 6),
    ('categoria:Diretoria Executiva', 'Consultoria para Empresa', 7),
    ('categoria:Eventos MEJ', 'Alimentação', 1),
    ('categoria:Eventos MEJ', 'Hospedagem', 2),
    ('categoria:Eventos MEJ', 'Ingresso', 3),
    ('categoria:Eventos MEJ', 'Passagem', 4),
    ('categoria:Eventos MEJ', 'Transporte', 5),
    ('categoria:GP', 'Endomarketing', 1),
    ('categoria:GP', 'PDI', 2),
    ('categoria:GP', 'Conexão', 3),
    ('categoria:GP', 'Voa PJ', 4),
    ('categoria:GP', 'Turbinar', 5),
    ('categoria:GP', 'Descubra', 6),
    ('categoria:GP', 'Workday', 7),
    ('categoria:GP', 'Kit Piloto', 8),
    ('categoria:GP', 'PTPJ', 9),
    ('categoria:GP', 'Take Off', 10),
    ('categoria:GP', 'Engajamento empresa', 11),
    ('categoria:GP', 'Desligamento', 12),
    ('categoria:GP', 'Aniversário da PJ', 13),
    ('categoria:GP', 'Engajamento GP', 14),
    ('categoria:Marketing', 'Compra de listas', 1),
    ('categoria:Marketing', 'Tráfego pago', 2),
    ('categoria:Marketing', 'Marketing e Publicidade', 3),
    ('categoria:Marketing', 'Terceirizada para marketing', 4),
    ('categoria:Marketing', 'Site', 5),
    ('categoria:Marketing', 'Workday e workweek', 6),
    ('categoria:Marketing', 'Engajamento marketing', 7),
    ('categoria:Marketing', 'Telefone e internet', 8),
    ('categoria:Marketing', 'Prospecção', 9),
    ('categoria:Marketing', 'Container', 10),
    ('categoria:Marketing', 'Plano de Indicação', 11),
    ('categoria:Marketing', 'Softwares e sistemas marketing', 12),
    ('categoria:Presidência', 'Despesas com LIDE', 1),
    ('categoria:Presidência', 'CDL', 2),
    ('categoria:Presidência', 'RN Júnior', 3),
    ('categoria:Presidência', 'Despesas com parcerias', 4),
    ('categoria:Presidência', 'Workday', 5),
    ('categoria:Presidência', 'Eventos de parceiros', 6),
    ('categoria:Presidência', 'Viagens e representações', 7),
    ('categoria:Presidência', 'Visita Técnica', 8),
    ('categoria:Presidência', 'Eventos para parceiros', 9),
    ('categoria:Presidência', 'Engajamento Presi', 10),
    ('categoria:Presidência', 'Feira de Carreiras/Workshop', 11),
    ('categoria:Presidência', 'Fórum de Negócios', 12),
    ('categoria:Presidência', 'Altitude Experience', 13),
    ('categoria:Presidência', 'Open House', 14),
    ('categoria:Presidência', 'PJ nas escolas', 15),
    ('categoria:Presidência', 'GO!RN', 16),
    ('categoria:Projetos', 'Workday', 1),
    ('categoria:Projetos', 'Engajamento projetos', 2),
    ('categoria:Projetos', 'Reconhecimento consultores', 3),
    ('categoria:Projetos', 'Capacitações', 4),
    ('categoria:Projetos', 'Números Virtuais', 5),
    ('categoria:VP', 'Taxa de boletos', 1),
    ('categoria:VP', 'Taxa de cartão', 2),
    ('categoria:VP', 'Taxa Pix', 3),
    ('categoria:VP', 'Assessoria financeira', 4),
    ('categoria:VP', 'Assessoria Jurídica', 5),
    ('categoria:VP', 'Contabilidade', 6),
    ('categoria:VP', 'Auxílio-alimentação', 7),
    ('categoria:VP', 'Cartão corporativo', 8),
    ('categoria:VP', 'PIPJ', 9),
    ('categoria:VP', 'Softwares e sistemas', 10),
    ('categoria:VP', 'Engajamento VP', 11),
    ('categoria:VP', 'Material de escritório', 12),
    ('categoria:VP', 'Manutenção', 13),
    ('categoria:VP', 'Workday', 14),
    ('evento_mej', 'ENEJ', 1),
    ('evento_mej', 'Destine', 2),
    ('evento_mej', 'EDL', 3),
    ('evento_mej', 'Pulso', 4),
    ('evento_mej', 'Portto', 5),
    ('evento_mej', 'Onda verde', 6),
    ('evento_mej', 'Prêmio RN', 7),
    ('evento_mej', 'EAI', 8),
    ('evento_mej', 'EPEEJ', 9)

on conflict (lista, valor) do nothing;

-- Projetos: começa com os projetos ATIVOS do portal (tabela projetos,
-- sincronizada do Monday). Só lê a tabela projetos; a VP ajusta a lista depois.
do $$
begin
    if exists (select 1 from information_schema.columns
               where table_schema = 'public' and table_name = 'projetos' and column_name = 'status') then
        insert into pagamentos_opcoes (lista, valor, ordem)
        select 'projeto', btrim(nome), row_number() over (order by btrim(nome))
        from projetos
        where status = 'Ativo' and length(btrim(nome)) between 1 and 120
        on conflict (lista, valor) do nothing;
    end if;
end $$;
