# Colocando a aba Reconhecimentos e Bonificações em funcionamento — projeto Supabase único

**Regra deste processo:** um único projeto Supabase (o atual, "Area do Membro"), **nenhum projeto, banco, ambiente ou preview novo**. Só se usa o que já existe: **SQL Editor do Supabase**, **Coolify** e o **Claude** (código, testes e conferência em modo leitura). Nada é executado em produção sem a sua autorização explícita, fase por fase.

## Por que dá para fazer com segurança no mesmo banco
1. A migration é **aditiva**: cria 7 tabelas novas que nenhuma tela atual lê. Aplicá-la não muda o comportamento de nada que existe. Não há chaves estrangeiras para tabelas existentes, então nem bloqueia tabelas em uso.
2. Antes de gravar qualquer coisa, existe um **DRY-RUN** (`supabase/dry-run/20261020_reconhecimentos_DRY_RUN.sql`): aplica a migration e roda 33 verificações **no banco real** dentro de um único comando que se desfaz sozinho. **Nada fica gravado.** Verifica que nada preexistente mudou, que `anon`/`authenticated` não leem nem gravam as tabelas novas (mesmo com os privilégios padrão do Supabase), que RG repetida/pessoa duplicada/datas impossíveis são barradas e que o histórico é automático e imutável.
3. O histórico da aba é imutável por desenho — então testes feitos em produção ficariam para sempre. Por isso existe a **limpeza controlada** (`supabase/rollbacks/20261020_reconhecimentos_LIMPAR_DADOS_DE_TESTE.sql`): zera **só** os dados criados na aba (não toca em nenhuma tabela existente), em dois passos (simulação → confirmação). Você valida com registros marcados `[TESTE]` e limpa antes do uso real.
4. A aba só é visível e acessível para **ADMIN e Vice Presidência**. Quem não tem acesso nunca vê dados nem o menu; a API devolve 401/403.
5. O **preview do PR** que o Coolify cria sozinho usa o mesmo banco; **você não precisa usá-lo**. O código sobe para produção direto pelo fluxo normal (merge → deploy do Coolify).

## Visão geral das fases
| Fase | O quê | Quem | Reversão |
|---|---|---|---|
| 1 | Backup válido | você | — |
| 2 | Pré-checagem + **DRY-RUN** (nada grava) | você roda; Claude confere o relatório | nada a reverter |
| 3 | Aplicar a migration | você | script de rollback (apaga só as 7 tabelas novas) |
| 4 | `SUPABASE_SERVICE_ROLE_KEY` no Coolify | você | remover a variável |
| 5 | Publicar o código (merge do PR → deploy do Coolify) | você autoriza; Claude faz o merge se você pedir | Coolify → Rollback para o deploy anterior |
| 6 | Validar em produção com registros `[TESTE]` (VP e não-VP) | você; Claude confere em modo leitura | fase 7 |
| 7 | Limpar os dados de teste | você | — (é a própria limpeza) |
| 8 | Cadastrar as regras reais e liberar o uso | você | desativar regras |

Ordem pensada para o risco: as fases 2–4 não mudam nada do que os usuários veem; só a fase 5 coloca a aba no ar, e ela já encontra as tabelas e a chave prontas.

## Fase 1 — Backup válido
A migration só **cria** objetos novos; o backup é um seguro contra imprevistos.

**1A. Backup automático (plano Pro):** painel → projeto *Area do Membro* → **Database → Backups → Scheduled backups**: confirme um backup de **hoje ou ontem**, concluído. **Não clique em Restore.** Anote data/hora.

**1B. Backup manual (recomendado, ~5 min):** com `pg_dump` versão 17, usando a connection string do *Session pooler* (porta 5432) — digitada só no seu terminal, nunca no chat/repositório/Coolify:
```bash
read -s -p "Connection string: " DATABASE_URL; echo; export DATABASE_URL
pg_dump "$DATABASE_URL" --format=custom --schema=public --no-owner --file="area-do-membro-$(date +%Y%m%d-%H%M).dump"
unset DATABASE_URL
ls -lh area-do-membro-*.dump                     # tamanho > 0
pg_restore --list area-do-membro-*.dump | head   # lista sem erro
```
Guarde o arquivo em local seguro (tem dados pessoais): **não** versionar, **não** enviar por e-mail/chat.

**Para avançar:** me diga a data/hora do backup do Supabase e "dump manual validado: sim/não".

---

---

## O que a migration faz (revisão feita pelo Claude)
Arquivo: `supabase/migrations/20261020_reconhecimentos_bonificacoes.sql` · reversão: `supabase/rollbacks/20261020_reconhecimentos_bonificacoes_ROLLBACK.sql`.

**Só cria objetos novos; não altera nada existente:**
* **7 tabelas novas**: `reconhecimento_tipos`, `reconhecimento_nucleos`, `reconhecimentos`, `regras_bonificacao`, `bonificacoes`, `bonificacao_entregas`, `reconhecimento_historico`;
* índices (únicos e de consulta) nessas tabelas; **2 funções** (`rec_registrar_historico`, `rec_historico_imutavel`) e os *triggers* delas (histórico e `updated_at`) **somente nas 7 tabelas**;
* RLS ligado **sem policies** e `REVOKE` de `PUBLIC/anon/authenticated`, `GRANT` só para `service_role` — somente nessas tabelas;
* dados iniciais: **apenas os 7 tipos de reconhecimento** (nenhuma regra, nenhum valor, nenhum núcleo, nenhum reconhecimento);
* **sem chaves estrangeiras para tabelas existentes** (nem para `projetos`/`colaboradores`: guardam o id e uma cópia do nome);
* roda dentro de `BEGIN; … COMMIT;` — se qualquer comando falhar, **nada** fica criado. Um bloco `DO` só **verifica** que `update_updated_at_column()` existe e aborta se não existir.

Comprovado em PostgreSQL real (PGlite) por `npm run test:reconhecimentos`: auditoria de catálogo antes × depois (nada preexistente removido ou alterado), atomicidade com falha forçada, rollback que remove tudo e RLS (chave pública não lê nem grava).

---

---

## Fase 2 — Pré-checagem e DRY-RUN (nada é gravado)

### 2A. Pré-checagem (somente leitura)
SQL Editor → **New query**, um bloco por vez:
```sql
-- (1) função compartilhada existe? esperado: 1 linha
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname = 'update_updated_at_column';

-- (2) nada com os nomes novos existe? esperado: 0 linhas
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN
 ('reconhecimento_tipos','reconhecimento_nucleos','reconhecimentos','regras_bonificacao','bonificacoes','bonificacao_entregas','reconhecimento_historico');
SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace AND proname IN ('rec_registrar_historico','rec_historico_imutavel');

-- (3) papéis do Supabase presentes? esperado: 3 linhas
SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role');
```
(Em 19–20/10 o Claude já conferiu em modo leitura: nenhuma das 7 tabelas existe e `update_updated_at_column` existe.)

### 2B. DRY-RUN
1. Abra `supabase/dry-run/20261020_reconhecimentos_DRY_RUN.sql` (PR → branch `claude/eager-bohr-uryun2`), copie **tudo**, cole numa nova query e **Run**.
2. **O SQL Editor vai mostrar um ERRO em vermelho — é o esperado**: o relatório vem na mensagem de erro e o comando inteiro é desfeito pelo banco.
3. Leia a última linha: `RESULTADO: TODAS AS 33 VERIFICAÇÕES PASSARAM.` → siga. Qualquer linha `FALHA` → **pare** e cole o texto inteiro para o Claude.
4. Conferência: rodar de novo a pré-checagem (2) mostra **0 linhas** (nada foi criado) — e, se quiser, o Claude confirma pelo Supabase em modo leitura.

---

## Fase 3 — Aplicar a migration (só após a fase 1 e com a sua autorização explícita)
1. Copie o conteúdo **inteiro** de `supabase/migrations/20261020_reconhecimentos_bonificacoes.sql` (começa em `BEGIN;`, termina em `COMMIT;`), cole numa nova query e **Run**. Esperado: `Success. No rows returned`.
2. Se houver erro, nada foi criado (transação): copie a mensagem para o Claude. O aviso "destructive operations" por causa de `DROP TRIGGER IF EXISTS` é o alerta padrão (só dos triggers novos).
3. **Verificação sem você escrever SQL:** avise o Claude. Ele confere em modo leitura pelo Supabase conectado à sessão (tabelas, RLS ligado, nº de linhas e o Security Advisor). O Advisor passará a mostrar o aviso informativo "RLS enabled, no policy" nas 7 tabelas (**intencional**).
   Ou rode você: 
```sql
SELECT c.relname, c.relrowsecurity AS rls,
       (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname) AS policies
FROM pg_class c WHERE c.relnamespace='public'::regnamespace AND c.relkind='r' AND c.relname IN
 ('reconhecimento_tipos','reconhecimento_nucleos','reconhecimentos','regras_bonificacao','bonificacoes','bonificacao_entregas','reconhecimento_historico')
ORDER BY 1;   -- 7 linhas, rls = true, policies = 0
SELECT (SELECT count(*) FROM reconhecimento_tipos) AS tipos, (SELECT count(*) FROM regras_bonificacao) AS regras,
       (SELECT count(*) FROM reconhecimentos) AS reconhecimentos;   -- 7, 0, 0
```
4. Reversão (só se necessário): `supabase/rollbacks/20261020_reconhecimentos_bonificacoes_ROLLBACK.sql` apaga **apenas** as 7 tabelas e as 2 funções.

---

## Fase 4 — `SUPABASE_SERVICE_ROLE_KEY` no Coolify
A chave de serviço **ignora RLS**: nunca no navegador, nunca em `NEXT_PUBLIC_*`, nunca no repositório/chat/logs/prints; só em **tempo de execução** do servidor.
1. Supabase → **Project Settings → API Keys**. Preferível: criar uma **chave secreta nova** (`sb_secret_…`) só para este app (revogável isoladamente). Evite rotacionar o JWT secret (derruba a chave anon e o app).
2. Coolify → aplicação do portal (a de produção) → **Environment Variables → Add**: nome `SUPABASE_SERVICE_ROLE_KEY`, valor a chave, **somente runtime** (desmarque a opção de build), como secreta/oculta. Não altere nenhuma variável existente.
3. Confirme que `NEXT_PUBLIC_SUPABASE_URL` é do projeto `jskzxtpabmwvmgnuhbjf` (é o único).
4. Não precisa reiniciar agora: o código atual de produção não usa a variável. Ela passa a valer no deploy da fase 5.
5. Se a chave vazar: **revogue na hora** e gere outra.

## Fase 5 — Publicar o código (merge do PR #77)
Pré-requisitos: fases 2–4 concluídas e a sua autorização. O Claude confirma antes que os testes e o build do PR continuam verdes.
1. Merge do PR #77 em `main` (você, ou o Claude se você pedir). O Coolify faz o deploy de produção pelo fluxo normal; acompanhe em **Deployments** (build sem erro).
2. Se a produção não faz deploy automático, use **Deploy** manualmente.
3. Comportamento esperado logo após o deploy: **nada muda** para quem não é ADMIN/VP; para VP/ADMIN surge o grupo "Vice Presidência → Reconhecimentos e Bonificações".
4. **Reversão do código:** Coolify → aplicação → Deployments → **Rollback** para o deploy anterior (ou `git revert` do merge). As tabelas novas podem ficar: nenhuma tela antiga as usa.

## Fase 6 — Validar em produção (com dados `[TESTE]`)
Só ADMIN/VP veem a aba, então o impacto é mínimo. Use sempre o texto `[TESTE]` nas observações e nos nomes de regra.
1. **Não-VP** (ex.: estratégico de outro núcleo e quem tem `paginas_permitidas`): sem item de menu; `/reconhecimentos` volta ao início; no console `fetch('/api/reconhecimentos').then(r=>r.status)` → **403**; sem login → **401**.
2. **VP/ADMIN**: abra a aba; `fetch('/api/reconhecimentos').then(r=>r.json()).then(d=>({tipos:d.tipos?.length, regras:d.regras?.length, erro:d.error}))` → `{tipos: 7, regras: 0}`. `erro` "Configuração do servidor pendente" → fase 4/redeploy; "relation … does not exist" → fase 3.
3. **Fluxo** (roteiro do e2e, com dados de teste): criar uma regra `[TESTE]` (ex.: RG a partir da 5ª, premiação "teste"); registrar uma RG em um projeto de teste (a sugestão deve ser a próxima da sequência; um número repetido deve ser recusado); conferir o cartão no kanban; adicionar 2 colaboradores à bonificação e avançar cada um (solicitada → aprovada → entregue) — o cartão só vira "Entregue" com "Concluir"; editar a RG e ver o "de → para" no histórico.
4. O Claude confere em modo leitura (contagens, RLS e Advisor) e o relatório do que foi criado.
5. **Chave pública sem acesso** (digite a chave só no terminal): `curl -s -o /dev/null -w "%{http_code}\n" "https://jskzxtpabmwvmgnuhbjf.supabase.co/rest/v1/reconhecimentos?select=id" -H "apikey: $K" -H "Authorization: Bearer $K"` → 401/403.

## Fase 7 — Limpar os dados de teste (antes do uso real)
1. Abra `supabase/rollbacks/20261020_reconhecimentos_LIMPAR_DADOS_DE_TESTE.sql`, cole e **Run** como está: **simulação** — dá erro em vermelho dizendo quantos registros seriam apagados e **quem os criou**. Confira que são só os de teste.
2. Troque `confirmar constant boolean := false` por `true` e rode de novo (tudo ou nada). Mantém os 7 tipos; zera reconhecimentos, bonificações, entregas, regras e histórico; **não toca em nenhuma tabela existente**; religa o bloqueio do histórico.
3. **Nunca rode depois que o uso real começar.**

## Fase 8 — Uso real
Cadastre as regras e valores reais em **Configurações** (nada vem pronto). A partir daí, registros e histórico são permanentes.

