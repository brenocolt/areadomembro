// Cliente Supabase simulado em memória — só o subconjunto de PostgREST usado
// por src/lib/reconhecimentos/repositorio.ts. NÃO é um banco real: serve para
// exercitar a lógica de servidor (motor + gravações) sem rede.
import { randomUUID } from 'node:crypto'

export function criarBanco() {
    const tabelas = {
        reconhecimento_tipos: [], regras_bonificacao: [], reconhecimentos: [],
        bonificacoes: [], bonificacao_eventos: [], bonificacoes_config: [], projetos: [],
    }
    const ganchos = { antesDeUpsert: null }
    let relogio = Date.UTC(2026, 0, 1)
    const agora = () => new Date((relogio += 1000)).toISOString()

    const padroes = {
        reconhecimento_tipos: () => ({ escopo: 'pessoa', ativo: true, ordem: 0 }),
        regras_bonificacao: () => ({ criterio: 'por_reconhecimento', quantidade_necessaria: 1, ciclo: 0, requer_rg_adiantada: false, requer_projeto_adiantado: false, tipo_premiacao: 'financeira', valor: 0, descricao_premiacao: '', prazo_dias: null, ativo: true, ordem: 0 }),
        reconhecimentos: () => ({ adiantado: false, rg_adiantada: false, projeto_adiantado: false, projeto_id: null, projeto_nome: null, pessoa_nome: null, nucleo_impacto: null, observacao: null }),
        bonificacoes: () => ({ status: 'disponivel', entregue_em: null, entregue_para: null, observacao_entrega: null, cancelada_em: null, justificativa_cancelamento: null, nucleo_impacto: null }),
        bonificacao_eventos: () => ({}),
        bonificacoes_config: () => ({ prazo_padrao_dias: null }),
        projetos: () => ({}),
    }

    const comJuncao = (tabela, linha, colunas) => {
        if (!/reconhecimento_tipos\(/.test(colunas || '')) return linha
        const t = tabelas.reconhecimento_tipos.find(x => x.id === linha.tipo_id)
        return { ...linha, reconhecimento_tipos: t ? { nome: t.nome, escopo: t.escopo } : null }
    }
    const comparar = (a, b) => (a === b ? 0 : a === null || a === undefined ? 1 : b === null || b === undefined ? -1 : a < b ? -1 : 1)

    function from(tabela) {
        const st = { op: 'select', filtros: [], ordens: [], faixa: null, unico: false, retorna: null, payload: null, opcoes: {}, contar: false }
        const executar = () => {
            const linhas = tabelas[tabela]
            const casa = (l) => st.filtros.every(f => f(l))
            if (st.op === 'insert' || st.op === 'upsert') {
                if (st.op === 'upsert') ganchos.antesDeUpsert?.(tabelas)
                const novas = []
                for (const p of Array.isArray(st.payload) ? st.payload : [st.payload]) {
                    if (tabela === 'bonificacoes' && linhas.some(b => b.marco_chave === p.marco_chave)) {
                        if (st.op === 'upsert' && st.opcoes.ignoreDuplicates) continue
                        return { data: null, error: { message: 'duplicate key value violates unique constraint "bonificacoes_marco_chave_key"' } }
                    }
                    const linha = { id: randomUUID(), created_at: agora(), updated_at: agora(), ...padroes[tabela](), ...p }
                    linhas.push(linha)
                    novas.push(linha)
                }
                return { data: st.retorna ? novas.map(l => proj(l, st.retorna)) : null, error: null }
            }
            if (st.op === 'update') {
                const alvo = linhas.filter(casa)
                alvo.forEach(l => Object.assign(l, st.payload, { updated_at: agora() }))
                return { data: st.retorna ? alvo.map(l => proj(l, st.retorna)) : null, error: null }
            }
            if (st.op === 'delete') {
                const alvo = linhas.filter(casa)
                for (const l of alvo) {
                    linhas.splice(linhas.indexOf(l), 1)
                    if (tabela === 'reconhecimentos') tabelas.bonificacoes.forEach(b => { if (b.reconhecimento_id === l.id) b.reconhecimento_id = null }) // SET NULL
                    if (tabela === 'bonificacoes') tabelas.bonificacao_eventos = tabelas.bonificacao_eventos.filter(e => e.bonificacao_id !== l.id) // CASCADE
                }
                return { data: st.retorna ? alvo.map(l => proj(l, st.retorna)) : null, error: null }
            }
            let r = linhas.filter(casa)
            for (const o of [...st.ordens].reverse()) r = [...r].sort((a, b) => (o.asc ? 1 : -1) * comparar(a[o.col], b[o.col]))
            if (st.contar) return { data: st.head ? null : r, count: r.length, error: null }
            if (st.faixa) r = r.slice(st.faixa[0], st.faixa[1] + 1)
            if (st.limite !== undefined) r = r.slice(0, st.limite)
            r = r.map(l => comJuncao(tabela, l, st.colunas))
            return { data: st.unico ? (r[0] ?? null) : r, error: null }
        }
        const proj = (l, cols) => (cols === '*' || !cols ? l : Object.fromEntries(cols.split(',').map(c => c.trim()).filter(c => c in l).map(c => [c, l[c]])))
        const b = {
            select(cols, opcoes = {}) {
                if (st.op === 'select') { st.colunas = cols; if (opcoes.count) { st.contar = true; st.head = opcoes.head } }
                else st.retorna = cols || '*'
                return b
            },
            insert(p) { st.op = 'insert'; st.payload = p; return b },
            upsert(p, o) { st.op = 'upsert'; st.payload = p; st.opcoes = o || {}; return b },
            update(p) { st.op = 'update'; st.payload = p; return b },
            delete() { st.op = 'delete'; return b },
            eq(c, v) { st.filtros.push(l => l[c] === v); return b },
            in(c, vs) { st.filtros.push(l => vs.includes(l[c])); return b },
            order(col, o = {}) { st.ordens.push({ col, asc: o.ascending !== false }); return b },
            range(de, ate) { st.faixa = [de, ate]; return b },
            limit(n) { st.limite = n; return b },
            maybeSingle() { st.unico = true; return b },
            then(res, rej) { try { res(executar()) } catch (e) { rej?.(e) } },
        }
        return b
    }
    return { db: { from }, tabelas, ganchos }
}

// Semente equivalente à migration: tipos + regras comprovadas + config vazia.
export function semear(tabelas) {
    const tipos = [
        ['RG / Projeto reconhecido', 'projeto', 1], ['Piloto de Elite', 'pessoa', 2], ['Líder de Voo', 'pessoa', 3],
        ['SDR do Mês', 'pessoa', 4], ['Closer do Mês', 'pessoa', 5], ['Consultor do Mês', 'pessoa', 6], ['Núcleo de Impacto', 'pessoa', 7],
    ]
    const id = {}
    for (const [nome, escopo, ordem] of tipos) {
        const t = { id: randomUUID(), nome, escopo, ativo: true, ordem, created_at: '2026-01-01T00:00:00Z' }
        tabelas.reconhecimento_tipos.push(t); id[nome] = t.id
    }
    const regra = (nome, tipo, criterio, q, ciclo, adi, prem, valor, desc, ordem) => tabelas.regras_bonificacao.push({
        id: randomUUID(), nome, tipo_id: id[tipo], criterio, quantidade_necessaria: q, ciclo, requer_rg_adiantada: adi,
        requer_projeto_adiantado: false, tipo_premiacao: prem, valor, descricao_premiacao: desc, prazo_dias: null, ativo: true, ordem,
    })
    regra('SDR do Mês', 'SDR do Mês', 'por_reconhecimento', 1, 0, false, 'financeira', 50, 'R$ 50,00', 2)
    regra('Closer do Mês', 'Closer do Mês', 'por_reconhecimento', 1, 0, false, 'financeira', 50, 'R$ 50,00', 3)
    regra('Consultor do Mês', 'Consultor do Mês', 'por_reconhecimento', 1, 0, false, 'financeira', 50, 'R$ 50,00', 4)
    regra('RGs adiantadas — ciclo R$ 12', 'RG / Projeto reconhecido', 'acumulado', 2, 4, true, 'financeira', 12, 'R$ 12,00', 6)
    regra("RGs adiantadas — ciclo R$ 30 / McDonald's", 'RG / Projeto reconhecido', 'acumulado', 4, 4, true, 'premio', 30, "R$ 30 / McDonald's", 7)
    regra('Núcleo de Impacto', 'Núcleo de Impacto', 'por_reconhecimento', 1, 0, false, 'financeira', 30, 'R$ 30 por membro do núcleo', 8)
    tabelas.bonificacoes_config.push({ id: randomUUID(), prazo_padrao_dias: null })
    return id
}
