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
