This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Slack — momentos de desenvolvimento (PDI)

Quando um membro solicita um momento, o pedido aparece no canal Slack dos
táticos com os botões **Aceitar** e **Sugerir outro horário** (mesmas regras
da tela `/pdi`). A mensagem é atualizada a cada mudança; a resposta do membro
à sugestão continua sendo feita na Área do Membro.

Configuração:

1. Criar um Slack App com os scopes `chat:write`, `users:read`,
   `users:read.email` e instalar no workspace.
2. Em *Interactivity & Shortcuts*, ativar e usar como Request URL
   `https://<app>/api/slack/interactions`.
3. Convidar o bot para o canal (`/invite @app`).
4. Variáveis de ambiente: `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET`,
   `SLACK_CHANNEL_ID` (ID do canal, ex. `C0123456789`) e `NEXT_PUBLIC_APP_URL`.
5. Rodar a migração `supabase/migrations/20260930_pdi_slack_interativo.sql`.

O e-mail do perfil do Slack precisa ser igual ao `email_corporativo` do
colaborador. Sem `SLACK_BOT_TOKEN`, cai no modo antigo (`SLACK_WEBHOOK_URL`,
só aviso, sem botões).

## Google Agenda — momentos de desenvolvimento (PDI)

Quando o Google Agenda está configurado, cada momento cria um evento direto na
agenda de quem pediu; quando um líder aceita, o evento também entra na agenda
dele. Pedidos de novo horário aceitos movem os eventos; cancelamentos os
removem. Sem a configuração abaixo, nada muda (a integração é ignorada).

Configuração (precisa ser admin do Google Workspace):

1. No Google Cloud Console, criar um projeto e ativar a **Google Calendar API**.
2. Criar uma **conta de serviço** e gerar uma chave **JSON**. Anotar o
   *Client ID* (número) da conta de serviço.
3. No Admin Console do Workspace → Segurança → Controles de API →
   **Delegação em todo o domínio** → Adicionar: informar o Client ID e o escopo
   `https://www.googleapis.com/auth/calendar.events`.
4. Variável de ambiente `GOOGLE_SERVICE_ACCOUNT_JSON` com o conteúdo inteiro do
   JSON (ou `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_PRIVATE_KEY`).
5. Rodar a migração `supabase/migrations/20261006_pdi_agenda_google.sql`.

O e-mail usado é o `email_corporativo` do colaborador, que precisa ser uma
conta do mesmo domínio do Workspace.

## Repasses do PDI (tático oferece um momento)

A "logística inversa" do pedido de momento: um tático (gerente) ou o diretor cria um
repasse em **PDI → Repasses** (ex.: formulação de cronograma), com data, hora, duração,
prazo de adesão e vagas (opcional). O repasse é anunciado no canal do Slack dos
repasses com os botões **Quero participar** e **Sair**. Depois do prazo, o responsável
clica em **Confirmar e adicionar ao Google Agenda**: o evento é criado com todos os
que entraram como convidados.

Configuração:

1. Criar o canal no Slack (ex.: `#repassespdi`) e convidar o bot (`/invite @<bot>`).
2. Variável de ambiente `SLACK_REPASSES_CHANNEL_ID` com o ID do canal (além das variáveis
   do Slack já descritas acima).
3. Rodar a migração `supabase/migrations/20261013_pdi_repasses.sql`.
4. Google Agenda automático: mesma configuração da seção "Google Agenda" (conta de serviço
   com delegação). Sem ela, o repasse é confirmado do mesmo jeito e a tela mostra o botão
   "Adicionar ao Google Agenda", que abre o Google Agenda já com os convidados preenchidos.

## Reembolso de gasolina (Monday)

A página `/gasolina` lê a lista de projetos (e, nas próximas fases, cria os
cards de reembolso) no board **Processos de Pagamento** do Monday.

- `MONDAY_PAGAMENTOS_API_TOKEN`: token pessoal do Monday de uma conta que
  participa do board Processos de Pagamento com permissão de edição (gerado
  em foto de perfil → Developers → My access tokens). Sem ela, usa
  `MONDAY_API_TOKEN`, cuja conta pode não enxergar esse board — o Monday
  responde como se o board não existisse.
- `MONDAY_PAGAMENTOS_BOARD_ID` (opcional): padrão `9011987674`.
- `GASOLINA_INTEGRACAO_TOKEN`: senha (texto longo e aleatório) que a automação
  do n8n envia para consultar os pedidos feitos pelo app.

### Solicitação de reembolso e automação do n8n

O botão "Solicitar reembolso" cria o card no board já preenchido (tipo
REEMBOLSO, centro de custo, projeto, categoria Gasolina, valor, Pix, e-mail) e
comenta nele o extrato das viagens. O título do card termina com
"(Área do Membro)". A automação "AUTOMAÇÃO PAGAMENTO VP" desvia esses cards
(IF logo após "PIPJ?", antes de "CENTRO DE CUSTO") e chama, em vez de ler a
planilha:

```
POST https://areadomembro.produtivajunior.com.br/api/gasolina/integracao/validar
Authorization: Bearer <GASOLINA_INTEGRACAO_TOKEN>
{ "monday_item_id": "<id do card>", "valor": "<coluna VALOR>" }
```

- `{ "origem": "planilha" }` → card não veio do app: segue o fluxo antigo.
- `{ "origem": "app", "aprovado": true }` → mudar o status para APROVADO.
- `{ "origem": "app", "aprovado": false, "motivo": "..." }` → RECUSADO e avisar o membro.

O app marca "Aprovado" na hora em que responde aprovado ao n8n e acompanha o status do card a cada 2 minutos (ou no botão "Atualizar" da aba Solicitações) (APROVADO → LANÇADO → PAGO;
RECUSADO devolve as viagens para pendentes).

Recusa: as viagens continuam vinculadas à solicitação recusada e aparecem
como "Recusada" (com o motivo) até o membro clicar em "Retomar viagens"
(`POST /api/gasolina/solicitacoes/[id]/retomar`) — aí voltam a Pendente para
corrigir e solicitar de novo; as que passaram do prazo de 2 meses viram Vencido.

Km travados: depois de "Calcular km pelo Google Maps", a distância não pode
mais ser alterada (o servidor recalcula a rota ao salvar e grava os km dela,
`rota.km_google`). Antes do cálculo, o membro pode digitar. Mudar o trajeto
destrava.

Carro invalidado (migração `20261110_gasolina_invalidar_carro.sql`): a VP
invalida o carro de um membro em caso de tentativa de fraude, com motivo
(`/api/gasolina/veiculos/[id]/invalidar`, POST invalida, DELETE reativa). O
carro não serve para novas viagens, as pendentes feitas com ele ficam fora
das solicitações e não podem ser editadas; o membro vê o motivo.

### Avisos ao membro a cada status (e-mail + WhatsApp)

A cada mudança de status de uma solicitação (Solicitado, Aprovado, Lançado,
Pago, Recusado — inclusive recusa manual no Monday), o app monta as mensagens
(`src/lib/gasolina-avisos.ts`) e faz POST na URL `GASOLINA_AVISOS_WEBHOOK_URL`
(padrão: `https://n8n.produtivajunior.com.br/webhook/avisos-reembolso-gasolina`,
gatilho "Aviso do app" da automação "AUTOMAÇÃO PAGAMENTO VP"; `-` desliga), com
`Authorization: Bearer GASOLINA_INTEGRACAO_TOKEN`. Corpo: `status`, `membro`
(`nome`, `email`, `whatsapp` com 55), `assunto_email`, `mensagem_email` (HTML) e
`mensagem_whatsapp`. O WhatsApp usa o
telefone do cadastro do membro.

Status instantâneo: no board Processos de Pagamento, uma integração do Monday
"Quando o status mudar, enviar um webhook" (coluna de status do kanban) apontando
para `https://areadomembro.produtivajunior.com.br/api/gasolina/integracao/monday-status`.
O app responde o desafio do Monday, lê o status de novo na API (o corpo só diz
qual card mudou) e avisa o membro na hora. A sincronização a cada minuto fica de
reserva.

Aprovação de carro (migração `20261112_gasolina_aprovar_carro.sql`): carro
novo fica "Aguardando aprovação" e não serve para lançar viagens até a VP
aprovar em "Carros dos membros" (`POST /api/gasolina/veiculos/[id]/aprovar`).
Os carros que já existiam quando a migração rodou entram aprovados.

### Importação da planilha antiga (uma vez)

Aba "Importar planilha" (só gestão da gasolina): escolher o .xlsx baixado da
planilha "REEMBOLSO GASOLINA". O arquivo é lido no navegador; a API
(`/api/gasolina/importacao`) primeiro simula e mostra o relatório, e só grava ao
confirmar. Entram as viagens de todas as datas das abas visíveis, de quem tem
cadastro (aba casada pelo nome; a VP pode corrigir na tela), sem carros nem
autonomia (litros da planilha), e os preços de mês ainda não lançados. Viagens
sem data ou com data digitada errado ficam de fora. Quem já foi importado é
pulado — pode rodar de novo.

### Google Maps no lançamento de viagens (opcional)

Com a variável `GOOGLE_MAPS_API_KEY` configurada no servidor (Coolify, runtime),
o formulário de viagem passa a sugerir endereços enquanto o membro digita
(Places API New — Autocomplete) e ganha o botão "Calcular km pelo Google Maps"
(Routes API — Compute Routes, com paradas e opção ida e volta). Ao salvar, o
servidor guarda a rota em `gasolina_viagens.rota` para conferência; os km que
valem para o reembolso continuam sendo os informados, e a Visão geral destaca
os que fogem muito da rota. Sem a variável, nada muda.

A chave fica só no servidor (as chamadas passam por `/api/gasolina/mapas/*`).
No Google Cloud: ativar "Places API (New)" e "Routes API", restringir a chave a
essas duas APIs e definir cotas diárias (ex.: 300 por dia em cada) para não
sair da faixa gratuita (10.000 usos/mês por API).

## Pagamentos e Reembolsos — formulário próprio (substitui o WorkForms do Monday)

A página `/pagamentos/solicitar` tem um formulário do próprio portal. As
respostas e os comprovantes ficam no Supabase do portal, sem passar pelo
Monday. Perguntas, opções e regras condicionais ficam em
`src/lib/pagamentos-formulario.ts` (itens "A CONFIRMAR" ainda precisam ser
conferidos com o formulário original).

### Configuração (uma vez)

1. Rodar a migração `supabase/migrations/20261113_pagamentos_solicitacoes.sql`
   (SQL Editor do Supabase). Ela só cria tabelas novas (`pagamentos_solicitacoes`,
   `pagamentos_anexos`, `pagamentos_eventos`) e o bucket **privado**
   `pagamentos-comprovantes`.
2. No Coolify, criar as variáveis (sem o prefixo `NEXT_PUBLIC_`):
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase → Project Settings → API →
     `service_role`. **Chave mestra: nunca colar em chat, código ou lugar
     público.** Só o servidor usa (as tabelas novas recusam a chave anon).
   - `PAGAMENTOS_INTEGRACAO_TOKEN`: senha longa e aleatória (mínimo 32
     caracteres) que o n8n usa nas chamadas ao portal e que o portal envia ao
     n8n. Ex.: `openssl rand -hex 32`.
   - `PAGAMENTOS_N8N_WEBHOOK_URL` (opcional): URL do Webhook do n8n que deve
     receber cada nova solicitação. Sem ela, o n8n busca pela lista de pendentes.
3. **Fase de testes:** com a chave configurada, só membros do núcleo Vice
   Presidência e administradores veem o formulário próprio (com o aviso
   "Versão em teste"); os demais continuam no WorkForms, e o envio próprio
   responde 403 para eles. Para abrir a todos: `PAGAMENTOS_FORMULARIO_LIBERADO=todos`
   no Coolify e publicar de novo.
4. Enquanto `SUPABASE_SERVICE_ROLE_KEY` não estiver configurada, a página continua
   mostrando o WorkForms do Monday (os membros nunca ficam sem formulário).
   Reversão manual: `NEXT_PUBLIC_PAGAMENTOS_FORMULARIO=monday` volta a mostrar o
   WorkForms do Monday no mesmo lugar (precisa publicar de novo).

### Listas editáveis pela VP (categorias, eventos MEJ, projetos)

Migração `supabase/migrations/20261114_pagamentos_opcoes.sql` (rodar depois da
20261113): cria `pagamentos_opcoes` (RLS sem políticas) com as listas da
planilha "VP Categorias" e os projetos **ativos** da tabela `projetos`, e
acrescenta a coluna `projeto` em `pagamentos_solicitacoes`.

- No formulário, VP e administradores veem o botão **Gerenciar opções do
  formulário**: adicionar, renomear, ocultar/mostrar e reordenar opções de cada
  lista. Vale na hora, inclusive na validação do envio no servidor.
- Ocultar não apaga: as solicitações antigas guardam o texto escolhido.
- Lista vazia → a pergunta vira texto livre.
- Consultorias/Assessorias pede **o que foi o gasto** (categoria de execução)
  e **o projeto** (lista "Projetos").
- API: `GET/POST /api/pagamentos/opcoes`, `PATCH /api/pagamentos/opcoes/<id>`.
- Se a tabela não existir ainda, o formulário usa as listas do código.

### Integração com o n8n

Todas as chamadas usam `Authorization: Bearer <PAGAMENTOS_INTEGRACAO_TOKEN>`.

**Aviso de nova solicitação (portal → n8n).** Logo depois do envio, o portal faz
`POST <PAGAMENTOS_N8N_WEBHOOK_URL>` com o cabeçalho
`Idempotency-Key: pagamento-<id>` e o corpo:

```json
{
  "evento": "solicitacao.criada",
  "solicitacao": { "id": "...", "numero": 12, "tipo": "PAGAMENTO", "valor": 1250.9,
                   "centro_custo": "VP", "categoria": "Workday", "forma_pagamento": "...",
                   "dados_bancarios": "...", "descricao": "...", "fornecedor": "...",
                   "chave_pix": null, "eh_pipj": false, "eh_retirada_milha": false,
                   "tipo_retirada_milha": null, "evento_mej": null, "gasto_evento_mej": null, "projeto": null,
                   "categoria_execucao": null, "outra_categoria": null,
                   "status_processamento": "recebida", "criado_em": "...", "...": "..." },
  "solicitante": { "colaborador_id": "...", "nome": "...", "email": "..." },
  "anexos": [{ "campo": "comprovante", "nome": "nota.pdf", "tipo_mime": "application/pdf",
               "url": "<link temporário, 1 h>", "url_expira_em": "..." }],
  "links": { "consultar": "...", "atualizar_processamento": "..." }
}
```

Se o n8n não responder 2xx, a solicitação fica `erro_envio` (com o motivo em
`n8n_ultimo_erro`) e continua salva.

**Consultas (n8n → portal).**

- `GET /api/pagamentos/integracao/solicitacoes?status=recebida,erro_envio&limite=50`
  — pendentes (padrão), mais antigas primeiro. Use num gatilho agendado como
  rede de segurança do webhook.
- `GET /api/pagamentos/integracao/solicitacoes/<id>?historico=1` — tudo da
  solicitação, com links novos dos comprovantes (para a validação por IA) e o histórico.

**Resultados (n8n → portal).** `POST /api/pagamentos/integracao/solicitacoes/<id>/processamento`

```json
{ "chave_idempotencia": "<id da execução>-<etapa>",
  "etapa": "google_agenda",
  "status_processamento": "em_processamento",
  "detalhes": { "eventos_pj": 2 },
  "erro": null }
```

- `status_processamento`: `em_processamento`, `aguardando_aprovacao`,
  `erro_processamento`, `aprovada`, `recusada`.
- Decisão final: `{ "chave_idempotencia": "...", "decisao": "aprovada", "decidido_por": "Fulano (Slack)" }`
  ou `"recusada"` com `"motivo"` (obrigatório). Depois de decidida, não muda (409).
- Repetir a mesma `chave_idempotencia` não registra de novo (`"repetido": true`).
- Tudo fica em `pagamentos_eventos` (envios, etapas, erros).

As verificações (Google Agenda, eventos [PJ], auxílio-alimentação, Workday/SDR,
IA nos comprovantes, e-mail, Slack, regras financeiras) continuam no n8n. O
fluxo "AUTOMAÇÃO PAGAMENTO VP" ainda lê do Monday e precisa ser adaptado e
testado antes de desligar o WorkForms. O campo `kanban_item_id` fica reservado
para o futuro Kanban financeiro.

Testes das regras do formulário: `npm run test:pagamentos`.
