# Reconhecimentos e Bonificações — aba nova (Vice Presidência)

Rota `/reconhecimentos` · menu **Vice Presidência → Reconhecimentos e Bonificações** · exclusiva de **ADMIN** e **membros ativos da Vice Presidência**.

> Estado: implementada e testada em ambiente isolado. **A migration `supabase/migrations/20261020_reconhecimentos_bonificacoes.sql` NÃO foi aplicada em nenhum banco real e nada foi publicado.** Para colocar em funcionamento num único projeto Supabase, sem preview nem ambiente novo: `GUIA-APLICACAO.md` (backup → **dry-run que não grava nada** → migration → chave no Coolify → deploy → validação com dados `[TESTE]` → limpeza controlada).

## O que a aba faz
| Aba | Conteúdo |
|---|---|
| Visão Geral | 4 indicadores reais (liberadas no mês, disponíveis, entregues, canceladas/expiradas), filtros e tabela de bonificações recentes |
| Registrar | Lista de reconhecimentos; **+ Registrar** (formulário muda por tipo); **editar**, histórico por registro, exclusão lógica com motivo |
| Bonificações | Kanban Disponíveis / Entregues / Expiradas / Canceladas; clicar no cartão abre o painel de **entrega por colaborador** |
| Histórico | Linha do tempo de tudo (criações, edições, bonificações geradas, solicitações, aprovações, entregas), com autor e data |
| Configurações | Regras de bonificação, tipos de reconhecimento e núcleos elegíveis |

### Tipos (os 7 iniciais)
RG / Projeto Reconhecido (por **projeto**, com **nº da RG**) · Piloto de Elite · Líder de Voo · SDR do Mês · Closer do Mês · Consultor do Mês (por **colaborador**, com período de referência) · Núcleo de Impacto (por **núcleo**, com período).

### Regras principais
* **RG**: o sistema sugere o próximo número do projeto (1ª–4ª registradas → sugere 5ª). O número é gravado, não pode repetir no mesmo projeto (servidor + banco) e pode ser corrigido depois (fica no histórico). Número fora de sequência é permitido, com aviso.
* **Bonificações** nascem de **regras que você cadastra** em Configurações (gatilho: a cada reconhecimento, ou marcos de RG: *a partir da Nª*, opcionalmente *repetindo a cada M*). **Nenhuma regra nem valor vem pronto.** Uma regra vale para reconhecimentos registrados **depois** dela; para os anteriores há "Aplicar a registros anteriores" (com prévia). Nunca duplica (chave única).
* **Entrega por colaborador**: dentro de cada bonificação, vários colaboradores, cada um com situação própria (*solicitada → aprovada → entregue*) e suas datas. Trocar o cartão não muda ninguém; não há pessoa duplicada; dá para adicionar mais pessoas depois. O cartão só vai para **Entregue** por ação explícita ("Concluir"), com ≥ 1 entrega concluída e nenhuma pendente; adicionar alguém depois **reabre** o cartão. **Cancelar** exige justificativa e é bloqueado se alguém já recebeu. **Expira** sozinho quando o prazo vence sem entrega concluída.
* **Edição** de qualquer reconhecimento (data, colaborador/núcleo/projeto, nº da RG, observações). Se já gerou bonificação, ela é mantida e marcada "reconhecimento de origem alterado".
* **Histórico imutável**: gravado por *triggers* no banco (quem, quando, de → para); o banco bloqueia UPDATE/DELETE/TRUNCATE do histórico.

## Segurança
Autorizado = ADMIN ou colaborador **ativo** com núcleo atual **Vice Presidência**. `paginas_permitidas` e cargo Estratégico de outros núcleos **não** liberam. Camadas: menu, página (barreira no servidor), **todas** as rotas `/api/reconhecimentos/*` (401 sem sessão, 403 sem permissão — papel e vínculo lidos do **banco**, não do token) e dados (7 tabelas com RLS ligado **sem policies** e sem GRANT para `anon`/`authenticated`; só o servidor acessa, com `SUPABASE_SERVICE_ROLE_KEY`, que nunca vai ao navegador). Sem a variável, a API responde 503 "configuração pendente" (não cai na chave pública).

## Estrutura de código
* `src/lib/reconhecimentos/` — `motor.ts` (regras puras), `validacao.ts`, `servico.ts` (operações no servidor), `apresentacao.ts` (textos), `datas.ts` (America/Sao_Paulo), `guard.ts`/`acesso-servidor.ts` (acesso).
* `src/app/api/reconhecimentos/**` — rotas (todas atrás do guard).
* `src/app/(dashboard)/reconhecimentos/` — página (servidor) e `components/`.
* `supabase/migrations/20261020_reconhecimentos_bonificacoes.sql` + `supabase/rollbacks/…_ROLLBACK.sql`.
* `supabase/dry-run/…_DRY_RUN.sql` (gerado por `tests/reconhecimentos/gerar-dry-run.mjs`; aplica a migration e se desfaz sozinho) e `supabase/rollbacks/…_LIMPAR_DADOS_DE_TESTE.sql` (zera só os dados da aba).

## Testes (nada toca banco real)
| Comando | O que cobre |
|---|---|
| `npm run test:reconhecimentos` | 59 testes (inclui o DRY-RUN e a limpeza de dados de teste em Postgres real): acesso (VP/ADMIN × demais), motor (marcos, vigência, idempotência, expiração, entregas), validação, **banco real em memória (PGlite)** com a migration (unicidades, histórico imutável, RLS, atomicidade, rollback, auditoria de catálogo) e **serviço** contra o protocolo do supabase-js (cenário Prorestaure João/Maria/Pedro, concorrência, paginação > 1000) |
| `npm run test:reconhecimentos:e2e` | `next dev` + Postgres em memória + Chromium (Playwright): autorização HTTP com sessões reais (21 endpoints × usuários autorizados e não autorizados) e a aba no navegador (RG com sugestão, bonificação, entrega por colaborador, edição com histórico, filtros, celular, não-VP bloqueado, sem erros de JavaScript). Requer `PLAYWRIGHT_MODULE=<caminho do playwright>` |

## Limitações conscientes (v1)
* Não há "retirar pessoa" de uma bonificação (só adicionar/alterar situação) — para não apagar rastro; pode virar uma melhoria.
* Bonificações **expiradas/canceladas** não aceitam novas entregas.
* Sem *recusada* nas situações da entrega.
* Sem job agendado: a expiração roda ao abrir a aba.
* Sem importação histórica nem de CSV (decisão sua).
