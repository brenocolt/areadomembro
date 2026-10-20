# Integração da aba Reconhecimentos — passo a passo (banco atual do Supabase)

Decisão: usar o banco atual ("Area do Membro"), sem projeto de homologação.
Regra de trabalho: **uma etapa por vez, com autorização explícita antes de cada ação em produção.** Eu (Claude) não executo nada em produção: o Supabase conectado a esta sessão é somente leitura e não há acesso ao Coolify. Tudo abaixo é executado **por você**; eu oriento e confiro os resultados que você me contar (sem credenciais).

Estado verificado (somente leitura): projeto `jskzxtpabmwvmgnuhbjf` (PostgreSQL 17, us-east-2, saudável); organização no plano **Pro**; nenhuma das 6 tabelas existe ainda.

| Etapa | O quê | Quem executa |
|---|---|---|
| 1 | Garantir um backup válido | você |
| 2 | Revisão final da migration | Claude (feito) |
| 3 | Aplicar a migration no SQL Editor | você |
| 4 | Configurar `SUPABASE_SERVICE_ROLE_KEY` no Coolify | você |
| 5 | Verificar a conexão aplicação ↔ banco | você (com Claude conferindo) |

---

## Etapa 1 — Backup válido

**Objetivo:** ter, antes de qualquer alteração, uma cópia **recente** e **comprovadamente legível** do banco. A migration só cria objetos novos, então o backup é um seguro contra imprevistos, não uma etapa da migration.

### 1A. Backup automático do Supabase (plano Pro)
1. Abra o painel do Supabase → projeto **Area do Membro** → **Database → Backups**.
2. Aba **Scheduled backups**: deve haver backups **diários** (retenção de 7 dias no Pro). Confira:
   * existe um backup com data **de hoje ou ontem** e status concluído;
   * (opcional) se o add-on **Point in Time Recovery** estiver ativo, aparece a aba PITR — melhor ainda.
3. **Não clique em "Restore"** — isso substituiria o banco inteiro. Você só precisa ver que o backup existe.
4. Anote: data/hora do último backup. (Não envie prints com dados sensíveis; basta me dizer a data/hora.)

Limite: esse backup cobre o **banco**; arquivos do Storage (anexos) não entram.

### 1B. Backup manual independente (recomendado — leva ~5 min)
Gera um arquivo seu, fora do Supabase, feito **imediatamente antes** da migration.

1. Tenha o PostgreSQL client **versão 17** (o banco é 17): `pg_dump --version`. Se for mais antigo, o `pg_dump` recusa (use `postgresql-client-17`, Postgres.app ou Docker `postgres:17`).
2. No painel: **Connect** (ou Project Settings → Database) → copie a connection string do **Session pooler** (porta 5432). A conexão direta é só IPv6; o pooler funciona em qualquer rede. A senha é a do banco (Project Settings → Database → *Reset database password* se não a tiver — **resetar invalida a senha antiga usada pelo app**; não faça isso sem necessidade).
3. No **seu terminal** (não cole a string no chat, no repositório nem no Coolify):
   ```bash
   read -s -p "Connection string: " DATABASE_URL; echo; export DATABASE_URL
   pg_dump "$DATABASE_URL" --format=custom --schema=public --no-owner \
     --file="area-do-membro-$(date +%Y%m%d-%H%M).dump"
   unset DATABASE_URL
   ```
4. **Valide o arquivo** (um backup que nunca foi lido não é um backup):
   ```bash
   ls -lh area-do-membro-*.dump                       # tamanho > 0 (alguns MB)
   pg_restore --list area-do-membro-*.dump | head -20 # lista o conteúdo sem erro
   pg_restore --list area-do-membro-*.dump | grep -c "TABLE DATA"   # ≈ 64 (nº de tabelas em public hoje)
   ```
5. Guarde o arquivo em local seguro (ele contém dados pessoais e hashes de senha: **não** versionar, **não** enviar por e-mail/chat).

### 1C. Teste de restauração (opcional, o mais forte)
Em uma máquina com Docker: `docker run --rm -d -p 5433:5432 -e POSTGRES_PASSWORD=teste postgres:17` → `pg_restore --no-owner -d "postgresql://postgres:teste@localhost:5433/postgres" arquivo.dump` e conferir contagens (`users` ≈ 49, `colaboradores` ≈ 50, `projetos` ≈ 105 — valores da leitura de 19/10; podem ter mudado). Isso comprova que o backup restaura.

### Critério para avançar à Etapa 3
* [ ] Backup do Supabase de hoje/ontem confirmado **e/ou**
* [ ] Dump manual feito e validado (passo 4)
Me responda com: data/hora do backup do Supabase, e "dump manual validado: sim/não". **Só então** seguimos.

---

## Etapa 2 — Revisão final da migration (feita por Claude)

Arquivo: `supabase/migrations/20261019_reconhecimentos_bonificacoes.sql` (+ rollback em `supabase/rollbacks/`).

**Conclusão: a migration só cria objetos novos; não modifica nada existente.** Comprovado de três formas:

1. **Leitura linha a linha** — todos os comandos: `CREATE TABLE IF NOT EXISTS` (6 tabelas novas), `CREATE UNIQUE INDEX IF NOT EXISTS` (3, nas tabelas novas), `DROP TRIGGER IF EXISTS`/`CREATE TRIGGER` (4, nas tabelas novas), `ALTER TABLE … ENABLE ROW LEVEL SECURITY`/`REVOKE`/`GRANT` (somente nas 6 tabelas), `INSERT` (somente nas tabelas novas: 7 tipos, 6 regras, 1 configuração) e `NOTIFY pgrst`. **Nenhum** `ALTER/DROP/UPDATE/DELETE/TRUNCATE` em objeto preexistente. Um `DO` só **verifica** se a função `update_updated_at_column()` existe e **aborta** (sem criar nada) se não existir.
2. **Auditoria de catálogo em PostgreSQL real (PGlite)**: foto do catálogo antes × depois, num banco com objetos "de produção" (tabela `projetos` com índice, policy, trigger, grants, dados, view e sequence). Resultado: **nada removido nem alterado** em tabelas, colunas, constraints, índices, triggers, policies, funções, grants, dados, papéis e extensões; **todos** os objetos novos pertencem às 6 tabelas (16 relações = 6 tabelas + 10 índices; 4 triggers; 0 policies; 0 funções; 0 linhas novas em tabelas existentes).
3. **Atomicidade**: roda dentro de `BEGIN; … COMMIT;`. Teste com falha forçada no fim da migration: nenhuma tabela ficou criada.

As 6 tabelas: `reconhecimento_tipos`, `regras_bonificacao`, `reconhecimentos`, `bonificacoes`, `bonificacao_eventos`, `bonificacoes_config`. Objetos relacionados: PKs, FKs **entre elas**, CHECKs, 3 índices únicos de procedência, 4 triggers de `updated_at`, RLS ligado sem policies e privilégios revogados de `anon`/`authenticated`.

Única dependência externa (precisa existir): `public.update_updated_at_column()`. Verifique na Etapa 3 (pré-checagem).

---

## Etapa 3 — Aplicar a migration pelo SQL Editor (só após Etapa 1 concluída e sua autorização explícita)

### 3A. Pré-checagem (somente leitura — pode rodar antes de autorizar)
SQL Editor → **New query** → cole **cada bloco** e rode:
```sql
-- (1) a função compartilhada existe? esperado: 1 linha
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname = 'update_updated_at_column';

-- (2) as 6 tabelas ainda NÃO existem? esperado: 0 linhas
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_name IN
 ('reconhecimento_tipos','regras_bonificacao','reconhecimentos','bonificacoes','bonificacao_eventos','bonificacoes_config');

-- (3) papéis do Supabase presentes? esperado: 3 linhas (anon, authenticated, service_role)
SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role');
```
Se (1) vier vazio ou (2)/(3) vierem diferentes do esperado: **pare** e me avise.

### 3B. Aplicação (só com sua autorização)
1. Abra o arquivo `supabase/migrations/20261019_reconhecimentos_bonificacoes.sql` do PR (GitHub → branch `claude/eager-bohr-uryun2`) e copie o conteúdo **inteiro** (começa em `BEGIN;` e termina em `COMMIT;`).
2. SQL Editor → **New query** → cole → confira que é o arquivo todo → **Run**.
3. Esperado: `Success. No rows returned`. Se aparecer erro, **nada foi criado** (transação); copie a mensagem e me envie.
4. Se o SQL Editor avisar sobre "destructive operations" por causa de `DROP TRIGGER IF EXISTS`: o alerta é padrão — os DROPs são só dos triggers **novos** (não existem ainda); confirme.

### 3C. Verificação pós-aplicação
```sql
-- 6 tabelas, todas com RLS ligado e nenhuma policy
SELECT c.relname, c.relrowsecurity AS rls,
       (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname) AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN
 ('reconhecimento_tipos','regras_bonificacao','reconhecimentos','bonificacoes','bonificacao_eventos','bonificacoes_config')
ORDER BY 1;                                   -- esperado: 6 linhas, rls = true, policies = 0

-- dados iniciais
SELECT (SELECT count(*) FROM reconhecimento_tipos) AS tipos,          -- 7
       (SELECT count(*) FROM regras_bonificacao)   AS regras,         -- 6
       (SELECT count(*) FROM bonificacoes_config)  AS config,         -- 1
       (SELECT count(*) FROM reconhecimentos)      AS reconhecimentos,-- 0
       (SELECT count(*) FROM bonificacoes)         AS bonificacoes;   -- 0

-- anon/authenticated sem acesso (esperado: 0 linhas)
SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND grantee IN ('anon','authenticated','PUBLIC')
  AND table_name IN ('reconhecimento_tipos','regras_bonificacao','reconhecimentos','bonificacoes','bonificacao_eventos','bonificacoes_config');
```
Depois: **Database → Tables** mostra as 6 tabelas com "RLS enabled". Em **Advisors → Security**, é esperado um aviso informativo "RLS enabled, no policy" nessas 6 tabelas — é **intencional** (só o servidor acessa, com a service role).

### 3D. Reversão (só se necessário e com autorização)
Cole e rode `supabase/rollbacks/20261019_reconhecimentos_bonificacoes_ROLLBACK.sql` — apaga **apenas** as 6 tabelas (e os dados desta aba). Não afeta mais nada.

---

## Etapa 4 — `SUPABASE_SERVICE_ROLE_KEY` no Coolify (com segurança)

Contexto: a chave de serviço **ignora RLS**: quem a tiver lê e grava todo o banco. Regras: nunca no navegador, nunca em `NEXT_PUBLIC_*`, nunca no repositório/chat/logs/prints, só em **tempo de execução** do servidor.

1. **Gerar/obter a chave** — Supabase → **Project Settings → API Keys**.
   * Preferível (se a aba "Secret keys"/`sb_secret_…` estiver disponível): **crie uma chave secreta nova** só para este app (ex.: nome `areadomembro-servidor`). Vantagem: pode ser **revogada isoladamente**.
   * Alternativa: a `service_role` (legacy JWT). Cuidado: rotacionar o *JWT secret* do projeto invalida **também** a chave anon e derruba o app; evite.
2. **Coolify** → Project → Environment → aplicação do portal → **Environment Variables** → **Add**:
   * Name: `SUPABASE_SERVICE_ROLE_KEY` (exatamente assim)
   * Value: cole a chave
   * Marque **somente runtime** (desmarque "Build Variable"/"Available at Buildtime" — o nome do campo varia conforme a versão do Coolify). Se houver "secret/hidden", marque.
   * Salve. **Não** use o "Developer view" para colar a chave em texto aberto num arquivo compartilhado.
3. Confirme que `NEXT_PUBLIC_SUPABASE_URL` aponta para o **mesmo** projeto (`jskzxtpabmwvmgnuhbjf`) de onde saiu a chave.
4. **Previews de PR**: a aba *Preview Deployments* do Coolify pode ter variáveis próprias. Como não haverá banco de homologação, o preview usará **o mesmo banco de produção** — então use a mesma chave (ou, melhor, uma chave secreta **separada** para o preview, revogável sem afetar produção).
5. **Redeploy** (variáveis de runtime só valem após reiniciar). Observação: o **app de produção** só passa a usar a chave quando o código da aba for mergeado/publicado; até lá a variável fica sem uso (inofensiva). A verificação (Etapa 5) usa o **preview do PR**.
6. Se a chave vazar (print, log, chat): **revogue na hora** em API Keys e gere outra.

---

## Etapa 5 — Verificar que a aplicação está conectada ao banco

Usando o **preview do PR** (`https://77.areadomembro.produtivajunior.com.br`), com a Etapa 3 e a 4 concluídas e o preview reimplantado:

1. **Coolify → logs da aplicação**: sem erros de inicialização; sem a mensagem "Configuração do servidor pendente".
2. Entre no preview com um usuário **VP** → menu mostra o grupo **Vice Presidência → Reconhecimentos e Bonificações** → abra a aba:
   * **sem faixa vermelha**;
   * **Configurações** lista 7 tipos e 6 regras (isso prova leitura no banco com a service role).
3. Prova pelo console (F12 → Console), logado como VP — não expõe nenhuma chave:
   ```js
   fetch('/api/reconhecimentos').then(r => r.json()).then(d => ({ tipos: d.tipos?.length, regras: d.regras?.length, config: !!d.config, erro: d.error }))
   // esperado: { tipos: 7, regras: 6, config: true, erro: undefined }
   ```
   * `erro` contendo "Configuração do servidor pendente" → a variável não chegou ao runtime (Etapa 4 / redeploy).
   * `erro` contendo "relation … does not exist" → a migration não foi aplicada neste banco (Etapa 3).
4. **Escrita** (opcional, deixa um registro de teste): registre um reconhecimento de teste e depois exclua-o; confira no SQL Editor `SELECT count(*) FROM reconhecimentos;`.
5. **Barreiras** — com um usuário **não VP**: item de menu ausente; `/reconhecimentos` volta para o início; no console `fetch('/api/reconhecimentos').then(r=>r.status)` → **403**. Sem login: `curl -i https://<preview>/api/reconhecimentos` → **401**.
6. **Chaves públicas sem acesso** (esperado 401/403 — RLS + sem GRANT). No terminal, sem colar a chave em histórico:
   ```bash
   read -s -p "anon key: " K; echo
   curl -s -o /dev/null -w "%{http_code}\n" "https://jskzxtpabmwvmgnuhbjf.supabase.co/rest/v1/reconhecimentos?select=id" -H "apikey: $K" -H "Authorization: Bearer $K"; unset K
   ```
7. Depois: validar com usuários reais (roteiro da seção 7 de `ETAPA-3-GUIA.md`).
