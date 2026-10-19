# 04 — Pendências, limitações e informações não confirmadas

Leia antes de implementar. Nada aqui foi inventado; o que é dedução está marcado.

## 1. O que foi (e o que não foi) verificado

| Tema | Situação | Como foi verificado |
|---|---|---|
| Código da aba (telas, motor, hooks, constantes, validações, mensagens) | **Confirmado** | Cópia integral conferida **byte a byte** com o commit `beeebbe` do Git. |
| Comportamento do motor (marcos, ciclo, prazo, idempotência, expiração) | **Confirmado por execução** | Motor original executado contra banco simulado em memória (`verificacao/`). Não é produção. |
| `estrutura/schema.sql` consolidado ≡ cadeia de migrations originais | **Confirmado por execução** | `verificacao/validar-schema.mjs`: ambos aplicados em PostgreSQL em memória; colunas (73), constraints, triggers e políticas **idênticos**; UNIQUE de `marco_chave` e CHECK de núcleo funcionam. Prova a equivalência com as **migrations**, não com a produção. |
| Aritmética de datas do motor em outros fusos | **Confirmado por execução** | `verificacao/tz.mjs`. |
| Colunas das 6 tabelas (nome, tipo, nulabilidade, default) | **Confirmado em produção** | Consulta ao `information_schema` do banco do projeto (somente leitura), conferida contra as migrations: coincidem. |
| Existência das 5 chaves estrangeiras e ausência de FK em `projeto_id` | **Confirmado** | `types.ts` gerado pelo Supabase (reflete o banco). |
| **Contagem de linhas** em produção | **Confirmada**, sem conteúdo | 7 tipos · 8 regras · 24 reconhecimentos · 12 bonificações · 21 eventos · 1 configuração. As contagens de tipos e regras coincidem com as das migrations; isso é indício, **não** prova de que os valores sejam os mesmos. |
| Registros (conteúdo) | **Não extraídos** | Decisão do responsável. |
| `ON DELETE` das FKs, CHECK de `nucleo_impacto`, UNIQUE de `marco_chave`, triggers, políticas RLS, GRANTs | **Não confirmado em produção** | Vêm só das migrations. A consulta de constraints foi iniciada mas **não foi concluída** (pedido de aprovação não respondido), e depois foi vedado consultar o banco. |
| Nomes, valores e flags **reais** das regras e dos tipos | **Não confirmado** | Os CSV vêm das migrations. |
| Valor atual de `prazo_padrao_dias` | **Não confirmado** | Migration cria vazio. |
| Comportamento visual real (testado no navegador) | **Não testado** | Nenhuma tela foi executada; descrições vêm da leitura do código. |

## 2. Pendências que **bloqueiam ou alteram** a reconstrução fiel

| ID | Pendência | Por que importa | Como resolver |
|---|---|---|---|
| P-1 | **Regras "Piloto de Elite" e "Líder de Voo"** (qual é simbólica e qual paga R$ 50). A migration 2 altera duas regras pelos UUIDs `62e9f639-9b79-4efc-b787-2de30f19d293` e `c41af89e-aedd-434c-b722-20cf125228a4` — valores gerados em produção, que não aparecem em nenhuma migration de criação. **[D]** Deduzi o mapeamento pelos nomes novos. | Se a dedução estiver errada, as duas regras ficam trocadas. | Consulta de validação **V-1** abaixo. |
| P-2 | **`descricao_premiacao` dessas duas regras.** A migration 2 não a altera. Sob a dedução, a regra de R$ 50 do Líder de Voo ainda diria "Reconhecimento simbólico" e a simbólica do Piloto diria "R$ 50,00". O CSV (`regras_bonificacao.csv`) já reflete esse resultado literal e marca **DEDUZIDO**. | A bonificação exibe `descricao_premiacao` **no lugar** do valor: pode aparecer o texto errado. O destino deve usar o texto **pretendido** (provavelmente "R$ 50,00"), mas isso é decisão de negócio. | Validar **V-1** e decidir. |
| P-3 | **Regras e tipos editados depois das migrations.** A UI permite criar tipos e editar regras. | Os CSV podem não refletir o que a equipe usa. | **V-1** e **V-2**. |
| P-4 | **Prazo padrão** efetivo. | Muda `prazo_limite` de bonificações novas. | **V-3**. |
| P-5 | **Constraints/policies/triggers de produção.** | Confirmar UNIQUE de `marco_chave`, CHECKs, `ON DELETE`. | **V-4**. |
| P-6 | **Fonte de projetos do destino.** O original usa centros de custo de entrada cujo nome de categoria contém "consultoria/assessoria + 2026" ou "mentoria". | O formulário de registro depende dessa lista; o critério é uma convenção de nomes, **não** um campo. | Definir com o responsável qual é a lista de projetos no destino. |
| P-7 | **Dados históricos** (24 reconhecimentos, 12 bonificações, 21 eventos). | Não foram extraídos; se forem necessários no destino, é preciso nova extração enquanto as tabelas existirem. | Decisão do responsável (hoje: descartar). |
| P-8 | **Semântica do "R$ 30 por membro do núcleo".** O texto sugere multiplicar por membros, mas o sistema gera **uma** bonificação por reconhecimento do núcleo e não conhece membros. | Pode haver processo manual fora do sistema. | Confirmar com o responsável. |

### 2.1 Consultas de validação **somente leitura** (NÃO executadas; para uma próxima etapa autorizada)

```sql
-- V-1: regras e tipos reais
SELECT r.ordem, r.id, r.nome, t.nome AS tipo, r.criterio, r.quantidade_necessaria, r.ciclo,
       r.requer_rg_adiantada, r.requer_projeto_adiantado, r.tipo_premiacao, r.valor,
       r.descricao_premiacao, r.prazo_dias, r.ativo
FROM regras_bonificacao r LEFT JOIN reconhecimento_tipos t ON t.id = r.tipo_id ORDER BY r.ordem;

-- V-2: tipos
SELECT ordem, id, nome, escopo, ativo FROM reconhecimento_tipos ORDER BY ordem;

-- V-3: prazo padrão
SELECT id, prazo_padrao_dias FROM bonificacoes_config;

-- V-4: constraints, triggers e políticas das 6 tabelas
SELECT conrelid::regclass AS tabela, conname, contype, pg_get_constraintdef(oid) AS definicao
FROM pg_constraint
WHERE conrelid::regclass::text IN ('reconhecimento_tipos','regras_bonificacao','reconhecimentos','bonificacoes','bonificacao_eventos','bonificacoes_config')
ORDER BY 1,2;
SELECT event_object_table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers WHERE event_object_schema = 'public'
  AND event_object_table IN ('reconhecimento_tipos','regras_bonificacao','reconhecimentos','bonificacoes','bonificacao_eventos','bonificacoes_config');
SELECT tablename, policyname, cmd, roles, qual, with_check FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('reconhecimento_tipos','regras_bonificacao','reconhecimentos','bonificacoes','bonificacao_eventos','bonificacoes_config');
```

## 3. Limitações e comportamentos do original que **não devem ser copiados às cegas**

Marcados como **defeito/risco** quando comprovados, **[D]** quando suspeitos.

| ID | Item | Evidência |
|---|---|---|
| L-1 | `addDays` desloca a data em fusos à frente do UTC (30/01 em vez de 31/01). | **Executado** (`verificacao/`). |
| L-2 | "Liberadas no mês" usa o mês atual em **UTC** (`toISOString`). Perto da virada do mês pode divergir do horário de Brasília. | [C] código; efeito prático [D]. |
| L-3 | Em conflito de `marco_chave` (duas pessoas sincronizando ao mesmo tempo), o INSERT em lote falha inteiro. Na abertura da aba o erro é **engolido** (`catch(() => undefined)`). | Código [C]; consequência [D]. |
| L-4 | Entrega e cancelamento fazem duas gravações sem transação; o erro do INSERT do evento não é verificado. | [C] |
| L-5 | A lista de bonificações só recarrega se o motor criou algo novo; expirações isoladas podem não aparecer até o próximo refetch. | Código [C]; efeito visual [D]. |
| L-6 | `Filtros` é um componente **declarado dentro** do componente da página (nova identidade a cada renderização). **[D]** Em React isso costuma remontar o campo de pesquisa a cada tecla, fazendo-o perder o foco. Não foi testado no navegador. | [D] |
| L-7 | O detalhe de uma bonificação de **pessoa** mostra todos os reconhecimentos da pessoa (sem corte por data), enquanto o de **projeto** corta em `data ≤ liberada_em`. | [C] |
| L-8 | Pessoas são texto livre (sem cadastro): grafias diferentes viram pessoas diferentes nos filtros, nas sugestões e na chave do sujeito do motor. | [C] |
| L-9 | Marcação das RGs anteriores por **texto literal** na observação; editar esse texto quebra o ajuste. | [C] |
| L-10 | O tipo "Núcleo" é detectado por **nome** contendo "nucleo". Renomear o tipo muda o formulário. | [C] |
| L-11 | Colunas legadas (`rg_adiantada`, `projeto_adiantado`, `requer_projeto_adiantado`) sempre `false` na UI atual, mas lidas pelo motor. | [C] |
| L-12 | Não há edição de reconhecimentos, exclusão de regras/tipos, reabertura de bonificações, confirmação ao excluir. | [C] |
| L-13 | Status e transições não têm restrição no banco; só a interface limita. | [C]/[M] |
| L-14 | Apagar um reconhecimento mantém as bonificações e impede regerá-las; apagar RGs "anteriores" via ajuste idem. | [C] |
| L-15 | Estado dos filtros é compartilhado entre Visão Geral, Bonificações e Histórico e não persiste. | [C] |

## 4. Segurança (achados fora do escopo da aba, registrados por dever de transparência)

| ID | Achado | Observação |
|---|---|---|
| **S-1** | `src/pages/Login.tsx` do sistema de origem contém uma **senha de administrador escrita no código** (e o e-mail do administrador em `auth-utils.ts`). Como o código vai para o navegador e para o GitHub, qualquer um com acesso ao repositório ou ao bundle pode ler. | **Não copiei esse arquivo** para o pacote e não reproduzo o valor aqui. Recomendo trocar a senha e mover a autenticação para o servidor. **Não alterei nada** (fora do escopo). |
| S-2 | RLS ligado com política `USING (true)` e GRANT para `anon` em todas as 6 tabelas: qualquer pessoa com a chave pública (que está no bundle) pode ler e escrever. [M] | No destino definir permissões reais. |
| S-3 | A identidade do usuário (`app_user_email`) vem do `localStorage` e é editável pelo próprio usuário; `criado_por`/`entregue_por` não são confiáveis como auditoria. [C] | |

## 5. Estado do repositório de origem (para não haver surpresas)

- A aba **foi removida do código** no PR em rascunho [produtivajunior-prog/acompanhamentofinanceirovp#1](https://github.com/produtivajunior-prog/acompanhamentofinanceirovp/pull/1) (**não mergeado**). Nesta etapa **nada foi alterado na aba original, no banco ou no PR**.
- O código original completo continua no Git: commit **`beeebbe`** (último com a aba) e na `main`, enquanto o PR não for mergeado. O pacote foi gerado a partir de `beeebbe`.
- As **6 tabelas continuam no banco**; o SQL de remoção (`estrutura/remocao_banco_pendente.sql`) **não foi executado**.
- Correção de um comentário anterior meu: as exclusões dos arquivos da aba estão no commit `42076fa` (rotulado "docs") e as da rota e do menu no `9eee230`. Os dois commits **não** separam "documentação" de "remoção" como eu havia dito.

## 6. Itens do pedido que **não se aplicam** ao sistema de origem
- **Anexos, subpáginas, links externos, integrações com serviços de terceiros, notificações, fluxo de aprovação, permissões por papel:** não existem nesta aba. [C — ausência verificada por busca no código]
