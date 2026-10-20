# Aplicação da aba Reconhecimentos e Bonificações — passo a passo (banco atual do Supabase)

Decisão: usar o banco atual ("Area do Membro"), sem projeto de homologação.
Regra de trabalho: **uma etapa por vez, com autorização explícita antes de cada ação em produção.** O Supabase conectado à sessão do Claude é somente leitura e não há acesso ao Coolify: tudo abaixo é executado **por você**; o Claude orienta e confere o que você contar (sem credenciais).

| Etapa | O quê | Quem |
|---|---|---|
| 1 | Garantir um backup válido | você |
| 2 | Conferir o que a migration faz (revisão já feita) | Claude (feito) |
| 3 | Aplicar a migration no SQL Editor | você |
| 4 | Configurar `SUPABASE_SERVICE_ROLE_KEY` no Coolify | você |
| 5 | Verificar a conexão aplicação ↔ banco e as permissões | você (com Claude conferindo) |

---

## Etapa 1 — Backup válido
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

## Etapa 2 — O que a migration faz (revisão feita pelo Claude)
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

## Etapa 3 — Aplicar a migration (só após a Etapa 1 e com a sua autorização explícita)

### 3A. Pré-checagem (somente leitura)
SQL Editor → **New query**, um bloco por vez:
```sql
-- (1) função compartilhada existe? esperado: 1 linha
SELECT proname FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND proname = 'update_updated_at_column';

-- (2) as 7 tabelas ainda NÃO existem? esperado: 0 linhas
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN
 ('reconhecimento_tipos','reconhecimento_nucleos','reconhecimentos','regras_bonificacao','bonificacoes','bonificacao_entregas','reconhecimento_historico');

-- (3) papéis do Supabase presentes? esperado: 3 linhas
SELECT rolname FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role');

-- (4) tabelas de apoio existentes? esperado: 2 linhas
SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('projetos','colaboradores');
```
Se algo vier diferente do esperado: **pare** e me avise.

### 3B. Aplicação
1. Copie o conteúdo **inteiro** de `supabase/migrations/20261020_reconhecimentos_bonificacoes.sql` (do PR, branch `claude/eager-bohr-uryun2`; começa em `BEGIN;`, termina em `COMMIT;`).
2. SQL Editor → **New query** → cole → **Run**. Esperado: `Success. No rows returned`.
3. Se houver erro, **nada foi criado** (transação): copie a mensagem e me envie. Se o editor avisar sobre "destructive operations" por causa de `DROP TRIGGER IF EXISTS`, é o alerta padrão (só dos triggers novos).

### 3C. Verificação pós-aplicação
```sql
-- 7 tabelas, RLS ligado, nenhuma policy (esperado: 7 linhas, rls = true, policies = 0)
SELECT c.relname, c.relrowsecurity AS rls,
       (SELECT count(*) FROM pg_policies p WHERE p.schemaname='public' AND p.tablename=c.relname) AS policies
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind='r' AND c.relname IN
 ('reconhecimento_tipos','reconhecimento_nucleos','reconhecimentos','regras_bonificacao','bonificacoes','bonificacao_entregas','reconhecimento_historico')
ORDER BY 1;

-- dados iniciais (esperado: tipos = 7; regras = 0; reconhecimentos = 0; bonificacoes = 0)
SELECT (SELECT count(*) FROM reconhecimento_tipos) AS tipos, (SELECT count(*) FROM regras_bonificacao) AS regras,
       (SELECT count(*) FROM reconhecimentos) AS reconhecimentos, (SELECT count(*) FROM bonificacoes) AS bonificacoes;

-- anon/authenticated sem acesso (esperado: 0 linhas)
SELECT table_name, grantee, privilege_type FROM information_schema.role_table_grants
WHERE table_schema='public' AND grantee IN ('anon','authenticated','PUBLIC') AND table_name IN
 ('reconhecimento_tipos','reconhecimento_nucleos','reconhecimentos','regras_bonificacao','bonificacoes','bonificacao_entregas','reconhecimento_historico');
```
Em **Advisors → Security**, o aviso informativo "RLS enabled, no policy" nessas tabelas é **intencional** (só o servidor acessa).

### 3D. Reversão (só se necessário e com autorização)
Rode `supabase/rollbacks/20261020_reconhecimentos_bonificacoes_ROLLBACK.sql`: apaga **apenas** as 7 tabelas e as 2 funções (e os dados desta aba).

---

## Etapa 4 — `SUPABASE_SERVICE_ROLE_KEY` no Coolify
A chave de serviço **ignora RLS**: nunca no navegador, nunca em `NEXT_PUBLIC_*`, nunca no repositório/chat/logs/prints; só em **tempo de execução** do servidor.

1. Supabase → **Project Settings → API Keys**. Preferível: criar uma **chave secreta nova** (`sb_secret_…`) só para este app (revogável isoladamente). Alternativa: `service_role` legacy (não rotacione o JWT secret: derruba a chave anon e o app).
2. Coolify → aplicação do portal → **Environment Variables → Add**: nome `SUPABASE_SERVICE_ROLE_KEY`, valor a chave, marcado **somente runtime** (desmarque a opção de build) e como secreta/oculta.
3. Confirme que `NEXT_PUBLIC_SUPABASE_URL` é do **mesmo** projeto (`jskzxtpabmwvmgnuhbjf`).
4. **Previews de PR**: sem banco de homologação, o preview usa o **mesmo banco de produção**; prefira uma chave secreta **separada** para o preview.
5. **Redeploy** (variável de runtime só vale após reiniciar). Em produção a chave só será usada quando o código da aba for publicado; até lá fica sem uso.
6. Se a chave vazar: **revogue na hora** e gere outra.

---

## Etapa 5 — Verificar conexão e permissões (no preview do PR)
1. Logs do Coolify sem erro de inicialização e sem "Configuração do servidor pendente".
2. Como **VP**: o menu mostra **Vice Presidência → Reconhecimentos e Bonificações**; a aba abre sem faixa de erro; **Configurações** lista os 7 tipos e "Nenhuma regra cadastrada".
3. Console (F12), logado como VP — não expõe chaves:
   ```js
   fetch('/api/reconhecimentos').then(r => r.json()).then(d => ({ tipos: d.tipos?.length, regras: d.regras?.length, erro: d.error }))
   // esperado: { tipos: 7, regras: 0, erro: undefined }
   ```
   `erro` "Configuração do servidor pendente" → a variável não chegou ao runtime (Etapa 4/redeploy). `relation … does not exist` → migration não aplicada (Etapa 3).
4. **Barreiras** — usuário **não VP** (inclusive diretor estratégico de outro núcleo e quem tem `paginas_permitidas`): sem item de menu; `/reconhecimentos` volta ao início; `fetch('/api/reconhecimentos').then(r=>r.status)` → **403**. Sem login: `curl -i https://<preview>/api/reconhecimentos` → **401**.
5. **Chave pública sem acesso** (esperado 401/403/vazio), digitando a chave só no terminal:
   ```bash
   read -s -p "anon key: " K; echo
   curl -s -o /dev/null -w "%{http_code}\n" "https://jskzxtpabmwvmgnuhbjf.supabase.co/rest/v1/reconhecimentos?select=id" -H "apikey: $K" -H "Authorization: Bearer $K"; unset K
   ```
6. **Fluxo de validação com usuários reais** (só depois dos itens acima): cadastrar as regras reais em Configurações; registrar uma RG (a sugestão deve ser a próxima da sequência); conferir o cartão no kanban; adicionar colaboradores à bonificação e avançar cada um (solicitada → aprovada → entregue); editar um registro e ver o histórico; testar com um usuário não VP.
