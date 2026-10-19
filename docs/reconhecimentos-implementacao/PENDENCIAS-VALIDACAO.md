# Pendências e validações antes de publicar

## Decisões já tomadas (P-1 a P-8)

| ID | Decisão aplicada |
|---|---|
| P-1 / P-2 | **Não semeadas** as regras de *Piloto de Elite* e *Líder de Voo* (o estado final em produção depende de UUIDs do banco antigo; a dedução não foi tratada como fato). Os **tipos** existem. Enquanto não houver regra, esses dois tipos **não geram bonificação**. |
| P-3 | Semeados, sem duplicar (`WHERE NOT EXISTS`): 7 tipos e 6 regras comprovadas nas migrations (SDR, Closer, Consultor, 2 ciclos de RG, Núcleo de Impacto). |
| P-4 | Prazo padrão **vazio** (sem prazo). |
| P-5 | Schema consolidado + CHECKs de status/escopo/critério/premiação/evento e `UNIQUE(marco_chave)`. Colunas idênticas às do pacote (73). Todos os valores que a UI original gravava continuam aceitos (testado). |
| P-6 | Tabela `projetos` (`status = 'Ativo'`). |
| P-7 | Sem dados históricos; ver "Importação futura" no README. |
| P-8 | Uma bonificação por reconhecimento de núcleo; texto "R$ 30 por membro do núcleo" é só rótulo. |

## O que ainda precisa de você (bloqueia publicar, não bloqueia revisar)

1. **Autorizar a aplicação da migration** em produção (`supabase/migrations/20261019_reconhecimentos_bonificacoes.sql`). Rollback: `supabase/rollbacks/…_ROLLBACK.sql` (apaga as 6 tabelas e seus dados).
2. **`SUPABASE_SERVICE_ROLE_KEY` no ambiente do servidor** (Coolify). Não consegui verificar o ambiente de deploy; no ambiente desta sessão ela **não está definida**. Sem ela a aba abre, mas todas as operações respondem 503 "configuração pendente".
3. **P-1/P-2 — regras de Piloto de Elite e Líder de Voo.** Rode no banco **de origem** (somente leitura) e envie o resultado:

```sql
SELECT r.ordem, r.id, r.nome, t.nome AS tipo, r.criterio, r.quantidade_necessaria, r.ciclo,
       r.requer_rg_adiantada, r.tipo_premiacao, r.valor, r.descricao_premiacao, r.prazo_dias, r.ativo
FROM regras_bonificacao r LEFT JOIN reconhecimento_tipos t ON t.id = r.tipo_id ORDER BY r.ordem;
SELECT ordem, id, nome, escopo, ativo FROM reconhecimento_tipos ORDER BY ordem;
SELECT id, prazo_padrao_dias FROM bonificacoes_config;
```
   Enquanto isso, a regra pode ser criada na própria aba (Configurações → Criar nova regra).
4. **Lista de projetos** — confirmar se "todos os projetos ativos" serve ou se deve haver filtro (ex.: só 2026/mentorias).
5. **Rótulo do grupo do menu** — o grupo onde o item entrou chama-se hoje "Gestão de Pessoas" (é o grupo de itens de gestão existente). Se quiser um grupo "Gestão" separado, é uma mudança de menu para a etapa 2.

## Riscos conhecidos (herdados do original, mantidos de propósito)

* Pessoas são texto livre (grafias diferentes = pessoas diferentes). Marcação das RGs anteriores por texto literal na observação. Tipo "Núcleo" detectado pelo nome. Sem edição de reconhecimento, sem exclusão de regra/tipo, sem confirmação ao excluir.
* Entrega/cancelamento fazem duas gravações sem transação (o erro do evento agora é reportado, mas o status já foi alterado).
* A expiração só roda quando alguém dispara um dos 4 gatilhos (job diário ficou para a etapa 2).
* Preview do PR (Coolify) já builda esta branch; sem a migration aplicada, as tabelas não existem lá.
