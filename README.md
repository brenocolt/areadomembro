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
