// Teste diferencial: executa o motor ORIGINAL (código do pacote, contra o banco
// simulado do pacote) e o motor reconstruído sobre os mesmos cenários
// aleatórios (semente fixa) e exige as mesmas bonificações novas.
// Roda em America/Sao_Paulo, fuso em que o original está correto (L-1).
process.env.TZ = 'America/Sao_Paulo'

import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { calcularBonificacoes } from '../../src/lib/reconhecimentos/engine.ts'

const aqui = path.dirname(fileURLToPath(import.meta.url))
const pacote = path.resolve(aqui, '../../docs/migracao-reconhecimentos')
const origem = path.join(pacote, 'codigo-fonte/aba-exclusiva/src/lib/bonificacoes-engine.ts.txt')
const mockOrigem = path.join(pacote, 'verificacao/mock.mjs')

async function carregarOriginal() {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'motor-original-'))
    fs.copyFileSync(mockOrigem, path.join(tmp, 'mock.mjs'))
    fs.writeFileSync(
        path.join(tmp, 'engine.ts'),
        fs.readFileSync(origem, 'utf8').replace("'@/integrations/supabase/client'", "'./mock.mjs'"),
    )
    const mock = await import(pathToFileURL(path.join(tmp, 'mock.mjs')).href)
    const motor = await import(pathToFileURL(path.join(tmp, 'engine.ts')).href)
    return { db: mock.db, sincronizar: motor.sincronizarBonificacoes }
}

// PRNG determinístico (mulberry32)
function prng(semente) {
    let a = semente
    return () => {
        a |= 0; a = (a + 0x6D2B79F5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}
const pick = (r, xs) => xs[Math.floor(r() * xs.length)]
const dia = (r) => `2026-${String(1 + Math.floor(r() * 6)).padStart(2, '0')}-${String(1 + Math.floor(r() * 28)).padStart(2, '0')}`

function cenario(semente) {
    const r = prng(semente)
    const tipos = [{ id: 'T1', nome: 'RG' }, { id: 'T2', nome: 'SDR' }, { id: 'T3', nome: 'Núcleo de Impacto' }]
    const regras = []
    const n = 1 + Math.floor(r() * 5)
    for (let i = 0; i < n; i++) {
        const criterio = pick(r, ['acumulado', 'acumulado', 'por_reconhecimento', 'simbolico'])
        regras.push({
            id: `R${i}`, nome: `Regra ${i}`, tipo_id: pick(r, tipos).id, criterio,
            quantidade_necessaria: pick(r, [1, 2, 3, 4, 5, 0]),
            ciclo: pick(r, [0, 0, 1, 2, 3, 4]),
            requer_rg_adiantada: r() < 0.5, requer_projeto_adiantado: r() < 0.15,
            tipo_premiacao: pick(r, ['financeira', 'premio']), valor: pick(r, [0, 12, 30, 50]),
            descricao_premiacao: pick(r, ['', 'R$ 12,00']), prazo_dias: pick(r, [null, null, 0, 10, 30, 90]),
            ativo: r() < 0.85,
        })
    }
    const recs = []
    const m = Math.floor(r() * 40)
    for (let i = 0; i < m; i++) {
        const t = pick(r, tipos)
        const projeto = r() < 0.6 ? pick(r, ['P1', 'P2', 'P3']) : null
        recs.push({
            id: `rec${i}`, tipo_id: t.id, data: dia(r),
            projeto_id: projeto, projeto_nome: projeto, pessoa_nome: projeto ? null : pick(r, ['Ana', 'Bia', 'Caio', null]),
            adiantado: r() < 0.5, rg_adiantada: r() < 0.1, projeto_adiantado: r() < 0.1,
            nucleo_impacto: t.id === 'T3' ? pick(r, ['CIT', 'CS']) : null,
        })
    }
    return { tipos, regras, recs, prazoPadrao: pick(r, [null, null, 15, 45]) }
}

const CAMPOS = ['marco_chave', 'regra_id', 'reconhecimento_id', 'marco', 'projeto_id', 'projeto_nome', 'pessoa_nome', 'nucleo_impacto',
    'tipo_nome', 'regra_nome', 'motivo', 'tipo_premiacao', 'valor', 'descricao_premiacao', 'status', 'liberada_em', 'prazo_limite']
const ordenar = (xs) => [...xs].sort((a, b) => a.marco_chave.localeCompare(b.marco_chave))
const recortar = (b) => Object.fromEntries(CAMPOS.map(c => [c, b[c] === undefined ? null : b[c]]))

test('motor reconstruído == motor original em 300 cenários aleatórios', async () => {
    const original = await carregarOriginal()
    let comBonificacao = 0
    for (let semente = 1; semente <= 300; semente++) {
        const { tipos, regras, recs, prazoPadrao } = cenario(semente)
        const db = original.db
        for (const k of Object.keys(db)) db[k].length = 0
        db.reconhecimento_tipos.push(...tipos.map(t => ({ ...t })))
        db.regras_bonificacao.push(...regras.map(r => ({ ...r })))
        db.reconhecimentos.push(...recs.map(r => ({ ...r })))
        if (prazoPadrao !== null) db.bonificacoes_config.push({ id: 'cfg', prazo_padrao_dias: prazoPadrao })

        const n = await original.sincronizar()
        const esperadas = ordenar(db.bonificacoes.map(recortar))

        const nomeTipo = Object.fromEntries(tipos.map(t => [t.id, t.nome]))
        const ordenadas = [...recs].sort((a, b) => a.data.localeCompare(b.data))
        const { novas } = calcularBonificacoes(
            regras.filter(r => r.ativo).map(r => ({ ...r, reconhecimento_tipos: { nome: nomeTipo[r.tipo_id] } })),
            ordenadas, prazoPadrao, [], '2026-10-19',
        )
        assert.equal(novas.length, n, `semente ${semente}: quantidade`)
        assert.deepEqual(ordenar(novas.map(recortar)), esperadas, `semente ${semente}: conteúdo`)
        if (n > 0) comBonificacao++
    }
    assert.ok(comBonificacao > 100, `cenários sem bonificação demais (${comBonificacao}/300)`)
})
