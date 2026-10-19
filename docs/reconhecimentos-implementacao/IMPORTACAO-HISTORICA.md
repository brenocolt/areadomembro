# Importação futura do histórico (P-7) — preparada, não executada

Objetivo: trazer depois reconhecimentos, bonificações e eventos do sistema anterior **sem sobrescrever nada do sistema novo** e **sem duplicar** se a importação rodar mais de uma vez. Nenhum dado foi importado e nenhum importador foi escrito (não há dados extraídos; o formato real deve ser confirmado antes).

## O que já está pronto na migration
* Colunas `origem` (padrão `'sistema'`), `origem_id` e `importado_em` em `reconhecimentos`, `bonificacoes` e `bonificacao_eventos`.
* `CHECK ((origem = 'sistema') = (origem_id IS NULL))`: registro nativo não tem `origem_id`; importado sempre tem.
* Índice único **parcial** `(origem, origem_id) WHERE origem_id IS NOT NULL`: o mesmo registro antigo não entra duas vezes (`INSERT … ON CONFLICT DO NOTHING`).
* Importar **nunca faz UPDATE**: só `INSERT … ON CONFLICT DO NOTHING`; os registros novos (`origem = 'sistema'`) ficam intactos. Isso está coberto por teste em PostgreSQL real.

## O ponto crítico: a chave de idempotência do motor
`bonificacoes.marco_chave` é calculada pelo motor com ids que **mudam** no sistema novo (id da regra; e, nas regras acumuladas, o id/nome do projeto). Se o histórico for importado com a chave antiga, o motor **não** reconhece a bonificação histórica e **a recria** (duplicidade) — o teste `importação histórica…` demonstra isso.
Por isso a importação deve **recalcular a chave com as mesmas funções do motor** (`chaveMarcoPorReconhecimento`, `chaveMarcoAcumulado` e `sujeitoDe`, exportadas de `src/lib/reconhecimentos/engine.ts`), usando:
1. **Regras**: mapear regra antiga → regra nova **pelo nome** (depois de resolver P-1/P-2 e criar as regras que faltam). Regra sem correspondência = parar e decidir; não inventar.
2. **Projetos**: mapear projeto antigo (centro de custo de entrada) → `projetos.id` **pelo nome**. Sem correspondência: gravar `projeto_id = NULL` e manter `projeto_nome` (o sujeito passa a ser o nome, e a chave é calculada com ele).
3. **Ids**: preservar o id antigo como `id` do registro importado (e como `origem_id`), para os vínculos `reconhecimento_id` e `bonificacao_id` continuarem coerentes e o reprocessamento ser idempotente também pela PK.

## Ordem recomendada (numa transação, com manutenção curta)
1. Backup. 2. Importar **reconhecimentos**. 3. Importar **bonificações** (chave recalculada). 4. Importar **eventos**. 5. Rodar `POST /api/reconhecimentos/sincronizar` e conferir que **`novas = 0`** (se criar algo, a chave/mapeamento está errado — reverter). 6. Conferir contagens com as da origem (7 tipos · 8 regras · 24 reconhecimentos · 12 bonificações · 21 eventos na última contagem do pacote).
Rollback da importação: `DELETE … WHERE origem = 'sistema-antigo'` (eventos → bonificações → reconhecimentos), que não toca nos registros novos.

## Antes de importar
* Resolver P-1/P-2 (regras de Piloto de Elite e Líder de Voo) — senão reconhecimentos desses tipos importam sem bonificação.
* Extrair os dados da origem (autorização separada, somente leitura) e definir o formato (CSV/JSON).
* Escrever o importador como script **dry-run por padrão** (`--aplicar` explícito), com relatório de mapeamentos sem correspondência.
