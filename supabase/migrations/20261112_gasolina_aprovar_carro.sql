-- Reembolso de gasolina: carro novo precisa ser aprovado pela VP antes de
-- poder ser usado em viagens. Os carros que já existiam quando esta migração
-- rodou entram como aprovados (decisão da VP). Idempotente: o "aprova os
-- atuais" só roda na primeira vez, quando a coluna ainda não existia.
do $$
begin
    if not exists (
        select 1 from information_schema.columns
        where table_name = 'gasolina_veiculos' and column_name = 'aprovado_em'
    ) then
        alter table gasolina_veiculos add column aprovado_em timestamptz;
        alter table gasolina_veiculos add column aprovado_por uuid references colaboradores(id);
        update gasolina_veiculos set aprovado_em = now() where aprovado_em is null;
    end if;
end $$;
