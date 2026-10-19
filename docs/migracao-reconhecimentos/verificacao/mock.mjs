// Banco simulado em memória, só o suficiente para as chamadas do motor.
export const db = { regras_bonificacao: [], reconhecimentos: [], bonificacoes: [], bonificacao_eventos: [], bonificacoes_config: [], reconhecimento_tipos: [] };
let seq = 0;
const tipoNome = (id) => db.reconhecimento_tipos.find(t => t.id === id)?.nome;
function builder(table) {
  const st = { op: 'select', filters: [], payload: null, sel: null, order: null, one: false };
  const run = () => {
    let rows = db[table];
    if (st.op === 'insert') {
      const arr = Array.isArray(st.payload) ? st.payload : [st.payload];
      if (table === 'bonificacoes') {
        for (const r of arr) if (db.bonificacoes.some(b => b.marco_chave === r.marco_chave)) return { data: null, error: { message: 'duplicate key marco_chave' } };
      }
      const ins = arr.map(r => ({ id: `${table}-${++seq}`, ...r }));
      db[table].push(...ins);
      return { data: ins.map(r => ({ id: r.id })), error: null };
    }
    if (st.op === 'update') {
      for (const r of rows) if (st.filters.every(f => f(r))) Object.assign(r, st.payload);
      return { data: null, error: null };
    }
    rows = rows.filter(r => st.filters.every(f => f(r)));
    if (st.order) rows = [...rows].sort((a, b) => String(a[st.order]).localeCompare(String(b[st.order])));
    if (table === 'regras_bonificacao') rows = rows.map(r => ({ ...r, reconhecimento_tipos: { nome: tipoNome(r.tipo_id) } }));
    if (table === 'reconhecimentos') rows = rows.map(r => ({ ...r, reconhecimento_tipos: { nome: tipoNome(r.tipo_id) } }));
    return { data: st.one ? (rows[0] ?? null) : rows, error: null };
  };
  const b = {
    select(s) { st.sel = s; return b; },
    insert(p) { st.op = 'insert'; st.payload = p; return b; },
    update(p) { st.op = 'update'; st.payload = p; return b; },
    eq(k, v) { st.filters.push(r => r[k] === v); return b; },
    in(k, vs) { st.filters.push(r => vs.includes(r[k])); return b; },
    order(k) { st.order = k; return b; },
    limit() { return b; },
    maybeSingle() { st.one = true; return b; },
    then(res, rej) { try { res(run()); } catch (e) { rej(e); } },
  };
  return b;
}
export const supabase = { from: builder };
