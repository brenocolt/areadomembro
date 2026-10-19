# 02 — Especificação técnica para reconstruir "Reconhecimentos e Bonificações"

Objetivo: **preservar o comportamento** descrito em `01-funcionamento.md`, adaptando a implementação a um sistema de arquitetura diferente. Não presuma que o código original possa ser reutilizado: ele está acoplado a React + Supabase + shadcn/ui + localStorage.

Marcas **[C] [B] [M] [D]** têm o mesmo significado do documento 01. Itens marcados **[Rec.]** são **recomendações minhas para o destino**, não comportamento do original; quem implementar decide se os adota.

Nada aqui foi implementado no destino.

---

## 1. Requisitos funcionais

| ID | Requisito | Fonte |
|---|---|---|
| RF-01 | Cadastrar **tipos de reconhecimento** com nome, escopo (`projeto`/`pessoa`), ativo e ordem. A UI original só **cria** (escopo `pessoa`). | [C] |
| RF-02 | Cadastrar e editar **regras de bonificação** (campos em 01 §3). A UI original não exclui; só inativa. | [C] |
| RF-03 | Manter um **prazo padrão global** (dias; vazio = sem prazo). | [C] |
| RF-04 | **Registrar reconhecimentos** com formulário que depende do escopo do tipo (projeto / pessoa / núcleo). | [C] |
| RF-05 | Registrar junto, opcionalmente, **N RGs adiantadas anteriores ao sistema** de um projeto. | [C] |
| RF-06 | **Ajustar** a quantidade de RGs anteriores de um projeto (inserir ou remover registros marcados). | [C] |
| RF-07 | **Excluir** reconhecimentos sem apagar bonificações já geradas. | [C] |
| RF-08 | **Gerar bonificações automaticamente** pelas regras (motor, §4), de forma idempotente. | [C] |
| RF-09 | **Expirar** bonificações `disponivel` com prazo vencido. | [C] |
| RF-10 | **Entregar** (com nomes de recebedores e observação) e **cancelar** (com justificativa) bonificações `disponivel`/`expirada`, gravando eventos. | [C] |
| RF-11 | Exibir Visão Geral (4 contagens + 10 recentes), lista de reconhecimentos, Kanban por status, linha do tempo e detalhe (01 §8). | [C] |
| RF-12 | Filtrar por texto, período, projeto/pessoa, núcleo, tipo e status (01 §9). | [C] |
| RF-13 | Identificar o usuário responsável em cada registro/entrega/cancelamento. | [C] |
| RF-14 | Oferecer escolha de **projeto** a partir de uma lista externa à funcionalidade (§6). | [C] |

Não existem no original (não implementar a menos que o destino peça): aprovação prévia, edição de reconhecimento, exclusão de regra/tipo, reabertura de bonificação, exportação, notificação, anexos, relatórios financeiros, permissões por papel. [C — ausência verificada]

## 2. Estrutura de dados necessária

Esquema relacional completo em `estrutura/schema.sql`; versão neutra em `estrutura/modelo.json`; dicionário de campos em `dados-configuracao/dicionario_de_campos.csv`. Resumo lógico (tipos abstratos):

| Entidade | Campos (tipo lógico) | Identidade / restrições |
|---|---|---|
| **TipoReconhecimento** | id, nome (texto), escopo (enum projeto\|pessoa), ativo (bool), ordem (int), criadoEm, atualizadoEm | PK id |
| **RegraBonificacao** | id, nome, tipoId→Tipo, criterio (enum por_reconhecimento\|acumulado\|simbolico), quantidadeNecessaria (int ≥1), ciclo (int ≥0), exigeAdiantado (bool), tipoPremiacao (enum financeira\|premio\|simbolica), valor (decimal), descricaoPremiacao (texto, pode ser vazio), prazoDias (int\|nulo), ativo, ordem | PK id |
| **Reconhecimento** | id, tipoId→Tipo (obrig.), data (data de calendário, obrig.), projetoId (ref. externa, nulo), projetoNome (texto, snapshot), pessoaNome (texto), adiantado (bool), nucleoImpacto (enum de 7 \| nulo), observacao, criadoPor, criadoEm | PK id |
| **Bonificacao** | id, regraId→Regra (nulo ao apagar), reconhecimentoId→Reconhecimento (nulo ao apagar), **marcoChave (texto, ÚNICO)**, marco (int), projetoId, projetoNome, pessoaNome, nucleoImpacto, tipoNome, regraNome, motivo (snapshots), tipoPremiacao, valor, descricaoPremiacao (snapshots), status (enum), liberadaEm (data), prazoLimite (data\|nulo), entregueEm/entreguePor/entreguePara/observacaoEntrega, canceladaEm/canceladaPor/justificativaCancelamento, criadoEm, atualizadoEm | PK id; **UNIQUE(marcoChave)** |
| **EventoBonificacao** | id, bonificacaoId→Bonificacao (apagar em cascata), evento (enum criada\|entregue\|cancelada\|expirada), detalhe, usuario, criadoEm | PK id |
| **ConfiguracaoBonificacoes** | id, prazoPadraoDias (int\|nulo) — **uma única linha** | PK id |

Observações de modelagem:
- **Snapshots são parte do contrato:** a bonificação guarda cópia de nome do tipo/regra, premiação e sujeito para que editar a regra depois não altere o histórico. [C]
- **Datas de calendário** (`data`, `liberadaEm`, `prazoLimite`) são datas sem hora/fuso; os instantes (`entregueEm`, `canceladaEm`, `criadoEm`) têm hora. [C/B]
- Colunas legadas `rg_adiantada`, `projeto_adiantado` (reconhecimentos) e `requer_projeto_adiantado` (regras) **devem ser fundidas** em `adiantado` / `exigeAdiantado` no destino. A elegibilidade do original é o OU lógico dos três (01 §4.3); em dados novos os legados são sempre falsos. [C] Se o destino receber dados antigos, aplicar o OU na importação.
- `projetoId` **não tem integridade referencial** no original; apontar para a lista de projetos do destino (§6) e guardar também `projetoNome`.
- Enum de núcleos: Gestão de Pessoas, Presidência, Vice-Presidência, Marketing, CIT, CIEP, CS (`dados-configuracao/nucleos_impacto.csv`). [C]

## 3. Regras de negócio (resumo normativo)

Cada regra tem o **marcador** da origem. Detalhe e exemplos em 01 §4–§6.

| # | Regra |
|---|---|
| RN-01 | **Sujeito** = `projetoId ‖ projetoNome ‖ pessoaNome ‖ "sem-identificacao"`. [C] |
| RN-02 | Regra `simbolico` ou inativa nunca gera bonificação. [C] |
| RN-03 | Elegibilidade: se a regra exige adiantado, só reconhecimentos adiantados; senão todos do mesmo tipo. [C] |
| RN-04 | `por_reconhecimento`: 1 bonificação por reconhecimento elegível; `marco=1`; chave `<regra>:rec:<reconhecimento>`; `liberadaEm = data`; `motivo = nome da regra`. [C] |
| RN-05 | `acumulado`: por sujeito, em ordem de data, marcos `q, q+c, q+2c…` (`q=max(1,quantidade)`, `c=ciclo`; se `c≤0` só `q`) enquanto `m ≤ total elegível`; chave `<regra>:<sujeito>:<m>`; gatilho = m-ésimo; `liberadaEm = data do gatilho`; `motivo = "<m> reconhecimentos [adiantados]"`. [C] |
| RN-06 | **Idempotência por `marcoChave`**, considerando bonificações de qualquer status. [C] |
| RN-07 | Snapshot da premiação e do sujeito na criação; regras editadas não alteram o já criado. [C] |
| RN-08 | `prazoLimite = liberadaEm + (regra.prazoDias ?? config.prazoPadraoDias)` se esse número for não nulo e ≠ 0; senão nulo. [C — executado] |
| RN-09 | Status inicial `disponivel`; evento `criada`. [C] |
| RN-10 | Expiração: `disponivel` com `prazoLimite < hoje` → `expirada` + evento `expirada` (usuário `sistema`); só para bonificações que já existiam antes da execução. [C] |
| RN-11 | Entregar/cancelar só a partir de `disponivel` ou `expirada` (regra de **interface**; o banco não impõe). Estados `entregue` e `cancelada` são terminais. [C] |
| RN-12 | Cancelamento exige justificativa; "Outro" exige texto. Entrega não exige nada (recebedores e observação opcionais). [C] |
| RN-13 | Excluir reconhecimento não apaga nem regera bonificações. [C/M] |
| RN-14 | Para o tipo cujo nome contém "nucleo", o "sujeito" é o núcleo escolhido: `pessoaNome = nucleoImpacto = núcleo`. [C] |
| RN-15 | "Adiantado" só se pergunta para tipos de escopo `projeto`. [C] |
| RN-16 | Observação literal `RG adiantada registrada antes do uso do sistema` marca as RGs anteriores; é a única forma de o ajuste identificá-las. [C] **[Rec.]** no destino use um campo booleano `anteriorAoSistema` em vez de comparar texto. |
| RN-17 | **Nenhum cálculo monetário:** o valor é cópia da regra; nada é somado. [C] |

### 3.1 Algoritmo do motor (pseudocódigo fiel ao original)

```
sincronizar():
  regras      = Regras onde ativo = verdadeiro            (com nome do tipo)
  recs        = todos os Reconhecimentos ordenados por data crescente
  config      = primeira ConfiguracaoBonificacoes (pode não existir)
  existentes  = todas as Bonificacoes (id, marcoChave, status, prazoLimite)
  chaves      = conjunto de marcoChave de existentes
  novas       = []

  para cada regra em regras:
    se regra.criterio = simbolico: continuar
    doTipo    = recs onde tipoId = regra.tipoId
    exige     = regra.exigeAdiantado (OU legado)
    elegiveis = doTipo filtrados por (não exige) OU rec.adiantado (OU legados)

    se regra.criterio = por_reconhecimento:
      para cada rec em elegiveis: criar(regra, rec, marco=1, chave=regra.id+":rec:"+rec.id, motivo=regra.nome, liberadaEm=rec.data)
    senão:  # acumulado
      agrupar elegiveis por sujeito(rec); ordenar cada grupo por data
      q = max(1, regra.quantidadeNecessaria); c = regra.ciclo
      para cada grupo (chaveSujeito, lista):
        m = q
        enquanto m ≤ tamanho(lista):
          gatilho = lista[m-1]
          criar(regra, gatilho, marco=m, chave=regra.id+":"+chaveSujeito+":"+m,
                motivo = m+" reconhecimentos"+(exige?" adiantados":""), liberadaEm=gatilho.data)
          se c ≤ 0: parar
          m = m + c

  criar(...): se chave ∈ chaves: ignorar; senão adicionar a chaves e a novas, com
              snapshot, status=disponivel, prazoLimite = liberadaEm + dias (se dias ≠ nulo/0)
              onde dias = regra.prazoDias ?? config.prazoPadraoDias

  gravar novas; para cada gravada, gravar Evento(criada, "Bonificação gerada automaticamente pela regra", usuarioLogado)
  hoje = data de hoje
  para cada b em existentes com status=disponivel e prazoLimite não nulo e prazoLimite < hoje:
     b.status = expirada; gravar Evento(expirada, "Prazo limite <data> ultrapassado", "sistema")
  retornar quantidade de novas
```

### 3.2 Vetores de teste (executados contra o motor original)

Gerados por `verificacao/executar.sh` (saída em `verificacao/saida-esperada.txt`). Use-os como **testes de aceitação** do destino. [C — executado com banco simulado; não é produção]

| # | Cenário | Resultado esperado |
|---|---|---|
| V1 | Regras R12 (acumulado, q=2, c=4, exige adiantado, R$ 12) e R30 (acumulado, q=4, c=4, exige adiantado, `premio`, R$ 30). Projeto P1 com 7 RGs adiantadas (01–07/01) e 2 normais (08–09/01). | 3 novas: R12 marco **2** (liberada 02/01) e **6** (06/01); R30 marco **4** (04/01). As normais não contam. Motivos: `"2 reconhecimentos adiantados"`, etc. |
| V1b | Somar adiantadas 8, 9, 10 (01–03/02). | 2 novas: R12 marco **10** (liberada 03/02); R30 marco **8** (liberada 01/02). |
| V1c | Executar de novo sem mudanças. | 0 novas (idempotência). |
| V2 | Regra SDR `por_reconhecimento`, 3 reconhecimentos da mesma pessoa. | 3 bonificações, `marco=1`, chaves distintas, `motivo="SDR do Mês"`. |
| V2b | Apagar o 2º reconhecimento e sincronizar. | 0 novas; as 3 bonificações permanecem. |
| V3 | Regra `simbolico` e regra inativa com reconhecimentos do tipo. | 0 novas. |
| V4 | Config padrão = 10 dias; regras com `prazoDias` = 30, nulo e 0; reconhecimento em 01/01/2026. | `prazoLimite` = **31/01/2026**, **11/01/2026** (padrão) e **nulo** (0 = sem prazo). |
| V4b | Sincronizar depois dos prazos. | As duas com prazo → `expirada` (+2 eventos `expirada`); a sem prazo continua `disponivel`. |
| V5 | `addDays("2026-01-01", 30)` em fusos diferentes. | Original dá 31/01 em UTC e São Paulo, mas **30/01 em Berlim e Tóquio**. O destino deve dar **31/01 em qualquer fuso**. |

### 3.3 Operações: entradas e saídas

| Operação | Entrada | Efeito / saída | Erros |
|---|---|---|---|
| `criarTipo` | nome | Insere tipo (`escopo=pessoa`, `ordem=nº de tipos+1`). | falha de gravação |
| `salvarRegra` | campos da regra (+ id se edição) | Valida nome e tipo; insere/atualiza; **dispara `sincronizar`**. `exigeAdiantado` recebe o switch. | "Informe o nome da regra"; "Selecione o tipo de reconhecimento" |
| `salvarPrazoPadrao` | dias\|vazio | Atualiza a linha única ou a cria. Não dispara o motor. | falha de gravação |
| `registrarReconhecimento` | tipoId, data, e conforme escopo: projetoId+projetoNome+adiantado+rgsAnteriores+obs \| pessoa+obs \| núcleo+obs | Insere 1 linha (+N linhas "anteriores" para projeto); **dispara `sincronizar`**. | mensagens de validação em 01 §10 |
| `ajustarRgsAnteriores` | projetoId, novaQuantidade | `diff = nova − atual`: 0 aviso; >0 insere diff linhas; <0 apaga as diff mais recentes (por criadoEm). **Dispara `sincronizar`**. | falha de gravação |
| `excluirReconhecimento` | id | Remove; **não** dispara o motor; bonificações permanecem. | falha de gravação |
| `sincronizar` | — | §3.1; retorna nº de novas. Na abertura da aba o erro é ignorado. | exceção ao inserir (ex.: chave duplicada) |
| `entregarBonificacao` | id, nomes[] (opc.), observacao (opc.) | Status `entregue`; grava entrega; evento `entregue`. | falha de gravação |
| `cancelarBonificacao` | id, justificativa (enum), detalhe | Status `cancelada`; grava cancelamento; evento `cancelada`. | "Selecione a justificativa"; "Descreva a justificativa" |
| `listar*` | filtros do §9 de 01 | Listas já ordenadas (01 §8). | — |

## 4. Dependências a substituir

| Dependência no original | Função | O que o destino precisa oferecer |
|---|---|---|
| Cliente Supabase (`supabase.from`) | Persistência e consultas | Camada de repositório (§5.2) para as 6 entidades. |
| Junção PostgREST `reconhecimento_tipos(nome, escopo)` | Trazer nome/escopo do tipo junto | Consulta com junção ou segunda consulta + mapa em memória. |
| TanStack Query (cache + invalidação) | Atualizar telas após gravar | Qualquer mecanismo equivalente; **atenção:** o original só recarrega bonificações se houve nova (01 §4). |
| `localStorage.app_user_email` | Identidade do usuário | Serviço `UsuarioAtual` (§5.1). Fallback `"sistema"`. |
| `ProtectedRoute` / login do app | Acesso à aba | A política de acesso do destino. |
| RLS aberto + GRANT `anon` | "Segurança" | **Não replicar.** Definir permissões reais no destino. |
| Lista de projetos (`categorias_entradas`/`centros_custo_entradas`) | Escolha de projeto | Provedor de projetos (§5.1, §6). |
| `sonner` (toasts) | Mensagens de sucesso/erro | Mecanismo de notificação; manter os textos (01 §10). |
| shadcn/ui, Radix, Tailwind, lucide-react | Interface | Equivalentes do destino. Lista exata em `03-dependencias-e-integracoes.md`. |
| `formatCurrency` / `formatDate` | BRL e dd/mm/aaaa | Mesmas saídas (§5.1). |
| Função SQL `update_updated_at_column` | `updated_at` automático | Mecanismo equivalente. |

## 5. Contratos e interfaces para integrar ao destino

Pseudo-TypeScript **apenas como documentação**; adapte à linguagem do destino. Não é código implementado.

### 5.1 Serviços que a funcionalidade **consome** do destino

```ts
interface UsuarioAtual {
  identificador(): string;            // e-mail ou id; "sistema" quando não houver usuário
}
interface ProvedorDeProjetos {
  listar(): Promise<Array<{ id: string; nome: string }>>;
  // Original: centros de custo de ENTRADA ativos, cujas categorias contêm
  // ("consultoria" OU "assessoria") E "2026", OU "mentoria" (comparação sem acento/caixa).
  // Se o destino tiver outra noção de projeto, só é necessário id estável + nome.
}
interface Relogio { hoje(): string /* "AAAA-MM-DD" no fuso de negócio (Brasil) */ }
interface Notificador { sucesso(msg: string): void; erro(msg: string): void; info(msg: string): void }
interface Formatador {
  moeda(valor: number): string;       // ex.: 12 -> "R$ 12,00" (pt-BR, BRL)
  data(isoOuData: string | Date): string; // "2026-01-31" -> "31/01/2026", sem deslocar fuso
}
```

### 5.2 Repositórios que a funcionalidade **precisa**

```ts
interface Repositorios {
  tipos:  { listarOrdenado(): Promise<Tipo[]>; criar(t: NovoTipo): Promise<void> };
  regras: { listarOrdenado(): Promise<Regra[]>; listarAtivas(): Promise<Regra[]>;
            criar(r: NovaRegra): Promise<void>; atualizar(id: string, r: NovaRegra): Promise<void> };
  config: { obter(): Promise<{ id: string; prazoPadraoDias: number | null } | null>;
            salvar(dias: number | null): Promise<void> };
  reconhecimentos: { listarPorDataDesc(): Promise<ReconhecimentoComTipo[]>;
                     listarPorDataAsc(): Promise<ReconhecimentoComTipo[]>;
                     inserir(linhas: NovoReconhecimento[]): Promise<void>;
                     excluir(id: string): Promise<void>; excluirVarios(ids: string[]): Promise<void> };
  bonificacoes: { listarPorLiberadaEmDesc(): Promise<Bonificacao[]>;
                  listarResumo(): Promise<Array<{ id: string; marcoChave: string; status: Status; prazoLimite: string | null }>>;
                  inserirNovas(linhas: NovaBonificacao[]): Promise<Array<{ id: string }>>; // deve FALHAR/ignorar em marcoChave duplicada
                  atualizar(id: string, campos: Partial<Bonificacao>): Promise<void>;
                  marcarExpiradas(ids: string[]): Promise<void> };
  eventos: { listarPorBonificacao(id: string): Promise<Evento[]> /* ordem criadoEm asc */;
             inserir(e: NovoEvento | NovoEvento[]): Promise<void> };
}
```

### 5.3 Pontos de integração visíveis no destino
- **Rota/entrada de menu** "Reconhecimentos e Bonificações" (no original: `/reconhecimentos`, ícone de prêmio). [C]
- **Contrato de projeto:** `Reconhecimento.projetoId` deve poder ser resolvido por `ProvedorDeProjetos`. [C]
- **Gatilho do motor:** abrir a aba, registrar, ajustar RGs, salvar regra (01 §1). **[Rec.]** executar também no servidor e diariamente, para a expiração não depender de alguém abrir a aba.

## 6. O que pode ser reaproveitado e o que precisa ser reimplementado

| Item | Situação |
|---|---|
| Lógica pura do motor (`subjectOf`, regras de marco, prazo, motivo) | **Reaproveitável como especificação**; o arquivo original mistura lógica e acesso a dados. Extrair uma função pura `calcularNovas(regras, recs, config, chavesExistentes)` é o caminho mais seguro e testável com os vetores do §3.2. |
| Constantes: status, rótulos, classes de cor, justificativas, núcleos, critérios, premiações, observação literal | **Reaproveitar os valores** (`dados-configuracao/`). |
| `diasRestantes`, regra "vence em ≤ 7 dias", normalização sem acento | Reaproveitável. |
| Fórmula de data `addDays` | **Reimplementar** (bug de fuso comprovado, §3.2 V5). |
| Todas as chamadas `supabase.from` | **Reimplementar** sobre os repositórios do §5.2. |
| Componentes React/shadcn (página, diálogos, Kanban, painel) | **Reimplementar** conforme o framework do destino; usar o original como **referência de layout, textos, validações e estados**. |
| Identidade via `localStorage`, rota protegida | **Substituir** (§5.1). |
| RLS aberto | **Não portar.** |
| Migrations SQL | Só se o destino for PostgreSQL; senão traduzir `schema.sql`. |

## 7. Diferenças a considerar conforme a tecnologia de destino

| Tema | Relacional (PostgreSQL/MySQL) | Documental / NoSQL | Notion / planilha / no-code |
|---|---|---|---|
| **Unicidade de `marcoChave`** | `UNIQUE` + `INSERT … ON CONFLICT DO NOTHING` (ou equivalente). **[Rec.]** isso torna o motor seguro contra execuções simultâneas; o original falha o lote inteiro em conflito. | Usar a `marcoChave` como **id do documento** (cria-se ou ignora). | Não há restrição de unicidade: consultar antes de criar e **serializar** a automação. |
| **Relações** | FKs com `ON DELETE` como no schema (CASCADE em tipo→regra/reconhecimento e bonificação→evento; SET NULL em regra/reconhecimento→bonificação). | Referências por id; replicar o comportamento de cascata/`SET NULL` no código. | Relation properties; apagar página não zera a relação do mesmo modo; testar. |
| **Datas** | `date` vs `timestamptz` como no schema. | Guardar `AAAA-MM-DD` como texto para datas de calendário. | Propriedade Date **sem hora** para `data`, `liberadaEm`, `prazoLimite`. |
| **Valores monetários** | `numeric` (sem ponto flutuante). | Decimal/inteiro em centavos. | Number (formato Real). |
| **Enums** | `text` + CHECK (o original **não** tem CHECK de status — [M]); **[Rec.]** adicionar. | Validar no código. | Select/Status. |
| **Motor** | Pode virar job/serviço no servidor. | Idem (função agendada). | **Não executa sozinho**: exige automação externa (n8n/Make/script) que implemente §3.1; fórmulas e rollups só exibem. |
| **Transações** | Entrega/cancelamento + evento devem ser **uma transação** **[Rec.]** (o original faz duas gravações soltas). | Idem (batch/transaction). | Sem transação: aceitar possibilidade de status sem evento. |
| **Ordem/consulta** | `ORDER BY` como em 01 §8. | Índices por `liberadaEm`/`data`. | Views ordenadas. |
| **Segurança** | Substituir RLS aberto por políticas reais. | Regras de segurança por coleção. | Permissões da página/base. |

### 7.1 Mapeamento sugerido para Notion (apenas se o destino for Notion) **[Rec.]**

| Banco | Propriedades |
|---|---|
| Tipos de Reconhecimento | Nome (título) · Escopo (Select) · Ativo (Checkbox) · Ordem (Number) |
| Regras de Bonificação | Nome · Tipo (Relation) · Critério (Select) · Quantidade (Number) · Ciclo (Number) · Exige adiantado (Checkbox) · Tipo de premiação (Select) · Valor (Number) · Descrição (Text) · Prazo (dias) (Number) · Ativa (Checkbox) · Ordem |
| Reconhecimentos | Título · Tipo (Relation) · Data (Date) · Projeto (Relation ao banco de projetos do destino) · Pessoa (Text) · Adiantado (Checkbox) · Núcleo (Select) · Observação · Criado por |
| Bonificações | Título · Regra/Reconhecimento (Relation) · **Chave do marco (Text)** · Marco · Snapshots (Text/Number) · Status (Status: Disponível/Entregue/Expirada/Cancelada) · Liberada em · Prazo limite · Entrega e cancelamento (Date/Text/Person) · Núcleo |
| Eventos | Evento (Select) · Bonificação (Relation) · Detalhe · Usuário · Criado em |
| Configuração | Página única com "Prazo padrão (dias)" |

Fórmulas úteis: `Dias restantes = dateBetween(prop("Prazo limite"), now(), "days")`; `Vence em breve = prop("Status") == "Disponível" and prop("Dias restantes") <= 7`. Views: Kanban por Status; Tabela "Recentes" ordenada por Liberada em ↓; filtros do §9 de 01. Botões de banco para entregar/cancelar.

## 8. Critérios de aceite para quem reconstruir

1. Os vetores V1–V5 (§3.2) passam, em qualquer fuso.
2. As 4 operações que disparam o motor o disparam; excluir reconhecimento não.
3. Textos de validação e mensagens de 01 §10 preservados.
4. Entregar/cancelar só habilitado para `disponivel`/`expirada`; eventos gravados com usuário.
5. Filtros e ordenações iguais aos de 01 §8–§9.
6. Nenhum comportamento marcado **[D]** ou **[Rec.]** foi tratado como requisito sem decisão explícita do responsável.
7. Pendências do documento `04` resolvidas ou aceitas por escrito.
