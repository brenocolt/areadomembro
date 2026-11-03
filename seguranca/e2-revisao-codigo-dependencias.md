# e2 · Revisão de código e dependências: Área do Membro

- **Responsável:** KIRA (Cyber segurança)
- **Data:** 2026-11-03
- **Base:** branch `pj-office/analisar-a-seguranca-do-site-jzeve`, criado a partir de `main` (`43ede45`)
- **Referências:** OWASP Top 10 2021, OWASP ASVS 4.0.3 (V2, V3, V4, V5, V8, V14) e LGPD (arts. 6º, 46 e 48)
- **Escopo:** `src/` (27 rotas de API, 3 arquivos `'use server'` e componentes que renderizam HTML), `supabase/migrations/`, scripts na raiz, `package-lock.json` e histórico do git
- **Regra de sigilo:** nenhum segredo, hash ou dado pessoal aparece aqui. Cito só o arquivo, a linha e o commit.

## 0. Resumo

| Severidade | Qtde | IDs |
|---|---|---|
| Crítica | 7 | C1 a C7 |
| Alta | 6 | A1 a A6 |
| Média | 7 | M1 a M7 |
| Baixa | 3 | B1 a B3 |

**Parecer da etapa: BLOQUEADO.** Os achados críticos e altos bloqueiam a entrega até a correção ser verificada.

**Causa raiz:** o servidor usa a mesma chave pública (anon) que vai no navegador (`src/lib/supabase-server.ts:3-7`). Para o app funcionar, as policies de RLS precisaram ficar abertas (`USING (true)`). Com isso:
1. toda checagem de permissão no código pode ser contornada chamando o Supabase direto com a chave do bundle;
2. as funções de servidor sem `auth()` viram portas abertas.

Corrigir só o código não basta: a correção de C1 é pré-requisito das demais.

---

## 1. Críticas

### C1 · RLS permissiva e servidor usando a chave anon
- **Local:**
  - `supabase/migrations/001_create_all_tables.sql:333-356`: SELECT, INSERT e UPDATE com `true` em 16 tabelas, inclusive `users`, `colaboradores`, `transacoes_pipj` e `solicitacoes_saque`.
  - `supabase/migrations/20260319_create_forms_tables.sql:57-60`: `FOR ALL USING (true)` sem cláusula `TO`, então vale também para o anon.
  - `supabase/migrations/create_audit_logs.sql:12`: `FOR ALL USING (true)`. Qualquer pessoa apaga a auditoria.
  - `supabase/migrations/20261018c_notificacoes_pontuacao.sql:17-22`
  - `src/lib/supabase-server.ts:3-7` e `src/lib/supabase.ts:3-6`
- **OWASP:** A01 Broken Access Control e A05 Security Misconfiguration. **ASVS:** V4.1.1 e V4.1.3.
- **Como explorar:**
  1. Abrir o site e copiar `NEXT_PUBLIC_SUPABASE_ANON_KEY` do bundle JS.
  2. Ler os dados: `GET /rest/v1/users?select=*` devolve e-mail, hash bcrypt e role de todos.
  3. Virar ADMIN: `PATCH /rest/v1/users?id=eq.<meu_id>` com `{"role":"ADMIN"}`.
  4. Criar saldo: `PATCH /rest/v1/colaboradores?id=eq.<id>` com `{"saldo_pipj":99999}`.
- **Correção:**
  1. Criar uma chave de servidor `SUPABASE_SERVICE_ROLE_KEY`, sem `NEXT_PUBLIC_`.
  2. Usar essa chave só em código de servidor (`import 'server-only'`).
  3. Revogar as policies do anon.
  4. O navegador deixa de ler tabelas sensíveis direto: a leitura passa por rotas de API autenticadas.
  ```ts
  // src/lib/supabase-server.ts
  import 'server-only'
  import { createClient } from '@supabase/supabase-js'
  export function createServerSupabaseClient() {
      return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
          auth: { persistSession: false, autoRefreshToken: false },
      })
  }
  ```
  ```sql
  -- nova migration: fecha o anon nas tabelas sensíveis
  DO $$ DECLARE t text; BEGIN
    FOREACH t IN ARRAY ARRAY['users','colaboradores','transacoes_pipj','solicitacoes_saque',
      'solicitacoes_conta','audit_logs','formularios','formulario_perguntas',
      'formulario_respostas','formulario_respostas_itens','pontuacao_notificacoes'] LOOP
      EXECUTE format('DROP POLICY IF EXISTS allow_anon_select ON %I; DROP POLICY IF EXISTS allow_anon_insert ON %I;
                      DROP POLICY IF EXISTS allow_anon_update ON %I; DROP POLICY IF EXISTS "Allow all for authenticated" ON %I;
                      DROP POLICY IF EXISTS "Allow all for authenticated users" ON %I;
                      REVOKE ALL ON %I FROM anon, authenticated;', t,t,t,t,t,t);
    END LOOP; END $$;
  -- audit_logs: só INSERT pelo service_role; nunca UPDATE ou DELETE
  ```
  Telas que hoje leem com `supabase` no cliente, como `use-supabase.ts:22` e `account-requests.tsx:18`, passam a usar `fetch('/api/...')`.

### C2 · `changePasswordLocal` troca a senha de qualquer conta sem login
- **Local:** `src/lib/actions.ts:99-115`. A chamada fica em `src/app/(dashboard)/profile/components/profile-card.tsx:112`.
- **OWASP:** A01 (IDOR) e A07. **ASVS:** V4.2.1 e V2.1.6.
- **Como explorar:**
  1. Pegar o ID da Server Action no bundle do perfil.
  2. Pegar o `colaborador_id` do admin, que vem em `/api/flags` ou por C1.
  3. Enviar `POST` com cabeçalho `Next-Action: <id>` e corpo `["<colab_admin>","nova"]`.
  4. Resultado: a senha do admin é trocada e a conta é tomada. Não precisa de login.
- **Correção:** o ID do colaborador vem da sessão, nunca do cliente. Exigir a senha atual.
  ```ts
  export async function changePasswordLocal(senhaAtual: string, novaSenha: string) {
      const session = await auth()
      const colaboradorId = (session?.user as any)?.colaborador_id
      if (!colaboradorId) return { success: false, message: 'Não autorizado.' }
      if (typeof novaSenha !== 'string' || novaSenha.length < 12) return { success: false, message: 'Senha fraca.' }
      const supabase = createServerSupabaseClient()
      const { data: u } = await supabase.from('users').select('id, senha').eq('colaborador_id', colaboradorId).single()
      if (!u || !(await bcrypt.compare(senhaAtual, u.senha))) return { success: false, message: 'Senha atual incorreta.' }
      await supabase.from('users').update({ senha: await bcrypt.hash(novaSenha, 12) }).eq('id', u.id)
      return { success: true }
  }
  ```

### C3 · Ações de administração sem autenticação nem autorização
- **Local:**
  - `src/lib/admin-actions.ts:6` (`approveAccountRequest`)
  - `admin-actions.ts:188` (`desligarMembro`)
  - `admin-actions.ts:202` (`reativarMembro`)
  - `admin-actions.ts:216` (`deleteUserCompletely`)
  - `src/lib/nps-actions.ts:35` (`importNpsData`)
- **OWASP:** A01. **ASVS:** V4.1.1 e V4.2.1.
- **Como explorar:** qualquer visitante chama a Server Action pelo ID que está no bundle e consegue:
  - aprovar a própria conta;
  - desligar o admin, o que bloqueia o login dele em `auth.ts:79`;
  - apagar um membro e todo o histórico dele;
  - injetar notas de NPS, que mudam o PIPJ.
- **Correção:** criar um guard único no topo de cada ação.
  ```ts
  // src/lib/guards.ts
  import 'server-only'
  import { auth } from '@/auth'
  import { getUsersManagementTier, isAdmin } from '@/lib/access-control'
  export async function exigirTier(min: 1 | 2 | 3) {
      const s = await auth(); const u = s?.user as any
      if (!u?.colaborador_id) throw new Error('Não autorizado')
      if (isAdmin(u.role)) return u
      const { data: c } = await createServerSupabaseClient().from('colaboradores')
          .select('cargo_atual, nucleo_atual, status').eq('id', u.colaborador_id).single()
      if (c?.status !== 'Ativo' || getUsersManagementTier(c?.cargo_atual, c?.nucleo_atual) < min) throw new Error('Acesso negado')
      return u
  }
  // admin-actions.ts
  export async function deleteUserCompletely(colaboradorId: string) {
      await exigirTier(3)
      if (!/^[0-9a-f-]{36}$/i.test(colaboradorId)) return { success: false, error: 'ID inválido' }
      ...
  ```

### C4 · `POST /api/pipj/lancar` sem login, com valores livres vindos do cliente
- **Local:**
  - `src/app/api/pipj/lancar/route.ts:104-115`: não tem `auth()`, e a rota `/api` fica fora do middleware (`src/middleware.ts:8`).
  - `:117`: a trava de um lançamento por mês foi removida ("removed for testing purposes").
  - `:361-363`: `override.valor_final` sem teto. Com `"abc"`, o valor vira `NaN`.
- **OWASP:** A01 e A04. **ASVS:** V4.1.1 e V11.1.2.
- **Como explorar:** `curl -X POST /api/pipj/lancar -d '{"overrides":{"<id>":{"valor_final":100000,"motivo":"x"}}}'` credita o saldo de todos os membros ativos. Basta repetir para multiplicar.
- **Correção:**
  ```ts
  export async function POST(req: NextRequest) {
    const acesso = await exigirAcessoPipj(); if (acesso.erro) return acesso.erro
    const body = LancarSchema.parse(await req.json())   // zod: mes 1-12, ano 2024-2100, valor_final 0..LIMITE
    const { count } = await supabaseAdmin.from('lancamentos_pipj').select('id', { count: 'exact', head: true })
        .eq('mes', body.mes).eq('ano', body.ano).is('revertido_em', null)
    if (count) return NextResponse.json({ error: 'Mês já lançado.' }, { status: 409 })
  ```
  Criar também um índice único parcial em `lancamentos_pipj(mes, ano) WHERE revertido_em IS NULL` (a coluna `revertido_em` vem da migration `20260721`). Aplicar o mesmo guard em `GET /api/pipj/preview` (A2).

### C5 · Segredos de produção no repositório e no histórico
- **Local:** só o tipo do segredo, sem o valor.
  - `run-migration.js:16`, `scripts/check-migrations.js:14` e `scripts/clean-mock-pg.js:5`: URL do Postgres de produção com senha.
  - `test_monday.js:2`: token JWT da API do Monday.
  - Histórico: `docs/reconhecimentos-implementacao/INTEGRACAO-PASSO-A-PASSO.md`, adicionado em `85e11eb` e removido em `5e23fe1`. Tem a URL do Postgres com senha.
  - `create-admin.js:7-8,11`: e-mail e senha de admin fixos, e a senha vai para o log.
  - `verify-hash.js:4`: senha de teste fixa.
- **OWASP:** A02 e A07. **ASVS:** V2.10.4 e V14.3.
- **Como explorar:** quem tem acesso de leitura ao repositório, ou a um clone antigo, conecta direto no banco como `postgres` e passa por cima de qualquer RLS.
- **Correção:**
  1. Trocar a senha do banco e o token do Monday. Isso precisa de aprovação separada do dono.
  2. Mover os valores para `process.env`.
  3. Apagar os scripts soltos da raiz.
  4. Limpar o histórico com `git filter-repo` depois da troca.
  5. Adicionar o gitleaks no CI.
  ```js
  // run-migration.js
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) throw new Error('DATABASE_URL não definida')
  ```

### C6 · A senha do cadastro fica salva em texto puro
- **Local:** `src/app/(auth)/signup/signup-form.tsx:81-98` grava `senha: values.senha` direto do navegador. A coluna é `supabase/migrations/005_solicitacoes_conta.sql:18`. O hash só é feito em `admin-actions.ts:25`, na aprovação.
- **OWASP:** A02. **ASVS:** V2.4.1. **LGPD:** art. 46.
- **Como explorar:** com C1, `GET /rest/v1/solicitacoes_conta?select=email_corporativo,senha,cpf` devolve a senha legível. Como as pessoas reutilizam senha, isso compromete outras contas delas, inclusive o e-mail corporativo.
- **Correção:**
  1. O cadastro passa a ser uma rota de servidor, que faz o hash antes de gravar.
  2. A coluna passa a se chamar `senha_hash`.
  3. Uma migration apaga as senhas em texto que já estão salvas.
  ```ts
  // src/app/api/signup/route.ts
  const dados = SignupSchema.parse(await req.json())
  const senha_hash = await bcrypt.hash(dados.senha, 12)
  await supabase.from('solicitacoes_conta').insert({ ...semSenha(dados), senha_hash, status: 'PENDENTE' })
  ```
  ```sql
  ALTER TABLE solicitacoes_conta RENAME COLUMN senha TO senha_hash;
  UPDATE solicitacoes_conta SET senha_hash = NULL WHERE senha_hash NOT LIKE '$2%'; -- força redefinição
  ```

### C7 · Dependências com CVE crítica e correção já disponível
| Pacote | Instalado | Advisory crítico | Corrige em |
|---|---|---|---|
| `next` | 16.1.4 | GHSA-2xp9-vwfh-vxw4 e GHSA-2464-fhr4-w9xw (RCE sem login no Image Optimizer), GHSA-673q-mjm6-r5xr (RCE em `use cache`); mais 9 altas, entre elas bypass de middleware (GHSA-492v-c6pp-mqqv) | 16.4.5 |
| `next-auth` / `@auth/core` | 5.0.0-beta.30 | GHSA-8fpg-xm3f-6cx3 (checagem de `auth` falha aberta), GHSA-7rqj-j65f-68wh (bypass do normalizador de e-mail) | beta.31 ou mais nova |
| `@auth/prisma-adapter` | ≤2.11.2 | herdado do `@auth/core` | atualizar junto |

- **Regra do dono:** dependência com CVE crítica e correção disponível bloqueia a entrega.
- **Correção:** `npm i next@^16.4.5 eslint-config-next@^16.4.5 next-auth@latest @auth/prisma-adapter@latest`. Depois, rodar build e testes. A Engenharia faz isso.

---

## 2. Altas

### A1 · Recuperação de senha por CPF e data de nascimento
- **Local:** `src/lib/actions.ts:39-97`
- **Problemas:**
  - Os dados de verificação são fáceis de achar: são públicos via C1 e circulam em documentos internos.
  - A senha temporária volta na resposta para quem fez o pedido (`:96`).
  - A senha é gerada com `Math.random()` e tem 6 caracteres (`:84`).
  - Não há limite de tentativas.
  - As mensagens diferentes revelam se o e-mail existe e se o CPF confere (`:50,57,70`).
- **ASVS:** V2.5.1, V2.5.2, V2.2.1 e V2.5.6.
- **Como explorar:** com o CPF e a data de nascimento da vítima, o atacante recebe na tela uma senha válida da conta dela.
- **Correção:** enviar um link de uso único para o `email_corporativo`.
  ```ts
  const token = crypto.randomBytes(32).toString('base64url')
  await supabase.from('reset_tokens').insert({ user_id, token_hash: sha256(token), expira_em: addMinutes(new Date(), 30) })
  await enviarEmail(colab.email_corporativo, `${APP_URL}/redefinir-senha?t=${token}`)
  return { success: true, message: 'Se os dados conferirem, você receberá um e-mail.' } // resposta única
  ```
  Somar a isso um limite por IP e por e-mail: 5 tentativas a cada 15 minutos.

### A2 · Rotas de API sem `auth()`
O middleware exclui `/api` (`src/middleware.ts:8`). Rotas sem checagem:
| Rota | Arquivo:linha | Impacto |
|---|---|---|
| `GET /api/flags` | `src/app/api/flags/route.ts:4` | lista as ocorrências de todos os membros, com nome (dado de RH) |
| `DELETE /api/flags` | `flags/route.ts:20` | qualquer pessoa apaga ocorrências e punições |
| `GET /api/membros` | `src/app/api/membros/route.ts:4` | e-mail, cargo, pontos e milhas dos pré-cadastros |
| `GET /api/pipj/preview` | `src/app/api/pipj/preview/route.ts:96` | prévia da remuneração de todos os membros |
| `GET /api/monday/projects` | `src/app/api/monday/projects/route.ts:7` | dispara a sincronização com gravação (DoS e cota do Monday) |
| `GET /api/monday/alocacoes?dryRun=false` | `src/app/api/monday/alocacoes/route.ts:9-13` | grava os projetos dos colaboradores; além disso, um GET que altera dados facilita CSRF |

- **Correção:**
  - Adicionar um guard em cada rota: `exigirTier(3)` em flags DELETE, membros e monday; `exigirAcessoPipj()` em preview.
  - Trocar os GET que gravam por POST.
  - Como defesa extra, incluir `/api` no matcher do middleware. Só ficam de fora `/api/auth` e `/api/slack/interactions`, que usa HMAC.
  ```ts
  matcher: ['/((?!api/auth|api/slack/interactions|_next/static|_next/image|.*\\.png$).*)'],
  ```

### A3 · XSS armazenado em títulos e descrições de formulários
- **Local:**
  - `src/app/(dashboard)/forms-management/page.tsx:85`
  - `src/app/(dashboard)/formularios/page.tsx:556,710`
  - `src/components/forms/pergunta-input.tsx:48`
  - `src/components/forms/rich-text-input.tsx:33`
  - O HTML vem da tabela `formularios`, que o anon pode gravar (C1, `20260319_create_forms_tables.sql:57-58`).
- **OWASP:** A03. **ASVS:** V5.3.3.
- **Como explorar:**
  1. Gravar `descricao = '<img src=x onerror="fetch(\'/api/colaboradores/update\',{method:\'PUT\',...})">'` com a chave anon.
  2. O admin abre `/formularios` e o script roda na sessão dele.
  3. O script dá acesso a outra conta ou mexe em saldos. O cookie é HttpOnly, mas as requisições saem autenticadas do mesmo jeito.
- **Correção:** sanitizar com uma allowlist (`b`, `i`, `strong`, `em`, `br`) na hora de gravar e na hora de exibir.
  ```tsx
  import DOMPurify from 'isomorphic-dompurify'
  const SAFE = { ALLOWED_TAGS: ['b','i','strong','em','br'], ALLOWED_ATTR: [] }
  <p dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(form.descricao ?? '', SAFE) }} />
  ```
  O caso de `minhas-prioridades/components/icons.tsx:53` não é vulnerável, porque o SVG é uma constante local.

### A4 · Condição de corrida na aprovação de saque
- **Local:** `src/app/api/pipj/saque/route.ts`. O status é checado em `:60`, o saldo é lido em `:84` e gravado em `:92-95`, e o status só muda em `:164`. Nada disso é atômico.
- **OWASP:** A04. **ASVS:** V11.1.6.
- **Como explorar:** dois cliques ou duas abas aprovam o mesmo saque ao mesmo tempo. O saldo é debitado duas vezes, ou fica negativo quando há dois saques simultâneos, e o webhook de pagamento dispara duas vezes.
- **Correção:** fazer uma única função no banco, com trava de linha.
  ```sql
  CREATE OR REPLACE FUNCTION aprovar_saque(p_id uuid, p_por text) RETURNS void LANGUAGE plpgsql AS $$
  DECLARE s solicitacoes_saque; BEGIN
    SELECT * INTO s FROM solicitacoes_saque WHERE id = p_id AND status = 'PENDENTE' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'ja_processada'; END IF;
    UPDATE colaboradores SET saldo_pipj = saldo_pipj - s.valor
      WHERE id = s.colaborador_id AND saldo_pipj >= s.valor;
    IF NOT FOUND THEN RAISE EXCEPTION 'saldo_insuficiente'; END IF;
    INSERT INTO transacoes_pipj(colaborador_id, valor, tipo, descricao, data) VALUES (s.colaborador_id, s.valor, 'SAIDA', 'Saque Aprovado', now());
    UPDATE solicitacoes_saque SET status='APROVADO', data_aprovacao=now(), aprovado_por=p_por WHERE id=p_id;
  END $$;
  ```
  Chamar com `supabase.rpc('aprovar_saque', …)` e enviar o webhook só depois que o commit der certo. Aplicar o mesmo em `saque/reverter`.

### A5 · Login sem limite de tentativas e sessão que não é revalidada
- **Local:**
  - `src/auth.ts:32-92`: não há limite de tentativas nem bloqueio.
  - `src/auth.ts:13-19`: `role` e `colaborador_id` ficam gravados no JWT, que dura 30 dias por padrão. Se a pessoa é desligada ou rebaixada, ela continua com acesso até o token expirar.
- **ASVS:** V2.2.1, V3.3.1 e V3.3.2.
- **Como explorar:** força bruta de senha (a política aceita 6 caracteres, `profile-card.tsx:102`). Ou um membro desligado continua chamando as rotas de API.
- **Correção:**
  ```ts
  session: { strategy: 'jwt', maxAge: 8 * 60 * 60 },
  async jwt({ token, user }) {
      if (user) { ...; token.checadoEm = Date.now() }
      if (Date.now() - (token.checadoEm as number ?? 0) > 5 * 60_000) {
          const { data } = await createServerSupabaseClient().from('users')
              .select('role, colaboradores(status)').eq('id', token.id).single()
          if (!data || (data as any).colaboradores?.status === 'Desligado') return null
          token.role = data.role; token.checadoEm = Date.now()
      }
      return token
  },
  ```
  Somar um limite de tentativas por IP e e-mail (por exemplo, `@upstash/ratelimit` ou uma tabela `login_tentativas`) e exigir senha de 12 caracteres ou mais.

### A6 · `xlsx` 0.18.5 lendo arquivos enviados pelo usuário
- **Local:** `src/components/import-nps-dialog.tsx:9`
- **Advisories:** GHSA-4r6h-8v6p-xvw6 (prototype pollution) e GHSA-5pgg-2g8v-p4x9 (ReDoS). O npm não tem versão corrigida.
- **Como explorar:** uma planilha maliciosa importada por um gestor polui `Object.prototype` no navegador dele e pode alterar a lógica do cliente.
- **Correção:** trocar pela versão oficial da SheetJS, que tem a correção, ou por `exceljs`.
  ```bash
  npm i https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz
  ```

---

## 3. Médias

| ID | Local | Problema e como explorar | Correção |
|---|---|---|---|
| M1 | `src/app/api/colaboradores/update/route.ts:71-72` | **Mass assignment:** o `...rest` de `updateObj` vai inteiro para o `update`. Quem tem o tier 1 altera `status`, `email_corporativo`, `cpf` e outras colunas fora da lista. | Usar uma allowlist por tier: `const PERMITIDOS_T1 = ['telefone','endereco',...]; pick(rest, PERMITIDOS_T1)`. Validar com zod. |
| M2 | `colaboradores/update/route.ts:153-161` | **Auditoria forjada:** `editado_por`, `valor_antigo` e `valor_novo` vêm do cliente. | Montar o log no servidor: `editado_por = session.user.email` e `valor_antigo = alvo[campo]`. |
| M3 | `src/lib/admin-actions.ts:234` | **Injeção de filtro PostgREST:** `.or(\`colaborador_id.eq.${colaboradorId},…\`)`. Um `colaboradorId` como `x),id.not.is.null,(` apaga todas as respostas de formulários. | Validar o UUID antes e usar duas consultas `.eq()` em vez de `.or()` com interpolação. |
| M4 | `src/app/(dashboard)/miles-management/components/addition-requests.tsx:48`; `src/app/api/pipj/saque/route.ts:141` | **Webhooks do n8n sem autenticação.** O primeiro está no bundle do navegador, então qualquer pessoa manda notificações "Aceito" falsas. | Chamar só pelo servidor, com a URL em `N8N_WEBHOOK_*` e o cabeçalho `X-Signature` com HMAC. No n8n, validar a assinatura. |
| M5 | `src/app/api/pipj/saque/route.ts:140`; `src/auth.ts:43,55,59,63,80` | **Dados pessoais em log:** a chave PIX, o telefone e o e-mail vão para o log, e o login registra o e-mail digitado (LGPD, art. 46; ASVS V7.1.1). | Tirar esses `console.log` ou mascarar os dados (`a***@dominio`). |
| M6 | `src/app/api/feedback-agent/route.ts:170,240-248`; `src/app/api/assistente-pessoal/route.ts:193,243-249` | **Histórico do chat controlado pelo cliente:** o cliente manda até mensagens com `role: 'assistant'` e não há limite de tamanho. Isso abre injeção de prompt e gasto alto com a Anthropic. | Aceitar no máximo 20 mensagens de até 4.000 caracteres e checar que o `role` está em `['user','assistant']`. Ter um limite por usuário e por minuto. |
| M7 | `zod` <4.6.6 (GHSA-mrhx-c7xc-m3w5), `ws` 8.x, `nanoid` ≤3.3.17, `postcss`, `sharp`, `source-map-js` | **Dependências transitivas altas, todas com correção.** | Rodar `npm audit fix` depois da atualização do Next (C7). |

---

## 4. Baixas

| ID | Local | Problema | Correção |
|---|---|---|---|
| B1 | `flags/route.ts:14,35`; `membros/route.ts:14`; `colaboradores/update/route.ts:108,149` | Devolve `error.message` do banco para o cliente, o que revela o schema. | Devolver uma mensagem genérica e registrar o detalhe só no servidor. |
| B2 | `src/app/api/reunioes/presenca/route.ts:83-90` | O limite de tentativas do código de 6 dígitos fica na memória de cada instância. Em serverless, ele zera a cada instância. | Guardar as tentativas no banco ou no Redis. |
| B3 | `next.config.ts:3-5` | Não há cabeçalhos de segurança (CSP, `frame-ancestors`, HSTS). O detalhe fica com EMÍLIO (e3). | Usar `headers()` com CSP e `X-Frame-Options: DENY`. |

---

## 5. O que está correto
- **Slack:** a assinatura HMAC é conferida com `timingSafeEqual` e uma janela de 5 minutos (`src/lib/slack.ts:62-70`).
- **Redirect pós-login:** só aceita caminhos internos (`src/lib/actions.ts:34-36`).
- **Reversões de PIPJ:** `pipj/reverter`, `pipj/saque/reverter` e `pipj/saque` exigem login e permissão.
- **Assistente pessoal:** só usa o ID da sessão (`assistente-pessoal/route.ts:186-189`). O feedback-agent limita a escolha de outra pessoa a admin, gerente e assessor de GP.
- **IDOR:** `pdi/solicitacoes/[id]`, `pdi/banco/[id]` e `reunioes/[id]` checam o dono do registro ou o perfil.
- **Hash de senha:** usa bcrypt com custo 10. É aceitável, mas a recomendação é subir para 12.
- **SQL:** não há SQL montado com texto. Tudo passa pelo query builder do Supabase. A única exceção é M3.

## 6. Ordem de correção sugerida para a Engenharia
1. **C5:** trocar as credenciais. Precisa de aprovação do dono.
2. **C1 + C6:** chave de servidor, migration de RLS e cadastro pelo servidor.
3. **C2, C3, C4 e A2:** guards em todas as Server Actions e rotas.
4. **C7 e A6:** atualizar as dependências.
5. **A1, A3, A4 e A5.**
6. **Médias e baixas.**

Cada correção crítica ou alta precisa de um teste que reproduza o ataque e espere 401, 403 ou 409. A Cyber segurança verifica de novo antes de liberar.
