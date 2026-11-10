-- Reembolso de gasolina: a VP pode invalidar o carro de um membro em caso de
-- tentativa de fraude (autonomia/foto do painel adulteradas, km inflados...).
-- Carro invalidado: não serve para lançar viagens, e as viagens pendentes
-- feitas com ele ficam fora das solicitações. A VP pode reativar.
-- Só adiciona colunas (idempotente); nada é apagado.
alter table gasolina_veiculos add column if not exists invalidado_em timestamptz;
alter table gasolina_veiculos add column if not exists invalidado_por uuid references colaboradores(id);
alter table gasolina_veiculos add column if not exists motivo_invalidacao text;
