# Etapa 3 — Banco, homologação e publicação (guia)

**Nada aqui foi executado em produção.** O servidor MCP do Supabase disponível nesta sessão é **somente leitura** (lista projetos, tabelas e migrations; não tem `apply_migration` nem `execute_sql`), então eu **não consigo** aplicar SQL em nenhum banco. Não há acesso ao Coolify.

## 1. O que eu verifiquei (somente leitura) no Supabase

| Item | Resultado |
|---|---|
| Projeto do sistema | **"Area do Membro"** (`jskzxtpabmwvmgnuhbjf`, us-east-2, PostgreSQL 17, saudável) — é onde estão `users`, `colaboradores`, `projetos` (105 linhas) etc. |
| Outros projetos na organização | `acompanhamentoarena` e `chamarotas`. **Não toquei** neles. Não sei se algum é o banco do sistema antigo; para rodar V-1…V-3 você precisa me indicar/rodar. |
| Ambiente de homologação | **Não existe**: nenhum branch do Supabase (`list_branches` vazio) e nenhum projeto com cara de staging. |
| Conflito de nomes | **Nenhum**: as 6 tabelas novas não existem em `public`. |
| `projetos` / `colaboradores` | Existem e têm as colunas de que a aba depende (já usadas por outras telas: `projetos.status`, `colaboradores.nucleo_atual`/`status`). |
| Histórico de migrations do Supabase | Termina em `20260923…`. As migrations do repositório posteriores (PDI bancos/repasses, solicitações de pontuação…) já estão no banco **sem** registro nesse histórico → o time aplica SQL **manualmente** (SQL Editor). Esta migration também deve ser aplicada assim. |
| Backups | **Não consigo ver** (o MCP não expõe). Veja o item 2. |
| Alerta pré-existente (fora do escopo) | 10 tabelas **sem RLS** em `public` (`solicitacoes_conta`, `pdi_planos`, `pdi_tarefas`, `membros_pre_cadastro`, `ausencias`, `configuracoes`, `flags`, `reunioes`, `reuniao_participantes`, `reuniao_presencas`): qualquer pessoa com a chave anon lê/escreve. **Não alterei nada.** Vale tratar em outra frente. |

## 2. Backup antes da migration — o que depende de você

No painel: **Supabase → projeto "Area do Membro" → Database → Backups.**

* Plano **Pro** (ou superior): backups diários automáticos (restauração em "Scheduled backups"); PITR só se o add-on estiver ligado. Confirme que existe um backup de **hoje**.
* Plano **Free**: **não há backup automático**. Gere um manual antes (`pg_dump`, abaixo) — ou use *Database → Backups → Download* se o plano permitir.
* Backup manual (na sua máquina, com a connection string de **Settings → Database**; **não** cole a senha em lugar nenhum do repositório nem no chat):
  ```bash
  pg_dump "$DATABASE_URL" --format=custom --no-owner --file=area-do-membro-antes-reconhecimentos.dump
  ```

## 3. Impactos da migration (`20261019_reconhecimentos_bonificacoes.sql`)

* **Somente `CREATE`** de objetos novos: 6 tabelas, 3 índices únicos, 4 triggers, RLS/REVOKE/GRANT **nas tabelas novas**. Não altera tabela, coluna, policy, trigger ou dado existente. Não depende de nenhuma tabela existente (nem FK para `projetos`/`colaboradores`).
* **Bloqueios/tempo**: nenhum lock em tabela existente; execução em milissegundos. Sem reescrita de dados.
* **Única dependência**: `public.update_updated_at_column()` (existe desde a migration 001). Se faltasse, a migration a cria com o corpo padrão; se existir, não toca (testado).
* **Idempotente**: pode ser reexecutada; semeia sem duplicar (7 tipos, 6 regras, 1 configuração vazia).
* **Reversão**: `supabase/rollbacks/20261019_reconhecimentos_bonificacoes_ROLLBACK.sql` — `DROP` das 6 tabelas (apaga só os dados desta aba). Testado em PostgreSQL real em memória.
* **Efeito visível**: nenhum para usuários até o código da aba ser publicado e a chave de serviço estar configurada; a aba só abre para VP/ADMIN.
* **Risco residual**: o preview do PR (Coolify) builda esta branch; se ele usa as mesmas variáveis do app de produção, ele aponta para o **mesmo banco** (ver 6).

## 4. Homologação — duas opções (decisão sua)

**A. Projeto Supabase de homologação (recomendado).** Crie um projeto novo (ex.: "Area do Membro — Homologação"; pode ter custo conforme o plano) e:
1. No projeto de produção, gere um dump **só do schema**: `pg_dump "$DATABASE_URL_PROD" --schema-only --no-owner -n public > schema.sql` e aplique no novo (SQL Editor / `psql`). **Não copie dados reais de pessoas**; crie uns poucos usuários/colaboradores de teste (1 VP, 1 Estratégico de outro núcleo, 1 Tático de Marketing, 1 Operacional, 1 desligado, 1 ADMIN) e projetos de exemplo.
2. Aplique a migration `20261019_…sql` nele (SQL Editor).
3. Configure um **ambiente de preview no Coolify** apontando para esse projeto (item 6).
4. Valide (item 7). Só depois decidimos produção.

**B. Aplicar direto em produção** (a migration é aditiva e a aba só aparece após o merge/deploy, então o risco é baixo) e validar com VP no preview. **Só com a sua autorização específica** — ainda não autorizada.

## 5. `SUPABASE_SERVICE_ROLE_KEY` — o que eu consigo e o que depende de você

* **Não consigo verificar** o Coolify (sem acesso) e a variável **não está** no ambiente desta sessão. Também não vou pedir/exibir o valor.
* **Sinal de diagnóstico sem expor a chave**: com um usuário VP/ADMIN, abra a aba; se a variável faltar, aparece uma faixa vermelha *"Configuração do servidor pendente: defina SUPABASE_SERVICE_ROLE_KEY…"* e a API responde **503** (nunca cai para a chave anon).

**Passo a passo (você):**
1. **Obter a chave** — Supabase → *Project Settings → API Keys*: use a chave **secreta/`service_role`** do projeto correto. Ela **ignora RLS**: nunca vai para o navegador, para o repositório, para `NEXT_PUBLIC_*` nem para o chat.
2. **Coolify** → seu *Project* → *Environment* → aplicação do portal → aba **Environment Variables** → **Add**:
   * Name: `SUPABASE_SERVICE_ROLE_KEY`
   * Value: cole a chave (marque como secreto se houver a opção)
   * Escopo: **somente em tempo de execução** (*Runtime*). **Desmarque** "Available at Buildtime" / "Build Variable" — ela não é necessária no build e não deve entrar na imagem.
   * Salve.
3. Para **previews de PR** o Coolify usa variáveis próprias da aba *Preview Deployments* (ou as marcadas para preview): adicione lá a chave **do banco de homologação** (item 6) — **não** reaproveite a de produção.
4. **Redeploy** (variáveis de runtime só valem após reiniciar/reimplantar).
5. Confirme: abra a aba como VP → sem a faixa vermelha e as listas carregam.

As demais variáveis que o app já usa (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `AUTH_SECRET`) continuam como estão.

## 6. Cuidado com o preview apontando para produção

Se o preview do PR herdar as variáveis de produção, ele fala com o **banco de produção**: com a migration aplicada e a chave de serviço presente, o preview **lê e grava dados reais**. Por isso: homologação com **banco e chave próprios** (opção A) ou, na opção B, validar sabendo que os dados são reais (e usando só contas VP de teste/ou de pessoas cientes).

## 7. Roteiro de validação com usuário VP (antes de publicar)

Pré-requisitos: migration aplicada no banco do ambiente testado; `SUPABASE_SERVICE_ROLE_KEY` desse ambiente; usuários de teste.

| # | Usuário | Faça | Esperado |
|---|---|---|---|
| 1 | **VP** (qualquer cargo) | Entrar → menu | Grupo **"Vice Presidência"** com **Reconhecimentos e Bonificações** (fora de "Gestão de Pessoas") |
| 2 | VP | Abrir a aba | 5 sub-abas; sem faixa vermelha; tipos e regras carregados (7 tipos, 6 regras) |
| 3 | VP | Registrar reconhecimento de pessoa (ex.: SDR do Mês) | Bonificação R$ 50,00 criada e visível |
| 4 | VP | Registrar RG de um projeto, "Adiantado" + 3 RGs anteriores | Bonificações R$ 12,00 (2º) e "R$ 30 / McDonald's" (4º) |
| 5 | VP | Núcleo de Impacto → escolher núcleo | **Uma** bonificação "R$ 30 por membro do núcleo" |
| 6 | VP | Marcar entregue (2 nomes) / cancelar ("Outro" sem texto) | Entrega gravada com e-mail do VP; cancelamento exige descrição |
| 7 | VP | Excluir um reconhecimento | Bonificação permanece |
| 8 | **ADMIN** | Mesmo menu e acesso | Acessa |
| 9 | **Estratégico de outro núcleo** | Ver o menu; digitar `/reconhecimentos` | Sem o item; volta para o início |
| 10 | **Tático/Operacional de outro núcleo, inclusive com a página em `paginas_permitidas`** | Idem | Sem acesso |
| 11 | **Colaborador desligado do núcleo VP** | Idem | Sem acesso |
| 12 | Qualquer não-VP logado | No console do navegador: `fetch('/api/reconhecimentos').then(r=>r.status)` | **403** |
| 13 | Sem login | `curl -i https://<app>/api/reconhecimentos` | **401** |
| 14 | Console de rede (VP) | Ver requisições da aba | Nenhuma chamada direta ao Supabase para as tabelas da aba (só `/api/reconhecimentos/*`) |
| 15 | Anon key | Com a chave anon, tentar `GET <supabase>/rest/v1/reconhecimentos` | **401/403 (permission denied)** — RLS + sem GRANT |

Os itens 1–7, 9, 10, 12, 13 já foram exercitados em testes automatizados com bancos simulados (ver README); a validação acima repete tudo **com dados e usuários reais do ambiente**, que é o que falta.
