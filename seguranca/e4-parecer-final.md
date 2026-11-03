# e4 · Parecer final de segurança: Área do Membro

- **Responsável:** OTTO (Líder de AppSec)
- **Data:** 2026-11-03
- **Sistema:** `produtiva-portal`, publicado em `https://areadomembro.produtivajunior.com.br`
- **Base analisada:** branch `pj-office/analisar-a-seguranca-do-site-jzeve`, igual a `main` em `43ede45`. Considero que produção roda esse código (suposição: o site publicado não expõe a versão).
- **Fontes consolidadas:**
  - `e1-modelagem-ameacas.md` (OTTO)
  - `e2-revisao-codigo-dependencias.md` (KIRA)
  - `e3-configuracao-lgpd.md` (EMÍLIO)
- **Referências:** OWASP Top 10 2021, OWASP ASVS 4.0.3 nível 2 e LGPD
- **Sigilo:** nenhum segredo, hash ou dado pessoal aparece aqui. Cito só o arquivo, a linha e o commit.

---

## 1. Parecer

# **BLOQUEADO**

- **Correções verificadas:** nenhuma. Conferi no código em 2026-11-03:
  - `changePasswordLocal` continua sem `auth()` (`src/lib/actions.ts:98`).
  - `pipj/lancar` continua sem login e sem a trava mensal (`route.ts:104-117`).
  - O servidor continua usando a chave anon (`src/lib/supabase-server.ts:4-7`).
  - `next.config.ts` continua vazio.
  - `next` continua em 16.1.4.
  - `git diff HEAD` não mostra nenhuma mudança de código.
- **Por que bloqueia:** há 7 achados críticos e 10 altos em aberto. Pela regra 4 da área, críticos e altos bloqueiam a entrega até a correção ser verificada.
- **O que o bloqueio impede:** qualquer nova publicação em produção, exceto os patches de segurança da Fase 1. Esses patches podem e devem subir assim que a Cyber segurança verificar cada um.
- **Alerta sobre o site no ar:** o site publicado está exposto **hoje**. Para tomar a conta do administrador ou creditar saldo PIPJ, basta um navegador. Não precisa de login.

---

## 2. Resumo executivo (para o dono)

A Área do Membro guarda três tipos de dado: pessoal (CPF, endereço, nascimento), financeiro (saldo e saques do PIPJ) e de RH (avaliações e punições). Por isso a criticidade do sistema é **alta**.

A revisão achou um problema de base. O servidor usa a mesma chave pública que vai para o navegador. Para o app funcionar assim, o banco foi deixado aberto. Na prática, a "porta dos fundos" do banco não tem fechadura.

Além disso:
- várias funções de administração atendem qualquer visitante;
- uma delas troca a senha de qualquer conta, inclusive a do admin;
- outra credita dinheiro no PIPJ de todos os membros;
- a senha do banco de produção está no repositório do GitHub;
- a versão do Next.js usada tem falha pública que permite executar código no servidor.

Na parte de configuração, o básico está certo: HTTPS, TLS 1.3, cookies protegidos e nenhum arquivo sensível servido. Faltam os cabeçalhos de segurança. Na LGPD, faltam o aviso de privacidade e o consentimento no cadastro, e não há política de privacidade pública.

**Nota de risco geral: 10/10, nível Crítico.**

**O que fazer:**
1. Aprovar a troca da senha do banco e do token do Monday.
2. Deixar a Engenharia executar a Fase 1 (seção 6) nesta semana.
3. Mandar verificar os logs para saber se alguém já explorou as falhas.

Se houver indício de acesso indevido, a LGPD (art. 48) exige comunicar a ANPD e os titulares.

---

## 3. Nota de risco geral

**Método:**
- **Risco = Impacto (1 a 5) × Probabilidade (1 a 5).** O resultado vai de 1 a 25 e é convertido para a escala de 0 a 10.
- **Índice ponderado**, para acompanhar a evolução:
  - crítica = 10 pontos;
  - alta = 5;
  - média = 2;
  - baixa = 0,5.

| Fator | Nota | Justificativa |
|---|---|---|
| Impacto | 5 | Tomada da conta do admin. Leitura de CPF e de hashes de senha. Fraude financeira no PIPJ e nos saques. Apagamento da auditoria. Incidente LGPD. |
| Probabilidade | 5 | O site está na internet e a chave anon está no bundle público. C2, C3 e C4 não exigem login. As CVEs de C7 são públicas. A exploração não exige habilidade avançada. |
| **Risco** | **25/25, ou 10/10 (Crítico)** | |

| Severidade | Qtde | Pontos |
|---|---|---|
| Crítica | 7 | 70 |
| Alta | 10 | 50 |
| Média | 11 | 22 |
| Baixa | 3 | 1,5 |
| **Total** | **31** | **143,5** |

- **Meta para liberar:** 0 críticas e 0 altas, ou seja, no máximo 23,5 pontos, e nota igual ou menor que 4/10.
- **Ressalva:** o índice ponderado só mede a evolução. Ele não substitui a regra de bloqueio.

---

## 4. Vulnerabilidades consolidadas, sem duplicidade

**Como deduplicar:** o ID final é o da etapa que trouxe a evidência mais completa. A coluna "Origem" mostra os IDs equivalentes nas outras etapas.

### Críticas (7)

| ID | Vulnerabilidade | Local | Origem |
|---|---|---|---|
| C1 | RLS `USING (true)` para anon, inclusive em `users`, `colaboradores`, `transacoes_pipj`, `solicitacoes_saque`, `formularios` e `audit_logs`. O servidor usa a chave anon. | `supabase/migrations/001_create_all_tables.sql:333-356`; `20260319_create_forms_tables.sql:57-60`; `create_audit_logs.sql:12`; `src/lib/supabase-server.ts:4-7` | e1 T1 e T8; e2 C1 |
| C2 | `changePasswordLocal` troca a senha de qualquer conta, sem login, com o ID vindo do cliente. | `src/lib/actions.ts:98-115` | e2 C2 (novo) |
| C3 | Server Actions de administração sem `auth()`: aprovar, desligar, reativar e excluir usuário, e importar NPS. | `src/lib/admin-actions.ts:6,188,202,216`; `src/lib/nps-actions.ts:35` | e1 T3; e2 C3 |
| C4 | `POST /api/pipj/lancar` sem login, com `valor_final` sem teto e sem a trava mensal. | `src/app/api/pipj/lancar/route.ts:104-117,361` | e1 T4; e2 C4 |
| C5 | Segredos no repositório e no histórico: URL do Postgres de produção com senha, token do Monday e admin com senha fixa. | `run-migration.js:16`; `scripts/check-migrations.js:14`; `scripts/clean-mock-pg.js:5`; `test_monday.js:2`; `create-admin.js:7-11`; `verify-hash.js:4`; commit `85e11eb` | e1 T2 e T9; e2 C5 |
| C6 | Senha do candidato gravada em texto puro em `solicitacoes_conta`. | `src/app/(auth)/signup/signup-form.tsx:81-98`; `supabase/migrations/005_solicitacoes_conta.sql:18` | e1 T5; e2 C6 |
| C7 | `next` 16.1.4 com RCE sem login (GHSA-2xp9-vwfh-vxw4, GHSA-673q-mjm6-r5xr). `next-auth` beta.30 com checagem de `auth` que falha aberta (GHSA-8fpg-xm3f-6cx3). | `package.json:43-44` | e1 T16 (parte); e2 C7 |

### Altas (10)

| ID | Vulnerabilidade | Local | Origem |
|---|---|---|---|
| A1 | Recuperação de senha só com CPF e data de nascimento. A senha temporária aparece na tela, tem 6 caracteres e é gerada com `Math.random()`. | `src/lib/actions.ts:39-97` | e2 A1 |
| A2 | Seis rotas de API sem `auth()`: `flags` (GET e DELETE), `membros`, `pipj/preview` e `monday/*`. | `src/app/api/flags/route.ts:4,20`; `membros/route.ts:4`; `pipj/preview/route.ts:96`; `monday/*/route.ts` | e1 T6; e2 A2 |
| A3 | XSS armazenado em título e descrição de formulários (`dangerouslySetInnerHTML`). | `src/components/forms/pergunta-input.tsx:48`; `rich-text-input.tsx:33`; `formularios/page.tsx:556,710`; `forms-management/page.tsx:85` | e1 T10; e2 A3 |
| A4 | Condição de corrida na aprovação de saque: o mesmo saque é debitado duas vezes. | `src/app/api/pipj/saque/route.ts:60-164` | e2 A4 |
| A5 | Login sem limite de tentativas. O JWT de 30 dias não é revalidado depois de desligamento ou rebaixamento. | `src/auth.ts:13-19,32-92` | e1 T11 e T13; e2 A5 |
| A6 | `xlsx` 0.18.5 lê planilhas enviadas pelo usuário. Tem prototype pollution e ReDoS, sem correção no npm. | `src/components/import-nps-dialog.tsx:9` | e1 T16 (parte); e2 A6 |
| A7 | Buckets `comprovantes` e `pdi-anexos` são públicos. O upload aceita anon, porque a policy não tem `TO authenticated`. | `supabase/migrations/003_add_comprovante_to_milhas.sql:3,8,11`; `request-removal-dialog.tsx:139`; `wallet-card.tsx:251` | e1 T7 (confirmado na e4) |
| A8 | Nenhum cabeçalho de segurança (HSTS, CSP, X-Frame-Options, nosniff, Referrer-Policy). Confirmado em produção. | `next.config.ts:3-5` | e1 T15; e2 B3; e3 E3-01 |
| A9 | O cadastro coleta CPF, endereço, nascimento e telefone sem aviso de privacidade, sem finalidade e base legal, e sem registro de consentimento (LGPD arts. 6º, 8º e 9º). | `src/app/(auth)/signup/signup-form.tsx:24-44` | e1 T18; e3 E3-02 |
| A10 | Não há política de privacidade pública: `/privacidade` e `/termos` redirecionam para o login (LGPD art. 9º). | site publicado | e3 E3-05 |

### Médias (11)

| ID | Vulnerabilidade | Local | Origem |
|---|---|---|---|
| M1 | Mass assignment: o `...rest` vai inteiro para o `update` de colaborador. | `src/app/api/colaboradores/update/route.ts:71-72` | e2 M1 |
| M2 | Log de auditoria com autor e valores vindos do cliente. | `colaboradores/update/route.ts:153-161` | e2 M2 |
| M3 | Injeção de filtro PostgREST em `.or()` com interpolação. | `src/lib/admin-actions.ts:234` | e2 M3 |
| M4 | Webhooks do n8n sem assinatura. Um deles está no bundle do navegador. | `miles-management/components/addition-requests.tsx:48`; `pipj/saque/route.ts:141` | e2 M4 |
| M5 | Dados pessoais nos logs: PIX, telefone e e-mail digitado no login. | `pipj/saque/route.ts:140`; `src/auth.ts:43-80` | e1 T11 (parte); e2 M5 |
| M6 | IA: o histórico vem do cliente, sem limite de tamanho nem de uso. Há transferência internacional de dados pessoais sem registro (LGPD art. 33). | `api/assistente-pessoal/route.ts:193,243-249`; `api/feedback-agent/route.ts:170,240-248` | e1 T12; e2 M6 |
| M7 | Dependências transitivas altas, todas com correção: `zod`, `ws`, `nanoid`, `postcss`, `sharp`/libvips. | `package-lock.json` | e2 M7 |
| M8 | O candidato escolhe o próprio cargo e núcleo no autocadastro. | `signup-form.tsx:24-30`; `admin-actions.ts:6-120` | e1 T14 |
| M9 | Conta de serviço Google com delegação em todo o domínio. | `src/lib/google-calendar.ts` | e1 T17 |
| M10 | Porta 22 (SSH) aberta para a internet no host do site. | host do site | e3 E3-03 |
| M11 | Não há canal do titular nem identificação do encarregado (LGPD art. 18). | site | e3 E3-06 |

### Baixas (3)

| ID | Vulnerabilidade | Local | Origem |
|---|---|---|---|
| B1 | `error.message` do banco devolvido ao cliente. | `flags/route.ts:14,35`; `membros/route.ts:14`; `colaboradores/update/route.ts:108,149` | e2 B1 |
| B2 | Presença por QR: o QR pode ser compartilhado, e o limite de tentativas fica na memória de cada instância. | `src/app/api/reunioes/presenca/route.ts:83-90` | e1 T19; e2 B2 |
| B3 | Cabeçalho `x-powered-by: Next.js`. | `next.config.ts` | e3 E3-04 |

### Descartado

- **e1 T20 (HMAC do Slack):** era falso positivo. A KIRA confirmou o uso de `timingSafeEqual` com uma janela de 5 minutos (`src/lib/slack.ts:62-70`).

---

## 5. Os 5 riscos mais urgentes e como corrigir cada um

1. **C1 · Banco aberto para qualquer visitante (causa raiz).**
   - **Como explorar:** copiar a chave anon do bundle e usar o PostgREST. Com ela, dá para:
     - fazer `PATCH users` com `role=ADMIN`;
     - fazer `PATCH colaboradores` com `saldo_pipj`;
     - apagar `audit_logs`.
   - **Correção:**
     1. Criar `SUPABASE_SERVICE_ROLE_KEY`, sem `NEXT_PUBLIC_`, com `import 'server-only'` em `src/lib/supabase-server.ts`.
     2. Criar uma migration que remova as policies `allow_anon_*` e `"Allow all…"` e faça `REVOKE ALL … FROM anon, authenticated` nas tabelas internas. O SQL está na e2, C1.
     3. Deixar `audit_logs` só com INSERT.
     4. As telas que leem o Supabase pelo cliente (`use-supabase.ts:22`, `account-requests.tsx:18`) passam a chamar rotas `/api` autenticadas.
   - **Ordem obrigatória:** C1 vem antes de qualquer outra correção. Sem ela, todos os guards de código podem ser contornados.

2. **C5 · Senha do banco de produção no git.**
   - **Como explorar:** quem tem acesso de leitura ao repositório, ou a um clone antigo, conecta como `postgres` e passa por cima de tudo, inclusive da RLS.
   - **Correção:**
     1. **Trocar a senha** do Postgres e o token do Monday. Isso precisa de aprovação do dono.
     2. Ler `process.env.DATABASE_URL` sem valor padrão.
     3. Apagar os scripts soltos da raiz: `run-migration.js`, `test_*.js`, `create-admin.js` e `verify-hash.js`.
     4. Limpar o histórico com `git filter-repo`, só depois da troca.
     5. Rodar gitleaks no CI.

3. **C2 + C3 · Server Actions sem login: tomada da conta do admin e exclusão de usuários.**
   - **Como explorar:** fazer `POST` com o cabeçalho `Next-Action: <id do bundle>` e o corpo `["<colaborador_id do admin>","nova"]`.
   - **Correção:**
     1. Criar um guard único `exigirTier(n)` em `src/lib/guards.ts`. Ele chama `auth()`, confere `status = 'Ativo'` e confere o tier.
     2. Chamar o guard na primeira linha de toda função `'use server'`.
     3. Em `changePasswordLocal`, pegar o ID **da sessão** e exigir a senha atual.
     4. Validar todo ID como UUID.

4. **C4 · Lançamento de PIPJ sem login e sem teto.**
   - **Como explorar:** `POST /api/pipj/lancar` com `overrides.valor_final` alto credita o saldo de todos os membros ativos. Repetir o pedido multiplica o valor.
   - **Correção:**
     1. Chamar `exigirAcessoPipj()` no topo da rota.
     2. Validar o corpo com zod: `mes` de 1 a 12 e `valor_final` de 0 até o limite.
     3. Recolocar a trava de um lançamento por mês, que hoje está removida em `:117`.
     4. Criar um índice único parcial em `lancamentos_pipj(mes, ano) WHERE revertido_em IS NULL`. Repetir o lançamento passa a devolver 409.

5. **C7 · Next.js com RCE pública.**
   - **Como explorar:** o exploit está documentado nos advisories e funciona sem login contra o Image Optimizer.
   - **Correção:**
     1. Rodar `npm i next@^16.4.5 eslint-config-next@^16.4.5 next-auth@latest @auth/prisma-adapter@latest`.
     2. Rodar `npm audit fix`, que fecha M7.
     3. Rodar build e testes de novo.

**Fora do top 5, mas na mesma fase:** C6 (senha em texto puro). Ele é mitigado em parte por C1. A correção é fazer o cadastro por uma rota de servidor que já grava o hash, e uma migration que apaga as senhas em texto existentes.

---

## 6. Plano de remediação em fases

Quem corrige é a Engenharia. A Infraestrutura cuida de M10. Produto e o jurídico cuidam do texto da LGPD. A Cyber segurança verifica cada correção com um teste que reproduz o ataque e espera 401, 403 ou 409.

### Fase 1 · Imediato (até 7 dias, bloqueante)

| # | Ação | IDs |
|---|---|---|
| 1 | Trocar a senha do Postgres e o token do Monday. Precisa de aprovação do dono. | C5 |
| 2 | Investigar se houve exploração: logs do PostgREST e do Postgres, `users.role` alterados, saldos e lançamentos PIPJ fora do padrão, `audit_logs` apagados. Se houver indício, comunicar a ANPD e os titulares (LGPD art. 48). | C1, C4 |
| 3 | Criar a chave de servidor e a migration que fecha a RLS do anon. `audit_logs` fica só com INSERT. | C1 |
| 4 | Criar o guard `exigirTier` e aplicar em todas as Server Actions e nas 6 rotas abertas. Incluir `/api` no matcher do middleware. | C2, C3, A2 |
| 5 | Proteger `pipj/lancar`: login, validação com zod, trava mensal e índice único. | C4 |
| 6 | Fazer o cadastro por uma rota de servidor que grava o hash, e apagar as senhas em texto existentes. | C6 |
| 7 | Atualizar `next` e `next-auth`, depois rodar `npm audit fix`. | C7, M7 |
| 8 | Contenção até os itens 3 a 6 subirem: tirar do ar `/signup` e a recuperação de senha. Suposição: o cadastro pode esperar alguns dias. | C6, A1 |

### Fase 2 · 30 dias (bloqueante: as altas também impedem a liberação)

| # | Ação | IDs |
|---|---|---|
| 1 | Recuperação de senha por link de uso único enviado ao e-mail corporativo, com resposta única e limite de tentativas. | A1 |
| 2 | Sanitizar o HTML com DOMPurify e uma allowlist, ao gravar e ao exibir. | A3 |
| 3 | Função `aprovar_saque` com `FOR UPDATE`, e a mesma coisa em `saque/reverter`. | A4 |
| 4 | Limite de tentativas no login, JWT de 8 horas revalidado a cada 5 minutos e senha com 12 caracteres ou mais. | A5 |
| 5 | Trocar o `xlsx` pela versão 0.20.3 da SheetJS (CDN) ou por `exceljs`. | A6 |
| 6 | Buckets `comprovantes` e `pdi-anexos` privados, com URL assinada curta e upload só para `authenticated`. | A7 |
| 7 | `headers()` com HSTS, CSP, `frame-ancestors 'none'`, nosniff e Referrer-Policy, e `poweredByHeader: false`. | A8, B3 |
| 8 | Aviso de privacidade e registro de consentimento (data, hora e versão) no cadastro. Política pública em `/privacidade`. | A9, A10 |
| 9 | Allowlist de campos, auditoria montada no servidor, `.eq()` no lugar de `.or()` interpolado e PII fora dos logs. | M1, M2, M3, M5 |

### Fase 3 · 90 dias (melhoria contínua)

| # | Ação | IDs |
|---|---|---|
| 1 | IA: histórico montado no servidor, limite de 20 mensagens de até 4.000 caracteres, limite por usuário, minimização dos dados e registro da transferência internacional. | M6 |
| 2 | Webhooks do n8n chamados só pelo servidor, com HMAC. | M4 |
| 3 | Cargo e núcleo definidos só pelo aprovador. | M8 |
| 4 | Reduzir os escopos da conta de serviço Google e trocar a chave. | M9 |
| 5 | SSH restrito por firewall ou VPN, só com chave, mais fail2ban. É com a Infraestrutura. | M10 |
| 6 | Canal do titular, nome do encarregado, inventário LGPD (finalidade, base legal e retenção) e RIPD. | M11 |
| 7 | Erros genéricos para o cliente e limite de tentativas do QR guardado no banco. | B1, B2 |
| 8 | Limpar o histórico do git, rodar gitleaks e `npm audit` no CI, criar testes de regressão de segurança e zerar os 515 erros de lint. | C5, geral |

---

## 7. Condições para mudar o parecer

- **APROVADO COM RESSALVAS:** exige as Fases 1 e 2 concluídas, cada correção crítica e alta com teste de ataque passando, e a re-verificação da Cyber segurança. Inclui conferir, só com leitura, no banco de produção:
  - `pg_policies`;
  - `information_schema.role_table_grants` do anon;
  - os Supabase Security Advisors.

  As médias e baixas da Fase 3 ficam como ressalvas, com prazo.
- **APROVADO:** exige também a Fase 3 concluída.

---

## 8. Validação nesta etapa

Nenhum código foi alterado. Esta etapa adiciona só `seguranca/e4-parecer-final.md` e atualiza `seguranca/checklist-seguranca-agencia.md`.

| Comando | Resultado |
|---|---|
| `npm run test:pipj` | **passou**: 8 de 8 |
| `npm run build` (com variáveis de ambiente fictícias) | **passou**, incluindo a checagem de tipos |
| `npm run lint` | **falhou**: 515 erros e 66 avisos. Os erros já estavam no código, não vêm desta etapa. A correção é da Engenharia (Fase 3). |
| `npm audit --omit=dev` | 12 vulnerabilidades: 4 críticas, 7 altas e 1 moderada (C7, A6 e M7) |
