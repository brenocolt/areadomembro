# 01 — Funcionamento completo da aba "Reconhecimentos e Bonificações"

Descreve **o que o sistema de origem faz hoje**. A especificação para reconstruir em outro sistema está em `02-especificacao-tecnica.md`.

## Legenda de confiabilidade

| Marca | Significado |
|---|---|
| **[C]** | **Confirmado no código-fonte** (arquivo em `codigo-fonte/aba-exclusiva/`). É o comportamento que o código executa. |
| **[B]** | **Confirmado no banco de produção** (consulta às colunas e às contagens de linhas; ver `04-pendencias-e-limitacoes.md`). |
| **[M]** | Vem **apenas das migrations**. Não foi verificado em produção; pode ter sido alterado depois (a própria migration 2 altera regras por UUID). |
| **[D]** | **Dedução** minha a partir do código. Não foi executada nem testada. Não trate como fato. |

Nenhuma afirmação sem marca deve ser lida como confirmada.

---

## 1. Visão de ponta a ponta

1. O usuário **registra reconhecimentos** (um fato: "o projeto X teve uma RG reconhecida", "Fulano foi SDR do Mês", "o núcleo Y foi reconhecido"). [C]
2. Um **motor de regras** (`sincronizarBonificacoes`) lê os reconhecimentos e as **regras de bonificação** e cria **bonificações** (cartões com status, prazo, entrega e cancelamento). [C]
3. As bonificações aparecem em tabela e Kanban; o usuário as marca como **entregues** ou **canceladas**; cada mudança grava um **evento** de histórico. [C]
4. Toda a lógica roda **no navegador** do usuário, chamando o Supabase com `supabase.from(...)`. Não há função de borda, RPC, trigger de negócio, agendador, realtime, storage, e-mail ou integração externa nesta aba. [C — busca por `rpc(`, `functions.invoke`, `channel(`, `storage.`, `fetch(` não retornou nada]

O motor só roda nestes 4 momentos [C]:

| Gatilho | Onde |
|---|---|
| Abrir a aba (montagem da página) | `Reconhecimentos.tsx` (`useEffect` sem dependências) |
| Registrar reconhecimento | `RegistrarDialog.tsx` |
| Ajustar RGs anteriores | `AjustarRgsDialog.tsx` |
| Salvar (criar/editar) regra | `ConfiguracoesRegras.tsx` |

Não roda ao excluir um reconhecimento, ao salvar o prazo padrão, ao criar um tipo, ao entregar/cancelar, nem por agendamento. [C]

## 2. Tipos de reconhecimento

Entidade `reconhecimento_tipos` (nome, escopo `projeto`|`pessoa`, ativo, ordem).

Tipos previstos nas migrations [M] (a **contagem** em produção é 7, igual à das migrations [B]; os **nomes/valores** em produção não foram conferidos):

| Ordem | Nome | Escopo | Origem |
|---|---|---|---|
| 1 | RG / Projeto reconhecido | projeto | migration 1 |
| 2 | Piloto de Elite | pessoa | migration 1 |
| 3 | Líder de Voo | pessoa | migration 1 |
| 4 | SDR do Mês | pessoa | migration 1 |
| 5 | Closer do Mês | pessoa | migration 1 |
| 6 | Consultor do Mês | pessoa | migration 1 |
| 7 | Núcleo de Impacto | pessoa | migration 2 |

O **escopo** define o formulário de registro [C]:
- `projeto` → escolhe um projeto, informa se foi "Adiantado?" e, opcionalmente, quantas RGs adiantadas o projeto já tinha antes do sistema.
- `pessoa` → texto livre com o nome da pessoa.
- Caso especial: tipo cujo nome (sem acento/caixa) **contém `nucleo`** → escolhe um dos 7 núcleos em vez de digitar pessoa. A detecção é **por nome**, não por campo do banco. [C]

Na tela de Configurações só é possível **criar** tipos (sempre `escopo='pessoa'`); não há edição, inativação nem exclusão de tipos. Tipos de escopo `projeto` só existem por inserção direta no banco. [C]

Núcleos válidos (CHECK + constante na UI): Gestão de Pessoas · Presidência · Vice-Presidência · Marketing · CIT · CIEP · CS. [C na UI; CHECK no banco = M]

## 3. Regras de bonificação — configuração

Entidade `regras_bonificacao`. Campos relevantes e seu efeito no motor [C]:

| Campo | Efeito |
|---|---|
| `tipo_id` | A regra só considera reconhecimentos desse tipo. |
| `criterio` | `por_reconhecimento` · `acumulado` · `simbolico` (ignorada pelo motor). |
| `quantidade_necessaria` | Marco inicial (só `acumulado`); mínimo efetivo 1. |
| `ciclo` | `0` = marco único; `n>0` = repete a cada n reconhecimentos. |
| `requer_rg_adiantada` | Se verdadeiro, só contam reconhecimentos "adiantados". (A UI grava o switch "Depende de reconhecimento adiantado" aqui.) |
| `requer_projeto_adiantado` | Legado: a UI sempre grava `false`; o motor ainda o lê (OU lógico). |
| `tipo_premiacao`, `valor`, `descricao_premiacao` | Copiados para a bonificação (ver §5). |
| `prazo_dias` | Validade em dias a partir da liberação; vazio usa o prazo padrão global. |
| `ativo` | Só regras ativas entram no motor. |

Regras previstas [M] — ver `dados-configuracao/regras_bonificacao.csv`, que marca linha a linha o que é seed, migration ou **dedução**:

- SDR / Closer / Consultor do Mês: R$ 50,00 por reconhecimento.
- Núcleo de Impacto: R$ 30 por reconhecimento (o texto diz "por membro do núcleo", mas **nada no código multiplica por membros** [C]; é só um rótulo).
- RGs adiantadas, ciclo R$ 12: acumulado, 2º marco e depois a cada 4 (2, 6, 10…), só adiantadas.
- RGs adiantadas, ciclo R$ 30 / McDonald's: acumulado, 4º marco e depois a cada 4 (4, 8, 12…), só adiantadas, premiação do tipo `premio`.
- Piloto de Elite e Líder de Voo: uma é simbólica e a outra paga R$ 50, mas **qual é qual vem de uma dedução** (a migration 2 altera duas regras por UUID fixo; ver `04`). **[D]**

**Prazo padrão** (`bonificacoes_config.prazo_padrao_dias`, linha única): as migrations o criam vazio (sem prazo) [M]. O valor atual em produção **não foi verificado**.

## 4. O motor de bonificações (regra por regra)

Arquivo: `lib/bonificacoes-engine.ts`. Tudo [C].

**Entrada:** regras ativas (com nome do tipo), todos os reconhecimentos (ordem `data` crescente), a configuração e as bonificações existentes (`id, marco_chave, status, prazo_limite`).

1. **Sujeito** de um reconhecimento = `projeto_id` ‖ `projeto_nome` ‖ `pessoa_nome` ‖ `'sem-identificacao'` (primeiro valor não vazio).
2. Regras `simbolico` → ignoradas.
3. Para cada regra, usa os reconhecimentos do mesmo `tipo_id`. **Elegíveis:** se a regra exige adiantado, só os que têm `adiantado` **ou** `rg_adiantada` **ou** `projeto_adiantado`; senão, todos.
4. **`por_reconhecimento`:** 1 bonificação por reconhecimento elegível.
   - `marco = 1`; `marco_chave = "<regra.id>:rec:<reconhecimento.id>"`; `motivo = regra.nome`; `liberada_em = data do reconhecimento`.
5. **`acumulado`:** agrupa os elegíveis por sujeito, ordena por data, e com `q = max(1, quantidade_necessaria)` e `c = ciclo`:
   - gera um marco para `m = q`; se `c > 0`, continua com `m = q+c, q+2c, …` enquanto `m ≤ total de elegíveis do sujeito`; se `c ≤ 0`, para após o primeiro.
   - `marco_chave = "<regra.id>:<chave do sujeito>:<m>"`; o **gatilho** é o m-ésimo reconhecimento (por data); `liberada_em = data do gatilho`; `reconhecimento_id = id do gatilho`.
   - `motivo = "<m> reconhecimentos adiantados"` se a regra exige adiantado; senão `"<m> reconhecimentos"`.
6. **Idempotência:** só cria se o `marco_chave` ainda não existe entre **todas** as bonificações (qualquer status). Há também UNIQUE na coluna no banco [M].
7. **Snapshot:** a bonificação copia `tipo_nome`, `regra_nome`, `tipo_premiacao`, `valor`, `descricao_premiacao`, sujeito e `nucleo_impacto` (do reconhecimento gatilho). Editar a regra depois não altera as já criadas (a UI avisa: "Bonificações já geradas mantêm o valor original").
8. **Prazo:** `dias = regra.prazo_dias ?? config.prazo_padrao_dias`; se `dias` for "verdadeiro" (0 e vazio contam como sem prazo), `prazo_limite = liberada_em + dias`. Status inicial `disponivel`.
9. **Evento de criação** para cada nova: `evento='criada'`, `detalhe='Bonificação gerada automaticamente pela regra'`, `usuario` = usuário logado.
10. **Expiração:** entre as bonificações que **já existiam antes** desta execução, as com `status='disponivel'` e `prazo_limite < hoje` (comparação de texto `AAAA-MM-DD`, "hoje" em UTC) passam a `expirada` e ganham evento `expirada` (`detalhe='Prazo limite <data> ultrapassado'`, `usuario='sistema'`). As recém-criadas não são avaliadas na mesma execução.
11. **Retorno:** quantidade de bonificações **novas**.

Consequências observáveis no código:
- Excluir um reconhecimento **não** apaga nem cancela bonificações (FK `SET NULL` [M]) e **não** as regera, porque a chave continua existindo.
- Nos marcos acumulados a chave usa o **número do marco**, não o id do reconhecimento: se um reconhecimento for apagado e outro registrado depois, o marco já existente **não** é recriado.
- O motor devolve só a quantidade de **novas**, e a página só invalida a consulta de bonificações se `n > 0` **[C]**. Logo, uma execução que apenas expirou prazos não força a atualização da lista; **[D]** isso pode fazer a expiração aparecer só no próximo refetch (não testado em interface).
- O cálculo de `prazo_limite` usa `Date` local e `toISOString()` (UTC). **[C — executado]** Com `TZ=America/Sao_Paulo` ou `UTC`, `01/01/2026 + 30 dias` dá `2026-01-31`; com `TZ=Europe/Berlin` ou `Asia/Tokyo` dá `2026-01-30` (um dia a menos). Ver `verificacao/`. No Brasil o resultado é o esperado; a reconstrução deve usar aritmética de datas de calendário, sem fuso.

## 5. Como os valores são calculados

- **Não há cálculo financeiro.** O `valor` da bonificação é **cópia** do `valor` da regra no momento da geração. Nenhuma tela soma, totaliza ou multiplica valores em R$. [C]
- Exibição: `descricao_premiacao` se preenchida; senão `formatCurrency(valor)` (BRL, pt-BR). [C]
- Os 4 cartões da Visão Geral são **contagens** sobre as bonificações já filtradas: "Liberadas no mês" (mês atual em UTC, por `liberada_em`), "Disponíveis", "Entregues", "Canceladas / expiradas". [C]
- Contagem de "adiantados" no detalhe: reconhecimentos com `adiantado`/`rg_adiantada`/`projeto_adiantado`. [C]

## 6. Ciclo de vida da bonificação (aprovação, cancelamento e baixa)

**Não existe etapa de aprovação** no código (nenhum campo, tela ou papel de "aprovador"). [C — ausência verificada]. A "baixa" é a **entrega**.

| De | Para | Quem/como | Dados gravados |
|---|---|---|---|
| (nova) | `disponivel` | Motor | evento `criada` |
| `disponivel` | `expirada` | Motor, automático, quando `prazo_limite < hoje` | evento `expirada` (usuário `sistema`) |
| `disponivel` ou `expirada` | `entregue` | Botão **Marcar como entregue** | `entregue_em`, `entregue_por` (e-mail logado), `entregue_para` (nomes unidos por `"; "`, opcional), `observacao_entrega`; evento `entregue` com detalhe `Entregue para: … — <observação>` |
| `disponivel` ou `expirada` | `cancelada` | Botão **Cancelar bonificação** (justificativa obrigatória) | `cancelada_em`, `cancelada_por`, `justificativa_cancelamento`; evento `cancelada` |

- Justificativas: Prazo ultrapassado · Lançamento incorreto · Critério não atendido · Duplicidade · Outro. "Outro" exige descrição; nas demais o detalhe é opcional e vira `"<justificativa> — <detalhe>"`. [C]
- `entregue` e `cancelada` são **terminais na interface** (os botões só aparecem para `disponivel`/`expirada`). O banco **não** impede outras transições (sem CHECK de status nem de transição). [C na UI; M no banco]
- **Expirar não bloqueia a entrega:** uma bonificação expirada ainda pode ser entregue ou cancelada. [C]
- A entrega e o cancelamento fazem **duas gravações separadas** (UPDATE da bonificação e INSERT do evento), sem transação; o erro da segunda não é verificado. [C]

## 7. Relações entre os dados

```
reconhecimento_tipos 1──N regras_bonificacao      (CASCADE) [M]
reconhecimento_tipos 1──N reconhecimentos         (CASCADE) [M]
regras_bonificacao   1──N bonificacoes            (SET NULL) [M]
reconhecimentos      1──N bonificacoes            (SET NULL; é o reconhecimento "gatilho") [M]
bonificacoes         1──N bonificacao_eventos     (CASCADE) [M]
bonificacoes_config  (linha única, sem relações)
reconhecimentos.projeto_id / bonificacoes.projeto_id → centros_custo_entradas.id   SEM chave estrangeira [B: types.ts não lista FK]
```

Existência das 5 FKs: confirmada pelo `types.ts` gerado [B]. Os comportamentos `ON DELETE` são [M].

`projeto_id` guarda o `id` de um **centro de custo de entrada** (`centros_custo_entradas`) — tabela de outra parte do sistema. A FK original para `projetos_entradas` foi removida na migration 2. [C/M]

## 8. Telas e o que cada uma mostra

Cabeçalho: "Reconhecimentos e Bonificações" · "Registre reconhecimentos e acompanhe as bonificações geradas automaticamente" · botão **Registrar reconhecimento**. Sub-abas (padrão: Visão Geral) [C]:

### 8.1 Visão Geral
- Filtros (§9) e 4 cartões de contagem (§5).
- Tabela "Bonificações recentes": as **10** primeiras do filtro, ordenadas por `liberada_em` decrescente. Colunas: Projeto/Pessoa · Reconhecimento (`tipo_nome`) · Motivo · Premiação · Liberada · Status (badge). Clicar na linha abre o detalhe. Vazio: "Nenhuma bonificação encontrada".

### 8.2 Registrar
- **Sem filtros.** Tabela de **todos** os reconhecimentos, por `data` decrescente: Data · Tipo · Projeto/Pessoa · Adiantado? (Sim/Não só quando há projeto; senão "—") · Núcleo ("—" se vazio) · Observação (truncada) · lixeira.
- Botões **Ajustar RGs anteriores** e **Registrar reconhecimento**.
- Excluir é imediato, **sem confirmação**; mensagem "Reconhecimento removido (bonificações já geradas são mantidas no histórico)".

### 8.3 Bonificações (Kanban)
- Filtros + 4 colunas fixas: **Disponíveis · Entregues · Expiradas · Canceladas**, cada uma com contador e rolagem própria. **Não há arrastar-e-soltar**: o status só muda no detalhe.
- Cartão: nome (projeto ou pessoa) · rótulo (`"<marco>º reconhecimento"` + `" adiantado"` se o motivo contém "adiantad", quando há projeto e marco; senão o nome do tipo) · premiação · "Liberada: …" · núcleo · "Prazo: …" · alerta "Vence hoje / Vence em N dia(s)" se `disponivel` e faltam ≤ 7 dias · badge.

### 8.4 Histórico (linha do tempo)
- Filtros + agrupamento por nome (projeto ou pessoa, ordem alfabética pt-BR) com itens por data crescente: o reconhecimento (`<Tipo>` + " — Adiantado"/" — Normal" quando há projeto + " — <Núcleo>"), "Bonificação liberada — <premiação> (<motivo>)", "Bonificação entregue", "Bonificação cancelada — <justificativa>". Vazio: "Nenhum registro encontrado".

### 8.5 Configurações
- **Prazo padrão** (dias após a liberação; vazio = sem prazo): atualiza a linha existente de `bonificacoes_config` ou insere uma se não houver.
- **Tipos de reconhecimento:** badges + "Criar tipo".
- **Regras de bonificação:** lista (nome; tipo · critério; "a partir de N, repetindo a cada C"; "exige reconhecimento adiantado"; prazo; premiação; Ativa/Inativa) + criar/editar em diálogo (campos em §3, mais os switches "Depende de reconhecimento adiantado" e "Regra ativa"). Valores iniciais de nova regra: critério `acumulado`, quantidade 1, ciclo 0, premiação `financeira`, valor 0, ativa. **Não há exclusão de regras** (só inativar). Salvar roda o motor.

### 8.6 Detalhe da bonificação (painel lateral)
- Status; Projeto; Núcleo; Tipo; **Regra atingida** (`motivo` ou `regra_nome`); Bonificação; Liberada em; Entregue para; Prazo; Justificativa (campos vazios são omitidos).
- **Histórico que originou a bonificação:** para projeto → reconhecimentos do mesmo `projeto_id` com `data ≤ liberada_em`, **somente de tipos com escopo `projeto`**; para pessoa → **todos** os reconhecimentos com o mesmo `pessoa_nome` (sem corte de data). Cada linha: data · "Reconhecido" · Adiantado/Normal · núcleo. Resumo "N no total · M adiantado(s)" (só para projeto).
- **Mudanças de status:** "Criada" (`created_at`), "Disponível" (`liberada_em`) e os eventos gravados exceto `criada` (rótulo + detalhe + usuário).
- Botões **Marcar como entregue** / **Cancelar bonificação** (só para `disponivel`/`expirada`).

## 9. Filtros

Presentes nas abas **Visão Geral, Bonificações e Histórico** (a aba Registrar não tem filtros). O **estado dos filtros é único e compartilhado** entre essas três abas e não persiste. Todos combinam com E lógico. [C]

| Filtro | Efeito |
|---|---|
| Pesquisar | Texto sem acento/caixa. Bonificações: projeto, pessoa, tipo, regra, motivo. Reconhecimentos: projeto, pessoa, tipo. |
| Período de / até | `liberada_em` (bonificações) ou `data` (reconhecimentos). |
| Projeto/Pessoa | Valor `projeto:<id>` ou `pessoa:<nome>`; opções montadas dos próprios dados. |
| Núcleo | Valores presentes nos dados. |
| Tipo | Por nome do tipo (todos os tipos cadastrados). |
| Status | Só filtra **bonificações**; não afeta a lista de reconhecimentos do Histórico. |

## 10. Formulários e validações

**Registrar reconhecimento** [C]

| Tipo escolhido | Campos | Gravação |
|---|---|---|
| escopo `projeto` | Data (padrão hoje) · Projeto · Adiantado? · RGs adiantadas antes deste registro (opcional) · Observação | 1 linha com `adiantado` = switch; mais N linhas (N = RGs anteriores) com `adiantado=true`, mesma data e `observacao='RG adiantada registrada antes do uso do sistema'`. |
| escopo `pessoa` | Pessoa (texto livre com sugestões dos nomes já usados) · Data · Observação | `pessoa_nome`. |
| nome contém `nucleo` | Núcleo (7 opções) · Data · Observação | `pessoa_nome = núcleo` **e** `nucleo_impacto = núcleo`. |

Mensagens de validação: "Selecione o tipo de reconhecimento" · "Selecione o projeto" · "Selecione o núcleo" · "Informe o nome da pessoa reconhecida". Sucesso: "Reconhecimento registrado!". Todos gravam `criado_por` = e-mail do usuário logado ou `'sistema'`. Só tipos `ativo` aparecem.

**Lista de projetos do formulário:** centros de custo de **entrada** ativos cuja categoria (`categorias_entradas.nome`, sem acento/caixa) contém ("consultoria" **ou** "assessoria") **e** "2026", **ou** contém "mentoria". Ordem alfabética pt-BR; guarda o `id` do centro de custo e o nome. [C]

**Ajustar RGs anteriores** [C]: escolhe projeto (apenas projetos que já têm reconhecimento); vê total / adiantados / "RGs anteriores" (registros com a observação literal acima); informa a nova quantidade. `diff = nova − atual`: `0` → aviso; `>0` → insere `diff` linhas (tipo do **primeiro item da lista, que vem ordenada por data decrescente, ou seja, o mais recente do projeto**; data = a **mais antiga** do projeto; `adiantado=true`; observação literal); `<0` → apaga as `|diff|` linhas "pré-sistema" mais recentes por `created_at`. Depois roda o motor.

**Entregar / Cancelar** — ver §6.

## 11. O que depende do Supabase ou de outros serviços

Tudo [C], exceto onde indicado:

- **Somente** `supabase.from('<tabela>')` com `select/insert/update/delete` em: `reconhecimento_tipos`, `regras_bonificacao`, `reconhecimentos`, `bonificacoes`, `bonificacao_eventos`, `bonificacoes_config`; mais as leituras de `categorias_entradas` e `centros_custo_entradas` (via `useFinanceData`).
- Junções PostgREST: `reconhecimento_tipos(nome, escopo)` e `reconhecimento_tipos(nome)` nos `select`.
- Cache e atualização de telas: TanStack Query (`['reconhecimentos']`, `['bonificacoes']`, `['regras_bonificacao']`, `['reconhecimento_tipos']`, `['bonificacao_eventos', id]`, `['bonificacoes_config']`).
- Notificações: `sonner` (toasts).
- Identidade: `localStorage['app_user_email']` (e `app_auth`, via rota protegida). Não há leitura de sessão do Supabase Auth.
- Segurança no banco: RLS ligado com política aberta e GRANT para `anon` e `authenticated` [M]; **não há controle de acesso real no servidor**.
- Nenhum outro serviço (e-mail, WhatsApp, storage, Monday, Uber, IA) é usado por esta aba.

## 12. Permissões

- A rota `/reconhecimentos` fica dentro de `ProtectedRoute` (exige `localStorage.app_auth === '1'`). **Não** usa `AdminRoute`; não há papéis, nem dentro da aba. Qualquer usuário autenticado vê, registra, entrega, cancela, edita regras e cria tipos. [C]
- A autenticação do sistema é do lado do cliente (tabela `solicitacoes_acesso` + conta administrativa fixa no código do login). Esse código **não foi copiado** para o pacote (contém credencial); ver `04`. [C]
