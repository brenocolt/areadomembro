-- Fecha o acesso do anon (chave pública do navegador) às tabelas sensíveis.
--
-- ATENÇÃO — ordem de aplicação:
--   1. Definir SUPABASE_SERVICE_ROLE_KEY no ambiente do servidor (ver src/lib/supabase-server.ts).
--   2. Publicar esta versão do app.
--   3. Só então aplicar esta migração. Sem o passo 1, login e ações de admin deixam de funcionar.
--
-- Escopo: só a tabela que o navegador NÃO consulta direto.
--   users -> hash de senha e role; lida apenas por código de servidor.
-- As demais tabelas continuam abertas ao anon porque telas do navegador ainda
-- leem/escrevem nelas direto; fechar exige antes mover essas chamadas para o servidor.

-- users: nenhuma política para anon/authenticated => RLS nega tudo. service_role ignora RLS.
DROP POLICY IF EXISTS allow_anon_select ON users;
DROP POLICY IF EXISTS allow_anon_insert ON users;
DROP POLICY IF EXISTS allow_anon_update ON users;
REVOKE ALL ON users FROM anon, authenticated;

-- Pendências (fora desta migração): solicitacoes_conta (senha em texto) e as demais
-- tabelas ainda são lidas/escritas pelo navegador via anon (ex.: users-management/
-- account-requests.tsx). Mova essas chamadas para o servidor e feche-as depois.
