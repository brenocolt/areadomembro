# Pacote de transferência — "Reconhecimentos e Bonificações"

Material para **reconstruir** a aba em outro sistema (de arquitetura diferente) **sem consultar o sistema de origem**.

- **Origem:** [VP] Acompanhamento Fin — repositório `produtivajunior-prog/acompanhamentofinanceirovp`, React + Vite + TypeScript + shadcn/ui + TanStack Query + Supabase (PostgreSQL). Rota `/reconhecimentos`.
- **Gerado a partir do commit `beeebbe`** (idêntico ao `main`; último commit em que a aba existe).
- **Escopo:** estrutura, regras, comportamento e código. **Nenhum registro foi extraído** (decisão do responsável) e nenhuma consulta nova foi feita ao banco.
- **Nada foi implementado no destino.**

## Por onde começar

| Ordem | Arquivo | Para quê |
|---|---|---|
| 1 | **`01-funcionamento.md`** | Como a funcionalidade funciona de ponta a ponta: tipos, regras, motor, valores, ciclo de vida, telas, filtros, formulários, dependência do Supabase, permissões. Cada afirmação marcada **[C] [B] [M] [D]**. |
| 2 | **`02-especificacao-tecnica.md`** | Requisitos, estrutura de dados, regras de negócio, algoritmo do motor, **vetores de teste executados**, entradas/saídas, contratos, o que reaproveitar/reimplementar e diferenças por tecnologia de destino. |
| 3 | **`03-dependencias-e-integracoes.md`** | O que é **exclusivo** da aba × **compartilhado** com o resto do sistema, e o **contrato** de cada item compartilhado. |
| 4 | **`04-pendencias-e-limitacoes.md`** | O que **não** foi confirmado, pendências que alteram a reconstrução, defeitos do original a não copiar, achados de segurança. **Leia antes de implementar.** |

### Legenda de confiabilidade (usada em todos os documentos)

| Marca | Significado |
|---|---|
| **[C]** | Confirmado no código-fonte (e, quando indicado, **executado**). |
| **[B]** | Confirmado no banco de produção (só colunas e contagens). |
| **[M]** | Vem apenas das migrations; **não verificado** em produção. |
| **[D]** | Dedução minha; **não tratar como fato**. |
| **[Rec.]** | Recomendação para o destino; não é comportamento do original. |

## Mapa do pacote

```
docs/migracao-reconhecimentos/
├── README.md                          ← este índice
├── 01-funcionamento.md                ← regras de negócio e comportamento
├── 02-especificacao-tecnica.md        ← especificação para reconstrução
├── 03-dependencias-e-integracoes.md   ← exclusivo × compartilhado, contratos
├── 04-pendencias-e-limitacoes.md      ← não confirmado, riscos, segurança
├── codigo-fonte/                      ← código INTEGRAL (arquivos com sufixo .txt para não entrarem em lint/build)
│   ├── aba-exclusiva/                 ← o que pertence só à aba (8 arquivos + 4 migrations), mesmos caminhos do repositório
│   └── compartilhado/                 ← cópias de CONSULTA do que a aba usa e outras áreas também usam
├── estrutura/
│   ├── schema.sql                     ← DDL consolidado (com nível de verificação no cabeçalho)
│   ├── modelo.json                    ← modelo neutro: bancos, campos, relações, filtros, fórmulas
│   └── remocao_banco_pendente.sql     ← DROP das 6 tabelas. NÃO EXECUTADO. Não faz parte da reconstrução.
├── dados-configuracao/                ← tipos, regras, núcleos, status, justificativas, dicionário de campos (CSV)
└── verificacao/                       ← motor original executado contra banco simulado
    ├── executar.sh                    ← roda tudo (Node ≥ 22.6; sem rede)
    ├── mock.mjs, run.mjs, tz.mjs
    ├── saida-esperada.txt             ← saída da execução, para comparação
    ├── validar-schema.mjs             ← prova que estrutura/schema.sql == migrations originais (PostgreSQL em memória, PGlite)
    └── saida-validar-schema.txt       ← resultado dessa prova
```

### Conteúdo de `codigo-fonte/aba-exclusiva/`
`src/pages/Reconhecimentos.tsx` · `src/components/reconhecimentos/{RegistrarDialog,AjustarRgsDialog,KanbanBonificacoes,BonificacaoDetalhe,ConfiguracoesRegras}.tsx` · `src/hooks/useBonificacoes.ts` · `src/lib/bonificacoes-engine.ts` · 4 migrations em `supabase/migrations/`.

### Conteúdo de `codigo-fonte/compartilhado/`
`App.tsx` e `AppSidebar.tsx` (pontos de integração) · `AppLayout`, `ProtectedRoute`, `AdminRoute` · `lib/{auth-utils,formatters,utils}.ts` · `hooks/useFinanceData.ts` (a aba usa só 2 hooks) · `ui/searchable-select.tsx` · `supabase/client.ts` · extrato de `types.ts` com as 6 tabelas · `index.css`, `tailwind.config.ts`, `components.json` · migrations das tabelas de **entradas** (fonte da lista de projetos) e da função `update_updated_at_column`.
**Não incluídos de propósito:** `Login.tsx` (contém credencial no código — ver `04` S-1) e os componentes padrão do shadcn/ui (listados em `03 §2.6`).

## Como usar em uma nova conversa / execução do Claude Code

1. Dê acesso ao **sistema de destino** e anexe **esta pasta inteira**.
2. Informe (não está neste pacote, depende de você):
   - Tecnologia e banco do destino, e onde a aba deve ficar (rota/menu/página).
   - **Qual é a lista de projetos** no destino (`02 §5.1`, pendência P-6).
   - Como o destino identifica o **usuário atual** e quem pode acessar a aba.
   - Se o motor deve rodar também no servidor/agendado (a expiração depende disso).
   - Decisões das pendências **P-1 a P-8** do `04` (ou autorização para validá-las no banco de origem com as consultas V-1…V-4, somente leitura).
3. Peça que a implementação siga o `02` e passe nos **vetores V1–V5** (`02 §3.2`).

Sugestão de prompt:

> Reconstrua a funcionalidade "Reconhecimentos e Bonificações" neste projeto seguindo `docs/migracao-reconhecimentos/02-especificacao-tecnica.md`. Use `01-funcionamento.md` como referência de comportamento e `codigo-fonte/` apenas como referência de layout, textos e validações (não copie o código: a arquitetura é diferente). Respeite `03` para integrar com o que já existe aqui e trate `04` como lista de pendências: não implemente itens [D] como se fossem fatos. Implemente o motor como função pura testável e valide com os vetores V1–V5.

## Como validar que o motor reconstruído está igual ao original

`./verificacao/executar.sh` executa o motor **original** e imprime os resultados esperados (V1–V5). Compare com a saída do motor do destino para os mesmos dados.

## Estado e limites desta etapa

- Nada foi alterado no sistema de destino, na aba original (no `main`), no banco ou no PR #1. Nenhum registro foi consultado.
- O PR [#1](https://github.com/produtivajunior-prog/acompanhamentofinanceirovp/pull/1) (remoção da aba) continua **aberto, em rascunho e sem merge**.
- Esta pasta é incluída em commit **local** na branch `claude/lovable-github-project-6hylot`; **não foi enviada ao GitHub** nesta etapa.
