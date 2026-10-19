# Reconhecimentos e Bonificações — implementação (Etapa 1)

Reconstrução fiel da aba do sistema antigo (pacote em `../migracao-reconhecimentos/`), **exclusiva da Vice Presidência e do ADMIN**.
Nada deste PR foi aplicado em produção: a migration e o rollback estão prontos, mas **não executados**.

## Onde está cada coisa

| Camada | Arquivos |
|---|---|
| Página (barreira no servidor) | `src/app/(dashboard)/reconhecimentos/page.tsx` |
| Interface | `src/app/(dashboard)/reconhecimentos/components/*`, `use-reconhecimentos.ts`, `src/components/ui/searchable-select.tsx` |
| Rotas de API (todas protegidas) | `src/app/api/reconhecimentos/**` (13 operações) |
| Guard de acesso | `src/lib/reconhecimentos/guard.ts` (wiring next-auth) + `acesso-servidor.ts` (decisão, testável) |
| Regra de acesso (fonte única) | `src/lib/access-control.ts` → `ROTAS_EXCLUSIVAS_VP`, `podeAcessarRotaExclusivaVP` |
| Motor (função pura) | `src/lib/reconhecimentos/engine.ts`, `datas.ts` |
| Dados do servidor | `src/lib/reconhecimentos/repositorio.ts`, `validacao.ts`, `src/lib/supabase-admin.ts` |
| Menu / guarda de rota | `src/components/app-sidebar.tsx`, `src/components/route-guard.tsx` |
| Banco | `supabase/migrations/20261019_reconhecimentos_bonificacoes.sql`, `supabase/rollbacks/20261019_reconhecimentos_bonificacoes_ROLLBACK.sql` |
| Testes | `tests/reconhecimentos/*` (ver abaixo) |

## Controle de acesso (4 camadas, todas com a mesma regra)

Autorizado = **ADMIN** (papel lido da tabela `users`) **ou** colaborador **ativo** com `nucleo_atual` = Vice Presidência (qualquer cargo; aceita a grafia legada com hífen).
**Não** libera: Estratégico/Diretor de outros núcleos, cargo "Administrador" de outro núcleo, `paginas_permitidas`, colaborador desligado.

1. **Menu**: o item só aparece se `paginaPermitida('/reconhecimentos')` (mesma função do `RouteGuard`).
2. **Rota**: `page.tsx` (servidor) chama o guard e faz `redirect('/')` antes de enviar o componente da aba; `RouteGuard` repete a checagem no cliente e ignora rota-pai implícita e `paginas_permitidas` para esta rota.
3. **API**: toda rota `/api/reconhecimentos/*` passa por `comAcessoReconhecimentos`: sem sessão → 401; sessão sem permissão → 403 — **antes** de qualquer consulta. Papel e vínculo vêm do **banco**, nunca do token (token de ex-ADMIN não vale).
4. **Dados**: tabelas novas com RLS ligado e **nenhuma policy**, sem GRANT para `anon`/`authenticated`. Só a service role (somente servidor) lê/grava.

`SUPABASE_SERVICE_ROLE_KEY` precisa existir no ambiente do **servidor**. Sem ela as rotas respondem `503 configuracaoPendente` (nunca caem para a chave anon).

## Motor e gatilhos

Roda **no servidor**, nos 4 gatilhos originais: abrir a aba (`POST /sincronizar`), registrar reconhecimento, ajustar RGs anteriores, salvar regra. Não roda ao excluir reconhecimento, salvar prazo padrão, criar tipo, entregar/cancelar. **Sem job diário** (fica para a etapa 2).

Correções técnicas permitidas (sem mudar o comportamento no Brasil): datas de calendário sem dependência de fuso; "hoje" e "mês atual" em `America/Sao_Paulo`; `INSERT … ON CONFLICT DO NOTHING` (duas sincronizações simultâneas não derrubam o lote); listagens paginadas (> 1000 linhas); campo de pesquisa que perdia o foco; entrega/cancelamento só a partir de `disponivel`/`expirada` também no servidor; expiração visível na hora.

## Diferenças em relação ao sistema antigo (documentadas)

* **Projetos**: o antigo usava centros de custo de *entrada* (categorias "consultoria/assessoria 2026" ou "mentoria"). Aqui usa-se a tabela `projetos` com `status = 'Ativo'` (mesma fonte dos formulários). Consequência: aparecem **todos** os projetos ativos do Monday, não só os atendidos em 2026. `projeto_id` segue sem FK; `projeto_nome` é snapshot.
* **Núcleos de Impacto**: lista própria de 7 (Gestão de Pessoas, Presidência, Vice-Presidência, Marketing, CIT, CIEP, CS), independente de `src/lib/nucleos.ts`.
* **Usuário** (`criado_por`, `entregue_por`, eventos): e-mail do usuário autenticado, lido da sessão no servidor (antes vinha do `localStorage`).
* **Sem TanStack Query**: o projeto não usa; a lista é recarregada após cada gravação.
* **Menu**: grupo próprio **"Vice Presidência"** (`vpItems` em `app-sidebar.tsx`), separado de "Gestão de Pessoas"; aparece só para quem tem acesso. As telas que a matriz já lista para a VP (`/pipj-management`, `/absences-management`, `/allocations-management`) **não foram movidas** de "Gestão de Pessoas" (não pedido; outras áreas também as usam).

## Como rodar os testes

```bash
npm run test:reconhecimentos                    # 43 testes (Node >= 22.15, sem dependências novas)
# inclui validação da migration em PostgreSQL real (PGlite, em memória):
mkdir /tmp/pg && (cd /tmp/pg && npm init -y && npm i @electric-sql/pglite)
PGLITE_MODULE=/tmp/pg/node_modules/@electric-sql/pglite/dist/index.js npm run test:reconhecimentos
npm run test:reconhecimentos:http               # next dev + sessões reais: 13 casos de autorização ponta a ponta
PLAYWRIGHT_MODULE=/opt/node-tools/node_modules/playwright \
  node --experimental-strip-types --import ./tests/reconhecimentos/loader.mjs tests/reconhecimentos/ui-smoke.mjs   # 15 casos no navegador
```

Nenhum teste toca em banco real: usam um Supabase simulado em memória, PGlite e um emulador local de PostgREST.

## Importação futura de dados históricos (P-7) — preparada, não executada

Ver `IMPORTACAO-HISTORICA.md`. Resumo: colunas de procedência (`origem`, `origem_id`, `importado_em`) + índice único parcial já estão na migration; importar é só `INSERT … ON CONFLICT DO NOTHING` (nunca altera registros novos); as `marco_chave` históricas devem ser **recalculadas** com as funções exportadas do motor.

### (nota original)

Não há importador (nada a inventar). A arquitetura já suporta: inserir linhas em `reconhecimentos` (com `criado_por`, `created_at` originais) e rodar `POST /api/reconhecimentos/sincronizar`; `marco_chave UNIQUE` + `ON CONFLICT DO NOTHING` impedem duplicidade, e para bonificações históricas já entregues, inseri-las em `bonificacoes` com a `marco_chave` que o motor geraria (`<regra_id>:rec:<id>` ou `<regra_id>:<sujeito>:<marco>`) evita que o motor as recrie.
