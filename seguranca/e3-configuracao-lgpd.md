# Configuração, testes não destrutivos e LGPD — Área do Membro

- **Etapa:** e3 · EMÍLIO (Pentest/Conformidade) · 2026-11-03
- **Base:** OWASP Top 10 (2021), OWASP ASVS 4.0.3 e LGPD
- **Escopo:** verificação **passiva e não destrutiva** do site publicado `https://areadomembro.produtivajunior.com.br` (IP `148.230.72.132`), mais análise da configuração do repositório. Nenhum teste ativo de invasão, nenhum uso de chave, nenhuma escrita e nenhuma consulta ao banco de produção foram feitos.
- **Regra deste relatório:** nenhum segredo, senha, chave ou dado real de cliente aparece aqui. Só arquivo, linha, cabeçalho e código de resposta.
- **Método:** `curl` (apenas cabeçalhos e códigos HTTP), `openssl s_client`, `dig`, download do bundle público de JS (análise estática, sem extrair valores de chaves). Agente HTTP identificado como `pj-office-security-review`.

## 1. Resumo

| Área | Resultado |
|---|---|
| HTTPS / redirecionamento | **OK** — HTTP 302 → HTTPS |
| TLS | **OK** — TLS 1.3; TLS 1.0 e 1.1 recusados; certificado Let's Encrypt válido até 22/12/2026 |
| Cookies de sessão | **OK** — `HttpOnly`, `Secure`, `SameSite=Lax`, prefixos `__Host-`/`__Secure-` |
| Cabeçalhos de segurança | **FALHA** — nenhum presente (E3-01) |
| CORS | **OK** — não reflete origem externa |
| Mensagens de erro | **OK** — genéricas, sem stack trace |
| Source maps | **OK** — `.map` retorna 404 |
| Arquivos sensíveis expostos | **OK** — `.env`, `.git`, scripts e backups não são servidos (307 → login) |
| Exposição de infraestrutura | Ressalvas — `x-powered-by` (E3-04) e porta 22/SSH aberta (E3-03) |
| RLS / grants do banco | **NÃO VERIFICADO** — projeto de produção não conectado a esta sessão (ver §5) |
| LGPD | **FALHA** — sem consentimento, sem política, sem canal do titular (E3-02, E3-05, E3-06) |

## 2. O que passou (evidência)

- **Redirecionamento forçado para HTTPS:** `GET http://…/` → `302 Found` com `Location: https://…/`.
- **TLS:** handshake negocia `TLSv1.3` (`AEAD-CHACHA20-POLY1305-SHA256`); tentativas em `-tls1` e `-tls1_1` recebem `alert protocol version` (recusadas). Certificado: `CN=areadomembro.produtivajunior.com.br`, emissor Let's Encrypt, `notAfter=Dec 22 21:12:16 2026 GMT`.
- **Cookies:** na resposta da raiz e do `/login` —
  `__Host-authjs.csrf-token … Path=/; HttpOnly; Secure; SameSite=Lax`
  `__Secure-authjs.callback-url … Path=/; HttpOnly; Secure; SameSite=Lax`.
  Configuração correta (ASVS V3.4).
- **CORS:** requisições com `Origin: https://evil.example` (GET e `OPTIONS` de preflight) em `/api/auth/session` e `/api/auth/providers` **não** retornam nenhum `Access-Control-Allow-Origin`. Não é permissivo.
- **Erros:** rota de auth inválida retorna `400` com corpo `"Bad request."`; página inexistente cai no `307` → login. Sem vazamento de stack ou caminho.
- **Arquivos do repositório não são servidos:** `/.env`, `/.env.local`, `/.env.production`, `/.git/HEAD`, `/.git/config`, `/run-migration.js`, `/test_monday.js`, `/database.db`, `/backup.sql`, `/backup.zip`, `/nps-exemplo.csv`, `/nps-gerente.csv` — todos `307` (redirecionados ao login, não entregues). Bom.

## 3. Achados de configuração

### E3-01 · Nenhum cabeçalho de segurança HTTP — ALTA
- **Onde:** resposta de `https://areadomembro.produtivajunior.com.br/login` e `/`; origem em `next.config.ts` (vazio, sem `headers()`).
- **Evidência:** a resposta não traz `Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` nem `Permissions-Policy`.
- **Como explora:** sem `X-Frame-Options`/`frame-ancestors` → clickjacking da sessão do membro. Sem HSTS → downgrade para HTTP na primeira visita (man-in-the-middle). Sem CSP → qualquer XSS armazenado (ver T10 em e1, rich text) executa sem contenção. Sem `X-Content-Type-Options` → MIME sniffing.
- **Correção:** definir os cabeçalhos no `next.config.ts` (`async headers()`), incluindo `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload`, `Content-Security-Policy` com allowlist, `X-Frame-Options: DENY` (ou `frame-ancestors 'none'` na CSP), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` mínima. Correção pela Engenharia (fecha T15 da e1). Verificação pela Qualidade.

### E3-03 · Porta 22 (SSH) aberta na internet — MÉDIA
- **Onde:** host `148.230.72.132` (destino de `areadomembro.produtivajunior.com.br`). O site é auto-hospedado nesse IP, **não** na Vercel (suposição a partir do IP e dos cabeçalhos; difere do que o README sugere).
- **Evidência:** teste de conexão TCP (`nc -z`) na porta 22 teve sucesso. Nenhuma tentativa de login foi feita.
- **Como explora:** superfície para força bruta/credential stuffing no SSH do servidor que hospeda o portal e, provavelmente, dados pessoais.
- **Correção:** restringir a porta 22 por firewall a IPs/VPN de administração; exigir chave (sem senha); considerar fail2ban. Ação de Infraestrutura, com o dono.

### E3-04 · Cabeçalho `x-powered-by: Next.js` — BAIXA
- **Onde:** todas as respostas HTTP.
- **Evidência:** `x-powered-by: Next.js`.
- **Como explora:** revela a stack, facilitando o direcionamento de exploits conhecidos.
- **Correção:** `poweredByHeader: false` no `next.config.ts`.

## 4. Achados de LGPD

### E3-02 · Cadastro coleta dados pessoais sem consentimento nem aviso de privacidade — ALTA
- **Onde:** `/signup` (`src/app/(auth)/signup/signup-form.tsx`).
- **Evidência:** a página coleta CPF (`000.000.000-00`), data de nascimento, telefone, endereço (`Rua...`), e-mail pessoal e matrícula. A busca por `privacidade|consentimento|lgpd|aceito|concordo|termos|tratamento de dados` no HTML entregue retornou **zero** ocorrências. Não há caixa de consentimento nem link para política.
- **LGPD:** arts. 8º e 9º (consentimento informado) e 6º (finalidade e transparência).
- **Correção:** incluir no cadastro o aviso de privacidade com finalidade, base legal e retenção, e registrar o consentimento (data/hora/versão). Produto define o texto; Engenharia implementa (fecha T18 da e1).

### E3-05 · Não há política de privacidade pública — ALTA (LGPD)
- **Onde:** site publicado.
- **Evidência:** `/privacidade`, `/politica-de-privacidade` e `/termos` retornam `307` → login (não existem como páginas públicas).
- **LGPD:** art. 9º — o titular tem direito a informação clara sobre o tratamento antes de fornecer os dados.
- **Correção:** publicar política de privacidade acessível sem login, ligada ao cadastro e ao rodapé.

### E3-06 · Sem canal do titular (acesso/correção/exclusão) — MÉDIA
- **Onde:** site e repositório.
- **Evidência:** nenhuma página ou endpoint público para o titular exercer direitos (confirmar/acessar, corrigir, eliminar dados). A exclusão existente (`src/lib/admin-actions.ts:216`) é ação administrativa e, pela e1 (T3), está sem autenticação — não é um canal do titular.
- **LGPD:** art. 18 (direitos do titular) e art. 9º (identificação do encarregado/DPO).
- **Correção:** publicar canal de contato do encarregado e fluxo documentado para os pedidos do titular, com registro de atendimento.

**Referências cruzadas (código — tratadas por KIRA/e2):** senha de candidato em texto puro em `solicitacoes_conta` (T5) é também risco de proteção de dados; envio de dados pessoais à Anthropic (T12) exige base legal e registro de transferência internacional (LGPD art. 33).

## 5. O que NÃO foi testado (e por quê)

- **Policies RLS e grants do `anon` no banco de produção (T1, T5, T8 da e1):** o projeto Supabase de produção (host visível no bundle público; ref diferente do que aparece em `get_schema.ts`) **não está conectado** a esta sessão — o único projeto Supabase acessível aqui é `mirassol-erp`, de outro sistema. Não executei consulta alguma, nem de leitura, contra o banco de produção. **Recomendação:** rodar, apenas com leitura, `select … from pg_policies`, `relrowsecurity` em `pg_class` e `information_schema.role_table_grants` para o papel `anon`, e os Supabase Security Advisors, a partir do dashboard do projeto ou de um ambiente de homologação. Enquanto isso, a severidade crítica de T1 permanece.
- **Limite de requisições no login (T11):** exigiria POSTs repetidos contra produção (ativo). Pela regra do dono (testar só em homologação), não foi feito. Validar o rate limiting em homologação.
- **Backups:** não há visibilidade externa. Confirmar com a Infraestrutura a existência de backup automático, a criptografia em repouso e o teste de restauração.

## 6. Validação do projeto (sem alterar código)

| Comando | Resultado |
|---|---|
| `npm run test:pipj` | **passou** — 8/8 |
| `npm run build` | **passou** com variáveis de ambiente fictícias (sem elas, falha com erro de ambiente, como na e1); inclui a checagem de tipos |
| `npm run lint` | **falhou** — 515 erros, 66 avisos, **pré-existentes** (relatados na e1; a maioria `any`/`require()`). Correção é da Engenharia |

Não criei nem alterei código: esta etapa só adiciona o arquivo markdown `seguranca/e3-configuracao-lgpd.md`.

## 7. Parecer parcial (e3)

Mantém-se **BLOQUEADO**, alinhado à e1. Novos achados confirmados em produção: **E3-01 (alta)**, **E3-02 (alta)** e **E3-05 (alta)** bloqueiam a entrega até a correção ser verificada pela Qualidade. T1 (crítica) continua pendente de verificação de leitura no banco. Parecer final na e4 (OTTO).
