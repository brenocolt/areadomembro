// Testes de autorização: quem pode (e quem NÃO pode) usar a aba Reconhecimentos.
import test from 'node:test'
import assert from 'node:assert/strict'
import {
    paginaPermitida, getPaginasPadrao, isRotaExclusivaVP, podeAcessarRotaExclusivaVP,
    PAGINAS_NUCLEO_VICE_PRESIDENCIA, PAGINAS_TATICO_OU_NUCLEO_OVERLAY, PAGINAS_UNIVERSAIS, PAGINAS_NUCLEO_GESTAO_DE_PESSOAS,
} from '../../src/lib/access-control.ts'
import { avaliarAcessoReconhecimentos } from '../../src/lib/reconhecimentos/acesso-servidor.ts'

const ROTA = '/reconhecimentos'
const colab = (o) => ({ cargo_atual: 'Operacional', nucleo_atual: 'Marketing', paginas_permitidas: [], status: 'Ativo', ...o })

test('a rota é exclusiva e NÃO entra em nenhuma matriz padrão', () => {
    assert.ok(isRotaExclusivaVP(ROTA))
    assert.ok(isRotaExclusivaVP('/reconhecimentos/qualquer/subrota'))
    assert.ok(!isRotaExclusivaVP('/reconhecimentos-falsa'))
    for (const lista of [PAGINAS_NUCLEO_VICE_PRESIDENCIA, PAGINAS_TATICO_OU_NUCLEO_OVERLAY, PAGINAS_UNIVERSAIS, PAGINAS_NUCLEO_GESTAO_DE_PESSOAS]) {
        assert.ok(!lista.includes(ROTA))
    }
    for (const [cargo, nucleo] of [['Operacional', 'Vice Presidência'], ['Estratégico', 'Presidência'], ['Administrador', 'Vice Presidência']]) {
        assert.ok(!getPaginasPadrao(cargo, nucleo).has(ROTA), `${cargo}/${nucleo} não deve ter a rota na matriz`)
    }
})

test('VP e ADMIN entram; todos os outros são barrados', () => {
    const casos = [
        // [descrição, colaborador, role, esperado]
        ['VP Operacional', colab({ nucleo_atual: 'Vice Presidência' }), 'COLABORADOR', true],
        ['VP Tático', colab({ cargo_atual: 'Tático', nucleo_atual: 'Vice Presidência' }), 'COLABORADOR', true],
        ['VP Estratégico', colab({ cargo_atual: 'Estratégico', nucleo_atual: 'Vice Presidência' }), 'COLABORADOR', true],
        ['VP grafado com hífen (dado legado)', colab({ nucleo_atual: 'Vice-Presidência' }), 'COLABORADOR', true],
        ['ADMIN sem colaborador', null, 'ADMIN', true],
        ['ADMIN em outro núcleo', colab({ nucleo_atual: 'Marketing' }), 'ADMIN', true],
        ['Estratégico de outro núcleo (Presidência)', colab({ cargo_atual: 'Estratégico', nucleo_atual: 'Presidência' }), 'COLABORADOR', false],
        ['Estratégico de Gestão de Pessoas', colab({ cargo_atual: 'Estratégico', nucleo_atual: 'Gestão de Pessoas' }), 'COLABORADOR', false],
        ['Conta "Administrador" (cargo fantasma) de outro núcleo', colab({ cargo_atual: 'Administrador', nucleo_atual: 'Marketing' }), 'COLABORADOR', false],
        ['Tático de Marketing', colab({ cargo_atual: 'Tático', nucleo_atual: 'Marketing' }), 'COLABORADOR', false],
        ['Operacional de Projetos', colab({ nucleo_atual: 'Projetos' }), 'COLABORADOR', false],
        ['Gestão de Pessoas', colab({ cargo_atual: 'Tático', nucleo_atual: 'Gestão de Pessoas' }), 'COLABORADOR', false],
        ['paginas_permitidas contendo a rota (exceção manual)', colab({ nucleo_atual: 'Marketing', paginas_permitidas: [ROTA] }), 'COLABORADOR', false],
        ['paginas_permitidas contendo o prefixo da rota', colab({ nucleo_atual: 'Marketing', paginas_permitidas: ['/reconhecimentos/x'] }), 'COLABORADOR', false],
        ['Estratégico de outro núcleo + paginas_permitidas', colab({ cargo_atual: 'Estratégico', nucleo_atual: 'Presidência', paginas_permitidas: [ROTA] }), 'COLABORADOR', false],
        ['VP desligado', colab({ nucleo_atual: 'Vice Presidência', status: 'Desligado' }), 'COLABORADOR', false],
        ['sem colaborador e sem ADMIN', null, 'COLABORADOR', false],
        ['sem dados nenhuns', undefined, undefined, false],
        ['núcleo vazio', colab({ nucleo_atual: '' }), 'COLABORADOR', false],
        ['role em minúsculas "admin" é ADMIN (mesma regra do sistema)', null, 'admin', true],
        ['role arbitrária "RH"', colab({ nucleo_atual: 'Marketing' }), 'RH', false],
    ]
    for (const [descricao, c, role, esperado] of casos) {
        assert.equal(paginaPermitida(ROTA, c, role), esperado, `paginaPermitida: ${descricao}`)
        assert.equal(paginaPermitida(`${ROTA}/sub`, c, role), esperado, `subrota: ${descricao}`)
        assert.equal(podeAcessarRotaExclusivaVP(c, role), esperado, `podeAcessar: ${descricao}`)
    }
})

test('outras páginas continuam com o comportamento anterior (sem regressão)', () => {
    const estrategico = colab({ cargo_atual: 'Estratégico', nucleo_atual: 'Presidência' })
    assert.ok(paginaPermitida('/pipj-management', estrategico, 'COLABORADOR'), 'Estratégico ainda vê Gestão de PIPJ')
    assert.ok(paginaPermitida('/wallet', colab(), 'COLABORADOR'))
    assert.ok(!paginaPermitida('/pipj-management', colab(), 'COLABORADOR'))
    assert.ok(paginaPermitida('/pipj-management', colab({ nucleo_atual: 'Vice Presidência' }), 'COLABORADOR'))
    assert.ok(paginaPermitida('/forms-management', colab({ paginas_permitidas: ['/forms-management'] }), 'COLABORADOR'), 'exceção manual continua valendo nas demais páginas')
    assert.ok(paginaPermitida('/qualquer', null, 'ADMIN'))
})

// ----------------------------------------------------- decisão no servidor

const usuarios = {
    'u-vp': { id: 'u-vp', email: 'vp@pj.com', role: 'COLABORADOR', colaborador_id: 'c-vp' },
    'u-adm': { id: 'u-adm', email: 'adm@pj.com', role: 'ADMIN', colaborador_id: null },
    'u-dir': { id: 'u-dir', email: 'dir@pj.com', role: 'COLABORADOR', colaborador_id: 'c-dir' },
    'u-mkt': { id: 'u-mkt', email: 'mkt@pj.com', role: 'COLABORADOR', colaborador_id: 'c-mkt' },
    'u-vp-off': { id: 'u-vp-off', email: 'off@pj.com', role: 'COLABORADOR', colaborador_id: 'c-vp-off' },
    'u-ex-adm': { id: 'u-ex-adm', email: 'ex@pj.com', role: 'COLABORADOR', colaborador_id: 'c-mkt' }, // token dirá ADMIN, banco diz COLABORADOR
    'u-orfao': { id: 'u-orfao', email: 'o@pj.com', role: 'COLABORADOR', colaborador_id: 'c-nao-existe' },
}
const colaboradores = {
    'c-vp': { id: 'c-vp', nome: 'Vera VP', cargo_atual: 'Operacional', nucleo_atual: 'Vice Presidência', paginas_permitidas: [], status: 'Ativo' },
    'c-dir': { id: 'c-dir', nome: 'Dani Diretora', cargo_atual: 'Estratégico', nucleo_atual: 'Presidência', paginas_permitidas: [ROTA], status: 'Ativo' },
    'c-mkt': { id: 'c-mkt', nome: 'Marcos', cargo_atual: 'Tático', nucleo_atual: 'Marketing', paginas_permitidas: [ROTA], status: 'Ativo' },
    'c-vp-off': { id: 'c-vp-off', nome: 'Vic Off', cargo_atual: 'Operacional', nucleo_atual: 'Vice Presidência', paginas_permitidas: [], status: 'Desligado' },
}
const deps = {
    buscarUsuario: async (id) => usuarios[id] ?? null,
    buscarColaborador: async (id) => colaboradores[id] ?? null,
}

test('servidor: sem sessão ou usuário inexistente -> 401', async () => {
    for (const sessao of [null, undefined, {}, { user: null }, { user: {} }, { user: { id: '' } }, { user: { id: 'u-inexistente' } }]) {
        const r = await avaliarAcessoReconhecimentos(sessao, deps)
        assert.deepEqual([r.ok, r.status], [false, 401], JSON.stringify(sessao))
    }
})

test('servidor: não autorizados -> 403 (inclusive com exceção manual e Estratégico)', async () => {
    for (const id of ['u-dir', 'u-mkt', 'u-vp-off', 'u-orfao']) {
        const r = await avaliarAcessoReconhecimentos({ user: { id } }, deps)
        assert.deepEqual([r.ok, r.status], [false, 403], id)
    }
})

test('servidor: VP e ADMIN autorizados, identidade vinda do banco', async () => {
    const vp = await avaliarAcessoReconhecimentos({ user: { id: 'u-vp' } }, deps)
    assert.equal(vp.ok, true)
    assert.equal(vp.usuario.email, 'vp@pj.com')
    assert.equal(vp.usuario.nome, 'Vera VP')
    const adm = await avaliarAcessoReconhecimentos({ user: { id: 'u-adm' } }, deps)
    assert.equal(adm.ok, true)
    assert.equal(adm.usuario.email, 'adm@pj.com')
})

test('servidor: o papel do token é ignorado — vale o do banco (ex-ADMIN rebaixado)', async () => {
    // O token da sessão pode dizer ADMIN; a função só olha o que o banco devolve.
    const r = await avaliarAcessoReconhecimentos({ user: { id: 'u-ex-adm', role: 'ADMIN', colaborador_id: 'c-vp' } }, deps)
    assert.deepEqual([r.ok, r.status], [false, 403])
})
