#!/usr/bin/env bash
# Executa o motor ORIGINAL (codigo-fonte/aba-exclusiva/src/lib/bonificacoes-engine.ts.txt) contra um banco simulado em memória.
# Requer Node >= 22.6 (--experimental-strip-types). Não acessa rede nem banco real.
set -euo pipefail
AQUI="$(cd "$(dirname "$0")" && pwd)"
RAIZ="$AQUI/.."
TMP="$(mktemp -d)"
cp "$AQUI/mock.mjs" "$AQUI/run.mjs" "$AQUI/tz.mjs" "$TMP/"
sed "s#'@/integrations/supabase/client'#'./mock.mjs'#" "$RAIZ/codigo-fonte/aba-exclusiva/src/lib/bonificacoes-engine.ts.txt" > "$TMP/engine.ts"
cd "$TMP"
echo "### Vetores do motor"; node --experimental-strip-types run.mjs 2>&1 | grep -v -e ExperimentalWarning -e "node --trace"
echo; echo "### Aritmética de datas por fuso (addDays do motor)"
for tz in America/Sao_Paulo UTC Europe/Berlin Asia/Tokyo; do TZ=$tz node tz.mjs; done
