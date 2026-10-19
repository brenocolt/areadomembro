# 03 — Dependências e integrações

Separa o que **pertence exclusivamente** à aba do que é **compartilhado** com o resto do sistema de origem e descreve a **interface** que cada item compartilhado precisa oferecer. Não recomendo copiar nem remover itens compartilhados: no destino, o que importa é o **contrato** (como a aba os usa), não o arquivo.

Fonte de "quem mais usa": busca no commit `beeebbe` (último commit com a aba presente).

---

## 1. Exclusivo da aba (pode ser lido como o "pacote da funcionalidade")

Todos em `codigo-fonte/aba-exclusiva/` (mesmos caminhos do repositório, com sufixo `.txt`).

| Arquivo | Papel | Linhas |
|---|---|---|
| `src/pages/Reconhecimentos.tsx` | Página, sub-abas, filtros, cartões, tabelas, linha do tempo | 410 |
| `src/components/reconhecimentos/RegistrarDialog.tsx` | Formulário de registro (projeto/pessoa/núcleo) | 271 |
| `src/components/reconhecimentos/AjustarRgsDialog.tsx` | Ajuste das RGs anteriores ao sistema | 167 |
| `src/components/reconhecimentos/KanbanBonificacoes.tsx` | Kanban de 4 colunas | 78 |
| `src/components/reconhecimentos/BonificacaoDetalhe.tsx` | Painel lateral + diálogos de entrega/cancelamento | 318 |
| `src/components/reconhecimentos/ConfiguracoesRegras.tsx` | Prazo padrão, tipos e regras | 260 |
| `src/hooks/useBonificacoes.ts` | Consultas (6 hooks) | 83 |
| `src/lib/bonificacoes-engine.ts` | **Motor**, constantes de status, `diasRestantes`, `currentUser` | 162 |
| `supabase/migrations/20260921004534_…sql` | Cria as 6 tabelas, triggers, RLS e dados iniciais | — |
| `supabase/migrations/20260921005732_…sql` | Remove FKs de `projeto_id`; ajusta 2 regras por UUID; cria tipo e regra "Núcleo de Impacto" | — |
| `supabase/migrations/20260921011221_…sql` | Colunas `adiantado` e `nucleo_impacto` + CHECKs | — |
| `supabase/migrations/20260923135114_…sql` | Coluna `bonificacoes.entregue_para` | — |

Também exclusivos (sem arquivo próprio): item de menu e rota (ver §2.1), as 6 tabelas e as chaves de cache do TanStack Query listadas em 01 §11.

Tabelas exclusivas: `reconhecimento_tipos`, `regras_bonificacao`, `reconhecimentos`, `bonificacoes`, `bonificacao_eventos`, `bonificacoes_config`. Nenhum outro código do sistema as lê ou grava (busca em `src/`, `supabase/functions/` e `drizzle/`: nada além dos arquivos acima). [C]

## 2. Compartilhado: como a aba usa cada item e o que preservar

Cópias integrais em `codigo-fonte/compartilhado/` **apenas para consulta**.

### 2.1 Pontos de integração no aplicativo
| Item | Uso pela aba | Quem mais usa | Contrato a preservar |
|---|---|---|---|
| `src/App.tsx` | 1 `import` e 1 `<Route path="/reconhecimentos">` dentro de `ProtectedRoute` + `AppLayout` | todo o app | A aba precisa ser renderizável como uma rota/tela dentro do layout autenticado. Também exige `QueryClientProvider` e os toasters (`<Sonner />`) montados globalmente. |
| `src/components/layout/AppSidebar.tsx` | Entrada `{ title: 'Reconhecimentos e Bonificações', url: '/reconhecimentos', icon: Award }` na lista principal | todo o app | Uma entrada de navegação com esse título. |
| `src/components/ProtectedRoute.tsx` | Protege a rota | todo o app | Só usuários autenticados acessam. A aba **não** usa `AdminRoute`. |

### 2.2 Dados de outra parte do sistema (única dependência de **dados**)
| Item | Uso pela aba | Quem mais usa | Contrato a preservar |
|---|---|---|---|
| Tabela `categorias_entradas` (`id`, `nome`, `ativo`, `ordem`; coluna adicional `projeto_id`) e hook `useCategoriasEntradas()` | Descobrir quais categorias contêm projetos atendidos (filtro por nome) | `FluxoMensal`, `AssembleiaGeral`, `ProjecoesEntradas*` | Para cada categoria: `id`, `nome`, `ativo`. |
| Tabela `centros_custo_entradas` (`id`, `categoria_entrada_id`, `nome`, `ativo`, `ordem`) e hook `useCentrosCustoEntradas()` | **Fonte da lista de projetos**: cada centro de custo de uma categoria válida é um "projeto" | idem | Para cada item: `id` estável, `nome`, `ativo`, `categoria_entrada_id`. O `id` é gravado em `reconhecimentos.projeto_id`. |
| `projetos_entradas` | Só histórico: era o alvo da FK de `projeto_id`, removida | telas de Projeções de Entradas | **Não é necessária** no destino. |

O hook original faz `select('*, projetos_entradas(nome)')` e `select('*, categorias_entradas(nome)')`; **a aba não usa essas junções** (usa apenas os campos acima). [C]

Regra de seleção dos projetos (no original): categoria ativa cujo `nome` normalizado (minúsculas, sem acento) contém ("consultoria" **ou** "assessoria") **e** "2026", **ou** contém "mentoria"; centros de custo ativos dessas categorias, em ordem alfabética pt-BR. [C] O destino precisa de uma fonte equivalente (`ProvedorDeProjetos`, `02 §5.1`).

### 2.2.1 Dependência de dados **de entrada que não vem do banco**
- Nomes de pessoas (reconhecidas e recebedoras) são **texto livre**; as sugestões vêm dos `pessoa_nome` já registrados. Não há tabela de pessoas. [C]

### 2.3 Bibliotecas internas
| Item | Uso | Quem mais usa | Contrato a preservar |
|---|---|---|---|
| `src/lib/formatters.ts` — `formatCurrency(n)`, `formatDate(s\|Date)` | Exibir premiação e datas | 10 outros arquivos | `formatCurrency(12)` → `"R$ 12,00"` (pt-BR/BRL). `formatDate("2026-01-31")` → `"31/01/2026"`; strings `AAAA-MM-DD` viram data **local** (evita deslocar um dia); outras entradas via `new Date`. |
| `src/lib/utils.ts` — `cn()` | Só indiretamente (via `searchable-select`) | todos | Mesclar classes. Irrelevante fora de Tailwind. |
| `src/components/ui/searchable-select.tsx` — `SearchableSelect` | Escolha de projeto em `RegistrarDialog` e `AjustarRgsDialog` | `FluxoMensal` | Props: `value?`, `onValueChange(value)`, `options: {value,label}[]`, `placeholder?`, `searchPlaceholder?`, `emptyText?`, `className?`. Ordena por rótulo pt-BR e filtra **sem acento/caixa**. |
| `src/lib/auth-utils.ts` | **Não** usado pela aba | `Login`, `AdminRoute`, `AppSidebar`, `ContasSolicitacoes` | — (consultar só para entender a identidade). |
| `src/hooks/useFinanceData.ts` | Apenas `useCategoriasEntradas` e `useCentrosCustoEntradas` | várias telas | Ver §2.2. O restante do arquivo (lançamentos, projeções etc.) **não faz parte** da aba. |

### 2.4 Identidade do usuário
- `currentUser()` (em `bonificacoes-engine.ts`) lê `localStorage['app_user_email']`, com fallback `'sistema'`. Esse valor vai para `criado_por`, `entregue_por`, `cancelada_por` e `usuario` dos eventos. [C]
- O login do sistema de origem (`src/pages/Login.tsx`) grava essa chave. **Esse arquivo não foi copiado** para o pacote: contém uma credencial de administrador escrita no código (ver `04`, item S-1). O mecanismo, para fins de integração: autentica contra a tabela `solicitacoes_acesso` (contas aprovadas, senha com SHA-256) ou uma conta administrativa fixa, e grava `app_auth`, `app_user_email`, `app_is_admin` no `localStorage`. [C]
- **Contrato:** o destino deve fornecer `UsuarioAtual.identificador()` (`02 §5.1`).

### 2.5 Banco e infraestrutura
| Item | Uso | Quem mais usa | Contrato |
|---|---|---|---|
| Função `public.update_updated_at_column()` (`NEW.updated_at = now()`) | Triggers de `updated_at` em 4 das 6 tabelas | triggers de outras tabelas (ex.: `notas_categorias`, `inadimplentes`) | Qualquer mecanismo que atualize `updated_at` a cada UPDATE. A tabela `bonificacoes_config` **não** tem trigger; `bonificacao_eventos` não tem `updated_at`. |
| Cliente `src/integrations/supabase/client.ts` e `types.ts` (gerados) | Acesso aos dados e tipos. `client.ts` importa `./previewAuthStorage`, módulo **específico da plataforma Lovable que não está no pacote** (só trata armazenamento de sessão do Supabase Auth, que a aba não usa) | todo o app | No destino, substituído pela camada de repositório. Extrato dos tipos das 6 tabelas em `codigo-fonte/compartilhado/src/integrations/supabase/types.EXTRATO-6-tabelas.ts.txt`. |
| Supabase (PostgreSQL + PostgREST) | Persistência | todo o app | Ver `02 §7`. A aba **não** usa Auth, Storage, Edge Functions, RPC nem Realtime. [C] |

### 2.6 Interface (tema e bibliotecas)
| Item | Uso pela aba | Observação |
|---|---|---|
| Tokens de cor do Tailwind: `primary`, `accent`, `success`, `warning`, `destructive`, `muted`, `card`, `border`, `input`, `foreground`, `primary-foreground` | Badges de status (`STATUS_CLASS`), ícones dos cartões, alertas | Mapeamento de status: disponível=primary, entregue=success, expirada=warning, cancelada=destructive. Valores HSL em `codigo-fonte/compartilhado/src/index.css.txt`. |
| Classe `.stat-card` (`index.css`) | Cartões da Visão Geral | Também usada por `components/gastos/*`. É só estilo (cartão com borda, sombra, hover). |
| Fonte do tema (`font-heading`/`font-display`; Sora e DM Sans) | Títulos e números dos cartões | `tailwind.config.ts` e `index.css`. |
| shadcn/ui (estilo `default`, base `slate`) — componentes: `tabs`, `card`, `button`, `input`, `label`, `badge`, `select`, `table`, `dialog` (com `DialogDescription`), `sheet`, `textarea`, `switch`, `popover` (via `SearchableSelect`) | Toda a interface | São componentes **padrão** do shadcn (gerados com `npx shadcn add`), sem alteração relevante para a aba; por isso **não foram copiados**. Ver `components.json`. |
| `lucide-react` (^0.462) — `Award, Gift, CheckCircle2, XCircle, Plus, Search, Trash2, LayoutGrid, History, Settings, ClipboardList, Calculator, Pencil, X, AlertTriangle, Building2, CalendarDays, Clock3, Check, ChevronDown` | Ícones | Substituíveis. |
| `sonner` (^1.7) | Toasts | Substituível; manter os textos. |
| `@tanstack/react-query` (^5.83) | Cache e invalidação | Substituível. |
| `react` ^18.3, `react-router-dom` ^6.30 | Base | — |

## 3. Matriz resumida

| Categoria | Itens |
|---|---|
| **Exclusivo** | 8 arquivos de código + 4 migrations + 6 tabelas + rota + item de menu |
| **Compartilhado, só interface a respeitar** | `formatters`, `SearchableSelect`, tema/shadcn, `ProtectedRoute`/layout, `update_updated_at_column` |
| **Compartilhado, dado de outra área** | `categorias_entradas`, `centros_custo_entradas` (lista de projetos) |
| **Compartilhado, identidade** | `localStorage.app_user_email` (login) |
| **Fora do pacote por segurança** | `Login.tsx` |
| **Não usados pela aba** | Edge Functions, RPC, Storage, Realtime, `AdminRoute`, `useMonday`, `useRides`, `drizzle/` |
