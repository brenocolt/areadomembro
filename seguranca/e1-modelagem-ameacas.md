# Modelagem de ameaças — Área do Membro (Produtiva Júnior)

- **Etapa:** e1 · OTTO (AppSec) · 2026-11-03
- **Base:** OWASP Top 10 (2021), OWASP ASVS 4.0.3 nível 2 e LGPD
- **Método:** STRIDE sobre leitura estática do código do branch `pj-office/analisar-a-seguranca-do-site-jzeve` (que parte de `main` em `43ede45`). Nenhum teste foi feito contra o banco ou o site de produção.
- **Regra deste relatório:** nenhum segredo, senha ou dado real aparece aqui. Só citamos arquivo e linha.

## 1. Sistema analisado (escolha explícita)

O pedido sugeria analisar "o projeto mais recente". O escritório, porém, abriu esta tarefa dentro do repositório `brenocolt/areadomembro`, então este é o site analisado. Pelas notas de entrega, o projeto mais recente seria a landing page `landing-construtora-popular`. Ela é estática, não tem formulário nem login, e por isso tem risco baixo. Se o dono quiser essa ou outra análise, ela vira uma tarefa separada.

**O que é o sistema:** portal interno da empresa júnior Produtiva ("produtiva-portal"). Os membros acessam perfil, PDI, formulários e NPS, pontuação e punições, milhas e benefícios, saldo e saques de PIPJ (remuneração variável), reuniões com presença por QR, um assistente de IA e um agente de feedback.

**Stack:** Next.js 16.1.4 (App Router), NextAuth v5 beta (Credentials + JWT), Supabase (Postgres, PostgREST e Storage), deploy na Vercel (suposição: o README cita a Vercel).

**Criticidade: ALTA, com rigor máximo de revisão.** O sistema reúne os três tipos de dado:
- **Pessoal:** CPF, endereço, data de nascimento, telefone, e-mails, matrícula universitária.
- **Financeiro:** saldo PIPJ, saques, lançamentos mensais e comprovantes.
- **Sensível de RH:** avaliações de desempenho, punições, ausências, PDI e feedbacks.

O sistema não trata dado sensível no sentido do art. 5º, II da LGPD (saúde, por exemplo), exceto se os comprovantes de ausência trouxerem atestado médico (suposição a confirmar).

## 2. Ativos

| Ativo | Onde está | Por que importa |
|---|---|---|
| Credenciais (`users.senha` em bcrypt, sessão JWT, `AUTH_SECRET`) | Supabase `users`, cookie | Tomada de conta |
| Dados pessoais de membros e candidatos | `colaboradores`, `solicitacoes_conta`, `membros_pre_cadastro` | LGPD |
| Saldos e movimentações financeiras | `colaboradores.saldo_pipj`, `transacoes_pipj`, `lancamentos_pipj`, `solicitacoes_saque` | Fraude e prejuízo direto |
| Pontos, milhas e punições | `ocorrencias`, `milhas_*`, `solicitacoes_pontuacao`, `plano_punicao` | Integridade do sistema de mérito |
| Avaliações, NPS, PDI e feedbacks | `avaliacoes_nps`, `formulario_*`, `pdi_*` | Confidencialidade de RH |
| Arquivos (comprovantes e avatares) | Supabase Storage `comprovantes`, `avatars` | Podem conter dados pessoais ou financeiros |
| Trilha de auditoria | `audit_logs` | Não repúdio |
| Segredos de integração | Variáveis de ambiente na Vercel e **arquivos versionados no git** (seção 6, T2) | Acesso total a terceiros |

## 3. Perfis de acesso

1. **Anônimo (internet):** acessa `/login`, `/signup` e as rotas de recuperação de senha. Também recebe a chave anon do Supabase, que vai no bundle do navegador (`NEXT_PUBLIC_SUPABASE_ANON_KEY`).
2. **Candidato:** envia o autocadastro e fica esperando aprovação.
3. **Membro** (cargo Operacional): acessa as páginas universais (`src/lib/access-control.ts:59`).
4. **Tático:** acessa também a gestão de PDI e de alocações.
5. **Núcleos com páginas extras:**
   - Gestão de Pessoas: formulários, pontos, milhas, ausências, reuniões e feedback.
   - Vice-Presidência: PIPJ, ausências e alocações.
6. **Estratégico ou conta fantasma:** acesso total, e nível 3 em Gestão de Usuários, onde se definem cargo, páginas e saldos.
7. **ADMIN** (`users.role`): acesso irrestrito.
8. **Máquinas:** Slack (webhook assinado), Google Calendar (conta de serviço com delegação de domínio), Monday.com (API) e Anthropic (LLM).

**Fronteira de confiança mais importante:** o `RouteGuard` (`src/components/route-guard`) roda **só no cliente**. O middleware exclui `/api` (`src/middleware.ts:8`). Por isso, quem autoriza de verdade é cada rota ou server action, junto com o RLS do banco.

## 4. Superfícies de ataque

- **PostgREST direto:** `https://<projeto>.supabase.co/rest/v1/*` com a chave anon pública. O servidor também usa a chave anon (`src/lib/supabase-server.ts:4-7`), então o RLS precisa liberar o anon para o app funcionar.
- **27 rotas `src/app/api/**/route.ts`:** 7 delas não chamam `auth()` (seção 6, T4).
- **Server actions** (`'use server'`): `src/lib/actions.ts`, `src/lib/admin-actions.ts` e `src/lib/nps-actions.ts`. Nenhuma chama `auth()`.
- **Formulários públicos:** `/login` e `/signup`. O signup grava direto do navegador em `solicitacoes_conta`.
- **Uploads no Storage:** comprovantes de milhas e de punições (`getPublicUrl`) e avatares.
- **IA:** `/api/assistente-pessoal` e `/api/feedback-agent`, com risco de prompt injection e custo.
- **Webhook:** `/api/slack/interactions`.
- **Presença por QR:** `/api/reunioes/presenca`.
- **Repositório git:** scripts soltos na raiz e em `scripts/`.

## 5. Integrações

| Integração | Credencial | Risco principal |
|---|---|---|
| Supabase | Chave anon pública. A service role aparece só em scripts, não em `src/` | RLS permissiva (T1) |
| Postgres direto (`pg`) | String de conexão | **Versionada no git** (T2) |
| Monday.com | Token da API | **Versionado no git** (T2) |
| Slack | `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` | Forjar interações (T13) |
| Google Calendar | Conta de serviço com delegação **em todo o domínio** | Vazamento = escrita em qualquer agenda do domínio (T17) |
| Anthropic | Chave da API | Custo, injeção e transferência internacional de dados pessoais (T12) |

## 6. Ameaças STRIDE, priorizadas

Impacto (I) e probabilidade (P) vão de 1 a 3. Prioridade = I × P. A severidade segue a escala da área.

| ID | STRIDE | Ameaça | Local | I | P | Sev. |
|---|---|---|---|---|---|---|
| T1 | I, T, E | RLS `USING (true)` para SELECT, INSERT e UPDATE do anon em `users`, `colaboradores`, `transacoes_pipj`, `solicitacoes_saque`, `milhas_*`, `ocorrencias`… Com a chave anon do bundle, qualquer pessoa lê hashes de senha e CPFs, e consegue fazer `UPDATE users SET role='ADMIN'` ou alterar `saldo_pipj`. O mesmo padrão aparece em `solicitacoes_pontuacao` e `solicitacoes_adicao_milhas`. | `supabase/migrations/001_create_all_tables.sql:333-356`; `20261016_solicitacoes_pontuacao.sql:28-32`; `002_create_milhas_addition_requests.sql:16-20`; `src/lib/supabase-server.ts:4` | 3 | 3 | **Crítica** |
| T2 | I | Credencial de produção do Postgres e token do Monday versionados (o próprio comentário admite a exposição). Continuam no histórico do git mesmo se forem apagados. | `run-migration.js:16`; `scripts/check-migrations.js:14`; `scripts/clean-mock-pg.js:5`; `test_monday.js:2` | 3 | 3 | **Crítica** |
| T3 | E, T | Server actions sem autenticação nem autorização: aprovar conta, desligar, reativar e **excluir usuário definitivamente**. Server actions são endpoints POST públicos. | `src/lib/admin-actions.ts:6,188,202,216`; `src/lib/actions.ts`; `src/lib/nps-actions.ts` | 3 | 2 | **Crítica** |
| T4 | T, E | `POST /api/pipj/lancar` não autentica e credita `saldo_pipj` de todos os membros. A trava mensal está desligada ("removed for testing purposes"). | `src/app/api/pipj/lancar/route.ts:104,116,418-422` | 3 | 2 | **Crítica** |
| T5 | I | Senha do candidato gravada **em texto puro** em `solicitacoes_conta`. O hash só é feito na aprovação. A migração da tabela não ativa RLS. | `src/app/(auth)/signup/signup-form.tsx:97`; `src/lib/admin-actions.ts:25`; `supabase/migrations/005_solicitacoes_conta.sql` | 3 | 3 | **Crítica** |
| T6 | I, T | Outras rotas sem `auth()`: `DELETE /api/flags` (apaga flags), `GET /api/pipj/preview` (desempenho e punições de todos), `GET /api/membros` (PII de pré-cadastro), `GET /api/monday/*`. | `src/app/api/flags/route.ts:20`; `pipj/preview/route.ts:96`; `membros/route.ts:4`; `monday/*/route.ts` | 2 | 3 | **Alta** |
| T7 | I | Bucket `comprovantes` público para leitura, e o upload não exige usuário autenticado. Os arquivos podem ter dados financeiros ou de saúde. | `supabase/migrations/003_add_comprovante_to_milhas.sql:8,11`; `20260906_profile_avatars_bucket.sql:12-18`; `punishments/.../request-removal-dialog.tsx:139` | 3 | 2 | **Alta** |
| T8 | R | `audit_logs` com `FOR ALL USING (true)`: qualquer pessoa altera ou apaga a trilha de saques e do PIPJ. | `supabase/migrations/create_audit_logs.sql:12` | 2 | 3 | **Alta** |
| T9 | S, E | Script cria um ADMIN com senha padrão fraca, fixa no código. `verify-hash.js` traz um hash e uma senha de teste. | `create-admin.js:6-7`; `verify-hash.js:3-4` | 3 | 2 | **Alta** |
| T10 | T | XSS armazenado: o título e a descrição de formulários são renderizados com `dangerouslySetInnerHTML`. É preciso confirmar se há sanitização no servidor. Combinado com T1, qualquer pessoa consegue gravar o HTML. | `src/components/forms/pergunta-input.tsx:48`; `src/components/forms/rich-text-input.tsx:17` | 3 | 2 | **Alta** |
| T11 | S | Login sem limite de tentativas nem bloqueio. Senha mínima de 6 caracteres. Logs com e-mail e com o resultado da comparação de senha (PII em log e enumeração). | `src/auth.ts:38-66`; `signup-form.tsx:28` | 2 | 2 | Média |
| T12 | I, D | IA: o histórico `messages` vem do cliente, então dá para forjar turnos do assistente. Há risco de injeção a partir de textos de terceiros (feedbacks), de vazamento de dados de outros membros no contexto, e de custo sem limite. Na LGPD, isso é envio de dados pessoais a operador estrangeiro. | `src/app/api/assistente-pessoal/route.ts:193,243-248`; `src/app/api/feedback-agent/route.ts` | 2 | 2 | Média |
| T13 | E | O JWT carrega `role` e `colaborador_id`. Quando o cargo é rebaixado ou o membro é desligado, a sessão já emitida continua válida até expirar. | `src/auth.ts:13-26` | 2 | 2 | Média |
| T14 | S | O candidato escolhe o próprio cargo e núcleo no signup. Verificar se a aprovação revisa esses campos ou aceita como vieram. | `signup-form.tsx:24-30`; `src/lib/admin-actions.ts:6-120` | 2 | 2 | Média |
| T15 | — (configuração) | Sem headers de segurança (CSP, HSTS, X-Frame-Options, Referrer-Policy): `next.config.ts` está vazio. | `next.config.ts` | 2 | 2 | Média |
| T16 | — (componente vulnerável) | Dependências: `xlsx@0.18.5` (o npm não recebe mais correções; há CVEs conhecidos de prototype pollution e ReDoS) e `next-auth@5.0.0-beta`. | `package.json` | 2 | 2 | Média |
| T17 | E | A chave da conta de serviço Google tem delegação em todo o domínio. Se vazar, permite criar e alterar eventos em qualquer agenda. | `src/lib/google-calendar.ts`; README | 3 | 1 | Média |
| T18 | — (LGPD) | Coleta de CPF, endereço, nascimento, telefone e e-mail pessoal sem finalidade, base legal ou retenção documentadas. Falta definir a retenção de dados de desligados e o fluxo de direitos do titular. | `signup-form.tsx:24-44` | 2 | 2 | Média |
| T19 | T | Presença por QR: o QR pode ser compartilhado para marcar presença remota e ganhar pontos. | `src/app/api/reunioes/presenca/route.ts` | 1 | 2 | Baixa |
| T20 | S | Webhook do Slack: o HMAC tem janela de 5 min, mas a comparação pode não ser em tempo constante. | `src/lib/slack.ts:62-70` | 1 | 1 | Baixa |

**Cadeia de ataque de maior risco:** pegar a chave anon no bundle → usar o PostgREST para ler `users` e `colaboradores` (T1) → promover a própria conta a ADMIN ou creditar saldo PIPJ e saque → apagar `audit_logs` (T8). Tudo isso exige só um navegador.

**Estado:** as linhas T1, T5, T7 e T8 descrevem o que as migrações do repositório criam. O que vale em produção precisa ser confirmado só com leitura (tarefa do Emílio, abaixo).

## 7. Requisitos de segurança (para Produto e Engenharia)

**R1.** O servidor usa `SUPABASE_SERVICE_ROLE_KEY`, só em código de servidor. O anon fica sem nenhuma policy nas tabelas internas. Se o navegador precisar de acesso, usar RLS por `auth.uid()` (ASVS V4.1). Corrige T1 e T8.
**R2.** Trocar a senha do Postgres e o token do Monday. Tirar os valores do código: só `process.env`, sem valor padrão. Limpar o histórico do git (ASVS V2.10, V14.3). Corrige T2 e T9.
**R3.** Todo route handler e toda server action chama `auth()` e confere a permissão com `paginaPermitida` ou `exigirAcessoPipj` antes de qualquer leitura ou escrita (ASVS V4.1.1, V4.2). Corrige T3, T4 e T6.
**R4.** O signup passa por uma rota de servidor que faz o hash da senha antes de gravar. Cargo e núcleo são definidos na aprovação, não pelo candidato. Corrige T5 e T14.
**R5.** Comprovantes ficam em bucket privado, com URL assinada e curta, e o upload exige usuário autenticado (ASVS V12). Corrige T7.
**R6.** Sanitizar o HTML no servidor com uma allowlist. Definir CSP e os headers de segurança. Corrige T10 e T15.
**R7.** Limitar tentativas de login, senha com no mínimo 10 caracteres, tirar a PII dos logs e revalidar role e status a cada requisição sensível (ASVS V2.2, V3.3). Corrige T11 e T13.
**R8.** IA: montar o histórico no servidor, limitar uso por usuário e mandar ao modelo só o mínimo de dados (LGPD art. 6º, III). Corrige T12.
**R9.** LGPD: registro da operação de tratamento, finalidade e base legal de cada campo, política de retenção e aviso de privacidade no signup. Corrige T18.

## 8. Divisão para as próximas etapas

### KIRA (e2): revisão de código e dependências
- [ ] T3: auditar **toda** função `export async function` em arquivos `'use server'` (autenticação, autorização, IDOR por `colaboradorId`).
- [ ] T4/T6: as 27 rotas em `src/app/api`. Confirmar quais não autenticam e procurar IDOR nas que autenticam (`pdi/solicitacoes/[id]`, `reunioes/[id]`, `colaboradores/update`).
- [ ] T4: lógica de `pipj/lancar` (duplicidade mensal, `overrides` vindos do cliente, valores negativos) e de `pipj/saque` e `saque/reverter` (condição de corrida, saldo negativo).
- [ ] T5/T14: fluxo signup → `approveAccountRequest`.
- [ ] T10: sanitização do rich text (`rich-text-input.tsx`, `pergunta-input.tsx`, `icons.tsx:53`).
- [ ] T11/T13: `src/auth.ts` (logs, limite de tentativas, revalidação do JWT).
- [ ] T12: as duas rotas de IA (montagem do prompt, dados de terceiros, limites).
- [ ] T19/T20: presença por QR e comparação do HMAC do Slack.
- [ ] T16: `npm audit --omit=dev`, mais `xlsx` e `next-auth` beta. Varrer segredos no **histórico** do git (`git log -p`, gitleaks), registrando só arquivo e commit, nunca o valor.

### EMÍLIO (e3): configuração, testes não destrutivos e LGPD
- [ ] T1/T5/T8: confirmar no banco, **só com leitura**, quais policies e grants valem hoje (`pg_policies`, `relrowsecurity`, `information_schema.role_table_grants` para `anon`). Usar também o Supabase advisors. Nenhum INSERT, UPDATE ou DELETE.
- [ ] T1: testar com a chave anon e `select=id&limit=1`, contando só as linhas, se `users`, `colaboradores` e `solicitacoes_conta` respondem ao anon. Não registrar nenhum valor.
- [ ] T2: confirmar se as credenciais versionadas ainda são válidas, sem usá-las. Montar o plano de troca para o dono aprovar.
- [ ] T7: configuração dos buckets (`public`, policies de `storage.objects`).
- [ ] T15: headers HTTP do deploy, cookies (`Secure`, `HttpOnly`, `SameSite`), TLS e variáveis de ambiente na Vercel (nenhum segredo com `NEXT_PUBLIC_`).
- [ ] T17: escopo e guarda da conta de serviço Google.
- [ ] T18: inventário LGPD (campos, finalidade, base legal, retenção, transferência internacional para a Anthropic, direitos do titular).

## 9. Parecer parcial

A entrega está **BLOQUEADA** até a correção ser verificada. Há 5 ameaças críticas (T1 a T5) e 5 altas (T6 a T10). O parecer final sai na etapa e4, depois de e2 e e3.
