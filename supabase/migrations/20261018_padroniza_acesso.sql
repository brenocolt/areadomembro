-- Padronização de acesso (ver src/lib/access-control.ts):
--   1. Garante que só produtivajunior@gmail.com tem o papel ADMIN.
--   2. Remove RH e GESTOR do enum role_type — nunca usados por nenhuma
--      lógica do sistema, só COLABORADOR/ADMIN existem de verdade.

UPDATE users
SET role = 'COLABORADOR'
WHERE role = 'ADMIN' AND email <> 'produtivajunior@gmail.com';

DO $$
BEGIN
    -- Qualquer linha legada com RH/GESTOR vira COLABORADOR antes de trocar
    -- o tipo da coluna (não deveria existir nenhuma, mas por segurança).
    UPDATE users SET role = 'COLABORADOR' WHERE role IN ('RH', 'GESTOR');

    ALTER TYPE role_type RENAME TO role_type_old;
    CREATE TYPE role_type AS ENUM ('ADMIN', 'COLABORADOR');

    ALTER TABLE users ALTER COLUMN role DROP DEFAULT;
    ALTER TABLE users ALTER COLUMN role TYPE role_type USING role::text::role_type;
    ALTER TABLE users ALTER COLUMN role SET DEFAULT 'COLABORADOR';

    DROP TYPE role_type_old;
END $$;
