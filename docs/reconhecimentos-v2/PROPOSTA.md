# Reconhecimentos e Bonificações — nova implementação (proposta para validação)

**Status: PROPOSTA APROVADA (recomendações aceitas, "sim") e IMPLEMENTADA em desenvolvimento. Nenhuma migration foi executada e nada foi publicado em produção.** Veja `README.md` (o que foi construído) e `GUIA-APLICACAO.md` (como aplicar, etapa por etapa, com a sua autorização).

> Ajustes feitos na implementação em relação ao texto abaixo: a vigência da regra é por **instante** (`vigente_desde`, comparado com o momento do registro) em vez de data; a tabela `reconhecimento_nucleos` guarda só exceções (núcleo sem linha = elegível); o aviso de RG fora de ordem aparece no formulário.
A aba será criada do zero na arquitetura atual (Next.js + NextAuth + Supabase), usando as imagens como referência visual. Sem migração histórica, sem importação de CSV, sem reprodução do banco anterior.

## 0. Cancelamento da migração (o que muda no que já existe)

* A migration anterior (`supabase/migrations/20261019_reconhecimentos_bonificacoes.sql`) **nunca foi aplicada** e **não será**. O banco de produção **não foi alterado em nenhum momento**.
* O PR #77 continua **rascunho e não será publicado/mergeado**. Parei de empurrar commits para ele.
* Nada é removido agora. Abaixo, a **proposta de remoção** (você autoriza antes).

### Arquivos criados só para a migração — proposta de REMOVER
| Grupo | Arquivos |
|---|---|
| Pacote do sistema antigo (referência) | `docs/migracao-reconhecimentos/**` (53 arquivos) |
| Docs da migração | `docs/reconhecimentos-implementacao/` (README, PENDENCIAS-VALIDACAO, IMPORTACAO-HISTORICA, ETAPA-3-GUIA). `INTEGRACAO-PASSO-A-PASSO.md` tem partes úteis (backup, SQL Editor, Coolify) que serão **adaptadas** à nova migration e então movidas para `docs/reconhecimentos-v2/` |
| Banco antigo | `supabase/migrations/20261019_reconhecimentos_bonificacoes.sql`, `supabase/rollbacks/20261019_…_ROLLBACK.sql` |
| Regras de negócio do sistema antigo | `src/lib/reconhecimentos/engine.ts`, `constantes.ts`, `repositorio.ts`, `validacao.ts`, `tipos.ts` |
| API antiga (13 rotas) | `src/app/api/reconhecimentos/**` |
| Interface antiga | `src/app/(dashboard)/reconhecimentos/components/**`, `use-reconhecimentos.ts` (reescrita nos novos requisitos; a estrutura visual — abas, filtros, cartões, kanban — será refeita seguindo as imagens) |
| Testes presos à lógica antiga | `tests/reconhecimentos/{motor,diferencial,migracao,repositorio,validacao}.test.mjs`, `ui-smoke.mjs` (o `diferencial` depende do pacote antigo) |

### Infraestrutura genérica — proposta de MANTER (vale para qualquer versão da aba)
| Peça | Por quê |
|---|---|
| `src/lib/access-control.ts` (`ROTAS_EXCLUSIVAS_VP`, `podeAcessarRotaExclusivaVP`) + `route-guard.tsx` | Regra de acesso (VP ativo + ADMIN; Estratégico e `paginas_permitidas` não liberam) |
| `src/components/app-sidebar.tsx` (grupo **Vice Presidência**) | Você pediu fora de "Gestão de Pessoas" |
| `src/lib/supabase-admin.ts`, `acesso-servidor.ts`, `guard.ts`, `erros.ts` | Barreira de servidor (401/403 antes de qualquer dado; papel lido do banco) e cliente service role |
| `src/lib/reconhecimentos/datas.ts`, `cliente.ts`, `src/components/ui/searchable-select.tsx` | Utilitários genéricos (datas em America/Sao_Paulo, fetch, select com busca) |
| `page.tsx` (barreira no servidor) | Mesmo padrão |
| `tests/reconhecimentos/{acesso.test.mjs, http-autorizacao.mjs, loader.mjs, fake-supabase.mjs}` | Testes de autorização ponta a ponta e utilitários (ajustados às novas rotas) |

Nenhuma funcionalidade ou dado existente do sistema é tocado pela remoção; a suíte de acesso garante que as demais páginas mantêm o comportamento atual.

---

## 1. Arquitetura atual e o que será reaproveitado

| Necessidade | Já existe | Uso |
|---|---|---|
| Login/sessão | NextAuth (`auth()`), tabela `users` | Identidade do usuário **no servidor** |
| Permissões | `access-control.ts` (matriz por cargo/núcleo) | Regra exclusiva VP/ADMIN já pronta |
| Projetos | tabela `projetos` (`id`, `nome`, `status`; sincronizada do Monday) | Seleção de projeto (por ora **todos os ativos**) |
| Colaboradores | tabela `colaboradores` (`id`, `nome`, `nucleo_atual`, `cargo_atual`, `status`, `email_corporativo`) | Seleção de reconhecidos e de quem solicita/recebe bonificações |
| Núcleos | lista fixa `NUCLEOS` em `src/lib/nucleos.ts` (Marketing, Projetos, Vice Presidência, Presidência, Gestão de Pessoas, Customer Success, Inovação, Tecnologia, Escopos & Produtos) | Núcleos reconhecíveis (+ configuração de elegibilidade) |
| UI | shadcn/Radix, Tailwind 4, sonner, lucide | Abas, filtros, tabelas, painéis, diálogos |
| Dados | Supabase; `update_updated_at_column()` | Triggers de `updated_at` |
| Histórico genérico | `audit_logs` (por colaborador: campo/valor antigo/novo) | **Não serve** (preso a `colaborador_id`): terá tabela própria |

**Reaproveitados sem criar:** projetos, colaboradores, usuários, núcleos, autenticação, permissões.

---

## 2. Estrutura mínima de dados (7 tabelas novas, todas com RLS ligado e **sem policies**: só o servidor acessa)

| Tabela | Papel | Campos principais |
|---|---|---|
| `reconhecimento_tipos` | Os 7 tipos | `nome`, `escopo` (`projeto` \| `colaborador` \| `nucleo`), `usa_periodo` (bool), `ativo`, `ordem`. Semeados: RG / Projeto Reconhecido, Piloto de Elite, Líder de Voo, SDR do Mês, Closer do Mês, Consultor do Mês, Núcleo de Impacto. O **escopo é um campo** (não depende do nome do tipo) |
| `reconhecimento_nucleos` | Núcleos elegíveis | `nucleo` (texto, da lista do sistema), `elegivel` (bool). Semeada com os núcleos atuais |
| `reconhecimentos` | O registro em si | `tipo_id`; `data_reconhecimento`; `projeto_id` (→ `projetos`) + `projeto_nome` (cópia); `colaborador_id` (→ `colaboradores`) + `colaborador_nome` (cópia); `nucleo`; **`numero_rg`** (inteiro, só RG); `periodo_referencia` (a definir, §6); `observacoes`; `criado_por`, `criado_em`, `atualizado_em`; exclusão lógica (`excluido_em/por/motivo`) |
| `regras_bonificacao` | Regras **configuráveis** (nenhuma semeada) | `tipo_id`; `gatilho` (`cada_reconhecimento` \| `marcos_de_rg`); `a_partir_de` e `repetir_a_cada` (só marcos); `tipo_premiacao`; `valor` (opcional); `descricao_premiacao`; `prazo_dias` (opcional); `aplicar_a_partir_de` (vigência); `ativo` |
| `bonificacoes` | Bonificação gerada | `regra_id`; `reconhecimento_id` (gatilho); **`chave_unica` (UNIQUE)**; cópias (tipo, regra, sujeito, premiação); `status` (`disponivel` \| `entregue` \| `expirada` \| `cancelada`); `liberada_em`; `prazo_limite`; cancelamento (`em/por/justificativa`) |
| `bonificacao_entregas` | **Quem pediu/recebeu** | `bonificacao_id`; `colaborador_id` + `colaborador_nome`; `situacao` (`solicitada` \| `aprovada` \| `entregue`); `solicitada_em`; `aprovada_em/por`; `entregue_em/por`; `observacao`. **UNIQUE (`bonificacao_id`, `colaborador_id`)** — sem duplicidade |
| `reconhecimento_historico` | Auditoria **imutável** | `entidade`, `entidade_id` (+ `reconhecimento_id`/`bonificacao_id` para a linha do tempo), `acao`, `alteracoes` (JSON campo: de → para), `detalhe`, `usuario_id`, `usuario_email`, `criado_em`. Trigger no banco **bloqueia UPDATE/DELETE** |

Garantias no banco (não só na tela): `UNIQUE (projeto_id, numero_rg)` entre registros não excluídos; `UNIQUE (bonificacao_id, colaborador_id)`; `UNIQUE (chave_unica)`; CHECKs de status/escopo/situação; histórico imutável; nada de valores monetários semeados.

---

## 3. Regras de funcionamento

### 3.1 Registro e sequência de RGs
* Tipo escolhido → o formulário muda conforme o escopo (§2): **projeto** (RG: projeto, data, **nº da RG**, observações), **colaborador** (colaborador ativo, data, período de referência quando o tipo usa, observações), **núcleo** (núcleo elegível, data, período, observações).
* **Nº da RG sugerido automaticamente** = maior nº do projeto (entre não excluídos) + 1 (Prorestaure com 1ª–4ª → sugere **5ª**). O número é **gravado** (`numero_rg`); nunca derivado da ordem na tela.
* Duplicidade (mesmo projeto + mesmo nº) é **barrada no servidor e no banco**, com mensagem clara ("Prorestaure já tem a 4ª RG registrada em 12/03").
* Editar um registro antigo (data, projeto/colaborador/núcleo, nº da RG, observações) é permitido; cada alteração grava no histórico **quem, quando e de → para**. Editar nunca apaga histórico.
* Excluir = **exclusão lógica** com motivo (some das listas, permanece no histórico).

### 3.2 Geração automática de bonificações (sem duplicidade, sem valores inventados)
* **Nenhuma regra e nenhum valor vêm prontos.** Você cadastra em Configurações: tipo, gatilho, premiação, valor/descrição, prazo, quantidade e vigência.
* `cada_reconhecimento`: uma bonificação por reconhecimento (SDR, Closer, Consultor, Piloto, Líder, Núcleo…).
* `marcos_de_rg`: quando uma RG **com número** igual a `a_partir_de`, `a_partir_de + repetir_a_cada`, … é registrada, gera a bonificação daquele marco (por projeto).
* Idempotência por `chave_unica` (regra + reconhecimento, ou regra + projeto + marco): reprocessar nunca duplica.
* **Sem retroatividade por padrão**: uma regra só vale para reconhecimentos com data ≥ `aplicar_a_partir_de`; um botão explícito "Aplicar a registros anteriores" permite gerar depois (com prévia do que seria criado).
* Roda **no servidor** ao registrar/editar um reconhecimento, ao salvar uma regra e ao abrir a aba (expiração por prazo). Cada bonificação gerada vai para o histórico. Sem job agendado nesta fase.
* Se um reconhecimento for editado **depois** de gerar bonificação: a bonificação **permanece** (não é apagada nem recalculada automaticamente), recebe um aviso "reconhecimento de origem alterado" e tudo fica no histórico.

### 3.3 Entregas individuais (o ponto central)
Dentro de cada bonificação há uma lista de **colaboradores** (seleção múltipla a partir dos colaboradores cadastrados), cada um com **situação própria**:

`solicitada` → `aprovada` → `entregue` (datas de solicitação, aprovação e entrega por pessoa; quem aprovou/entregou).

* Exemplo Prorestaure: João, Maria e Pedro solicitam; João e Maria viram *aprovada → entregue*; Pedro fica *solicitada*. O painel mostra os três, e dá para **adicionar outros depois**.
* **Não há duplicidade**: a mesma pessoa não entra duas vezes na mesma bonificação (banco + servidor).
* Trocar o status do cartão **não altera** as situações individuais, e as solicitações pendentes **nunca são apagadas**.
* Status do cartão: `disponivel` enquanto aberta (inclui as que têm solicitações em andamento); **`entregue` só por ação explícita** ("Concluir bonificação") e **somente se há ≥ 1 entrega concluída e nenhuma pendente** — senão o sistema recusa e explica; `cancelada` por ação com justificativa (bloqueada se já há entrega concluída, ou exige confirmação reforçada); `expirada` automática pelo prazo, **só se não houver entrega concluída**. Adicionar uma nova pessoa a um cartão `entregue` o **reabre**.
* Cada ação (solicitar, aprovar, entregar, adicionar/retirar pessoa, concluir, cancelar) grava no histórico **quem e quando**.

### 3.4 Visão Geral, Kanban, Histórico, Configurações
* **Visão Geral**: 4 indicadores (liberadas no mês, disponíveis, entregues, canceladas/expiradas — calculados dos dados reais, "mês" em America/Sao_Paulo), filtros (período, projeto/pessoa, núcleo, tipo, status) e tabela de bonificações recentes (10).
* **Registrar**: lista de reconhecimentos (com **editar**, histórico por registro e exclusão lógica) + botão **+ Registrar reconhecimento**.
* **Bonificações**: kanban **Disponíveis | Entregues | Expiradas | Canceladas**; cartão com sujeito (projeto/colaborador/núcleo), tipo, motivo, premiação, data de liberação, status e progresso das entregas ("2 de 3 entregues"). Clicar abre o painel de entregas (§3.3).
* **Histórico**: linha do tempo de reconhecimentos criados/editados, bonificações geradas, solicitações, aprovações, entregas — com autor e data, filtrável.
* **Configurações**: tipos (ativar/inativar, criar novos de escopo colaborador), **núcleos elegíveis**, **regras de bonificação** (criar/editar/inativar).

---

## 4. Segurança (mesma arquitetura já validada)
Autorizado = **ADMIN** ou **membro ativo da Vice Presidência**. Camadas: item de menu (grupo *Vice Presidência*), página (barreira no servidor), **todas as rotas de API** (401/403 antes de qualquer consulta; papel e vínculo lidos do banco, não do token), e **dados** (RLS sem policies; só o servidor, com a service role, acessa). Validações todas no servidor; credenciais nunca vão ao navegador; usuário vem da sessão do servidor.

## 5. Como será desenvolvido (sem depender da migração)
1. **Limpeza** (com sua autorização): remover o que está em "REMOVER" por commit normal (histórico preservado), mantendo a infraestrutura em "MANTER".
2. **Banco**: nova migration, escrita do zero para este modelo, **não aplicada**; testes em PostgreSQL real em memória (unicidades, imutabilidade do histórico, RLS, rollback).
3. **Servidor**: motor novo (função pura, testado com cenários **deste** documento — não os vetores do sistema antigo), rotas, histórico, validações.
4. **Interface**: as 5 abas seguindo as imagens, com edição, painel de entregas e filtros.
5. **Testes**: unitários do motor; autorização ponta a ponta (sessões reais, usuários autorizados e não autorizados); fluxo no navegador com o seu exemplo Prorestaure (João/Maria/Pedro); sem erros de console.
6. **Entrega**: relatório + guia de aplicação da migration (backup, SQL Editor, chave no Coolify) **adaptado ao novo modelo**. **Nada em produção** sem sua autorização explícita, etapa por etapa.

PR: proponho **reaproveitar a branch atual** (commit de limpeza + implementação) e **retitular o PR #77** (continua rascunho). Alternativa: fechar o #77 e abrir um novo (exige sua permissão para mudar de branch).

## 6. Dúvidas a decidir (com a minha recomendação)
| # | Dúvida | Recomendação |
|---|---|---|
| 1 | **Marcos de RG**: contar pelo **número da RG** (ex.: "4ª RG") ou pela quantidade de RGs registradas? E o conceito "adiantada" do sistema antigo deixa de existir? | Pelo **número da RG**; "adiantada" **não** entra (não está no seu pedido) |
| 2 | **Retroatividade** de regras novas | Não retroativa por padrão + botão "Aplicar a registros anteriores" |
| 3 | **Edição após gerar bonificação** (mudou projeto/nº/pessoa) | Bonificação permanece, com aviso e histórico (nunca apaga/recalcula sozinha) |
| 4 | **Status do cartão** (§3.3): concluir só com ≥1 entrega e sem pendências; novo solicitante reabre | Como descrito |
| 5 | **Situações da entrega**: bastam *solicitada / aprovada / entregue*? Precisa de *recusada*? Quem pode aprovar: qualquer VP/ADMIN? As datas são digitadas (podem ser retroativas) ou sempre "hoje"? | 3 situações (+ *recusada* se quiser); qualquer VP/ADMIN; datas editáveis (padrão hoje) |
| 6 | **Período de referência**: mês/ano (ex.: 09/2026) ou intervalo de datas? Em quais tipos? | Mês/ano, nos 5 tipos individuais e no Núcleo de Impacto (não em RG) |
| 7 | **Duplicidade individual**: bloquear mesmo colaborador + mesmo tipo + mesmo período? | Bloquear **só quando o período for informado** |
| 8 | **Colaboradores**: apenas ativos (não desligados), de qualquer núcleo? | Sim |
| 9 | **Núcleos elegíveis**: todos os 9 do sistema ligados por padrão? | Sim, todos, editável em Configurações |
| 10 | **Exclusão** de reconhecimento: lógica, com motivo; o nº da RG liberado pode ser reutilizado? | Lógica; número pode ser reutilizado (o antigo fica no histórico) |
| 11 | **Cor**: as imagens têm o verde-azulado do sistema antigo; o portal atual usa azul-marinho/ciano. | Layout **idêntico às imagens**, com as **cores do tema atual** do portal |
| 12 | **RG fora de ordem** (registrar a 7ª sem a 6ª): permitir? | Permitir com aviso (lacunas são possíveis) |
| 13 | **PR**: reaproveitar a branch/PR #77 retitulado ou fechar e abrir outro? | Reaproveitar a branch |
