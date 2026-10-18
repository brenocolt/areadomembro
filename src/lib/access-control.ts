// Fonte única de verdade pra "quem pode ver/fazer o quê" no sistema.
// Usada por RouteGuard, AppSidebar e pelas rotas de API que protegem ação
// sensível — qualquer mudança na matriz de acesso deve acontecer aqui, não
// espalhada em cada tela/rota separadamente.
//
// Acesso a uma página é calculado em camadas, da mais ampla pra mais
// específica:
//   1. ADMIN (role) -> acesso total a tudo, sempre.
//   2. Matriz padrão por cargo_atual + nucleo_atual (este arquivo).
//   3. paginas_permitidas -> exceção manual, só SOMA páginas além da
//      matriz (nunca restringe abaixo do que a matriz já dá). Só pode ser
//      concedida por quem tem acesso de nível 3 em Gestão de Usuários
//      (ver getUsersManagementTier).

import { CARGO_FANTASMA, NUCLEO_GESTAO_DE_PESSOAS, isCargoGerencial } from './cargos'

export const NUCLEO_VICE_PRESIDENCIA = 'Vice Presidência'

export interface AccessColaborador {
    cargo_atual?: string | null
    nucleo_atual?: string | null
    paginas_permitidas?: string[] | null
}

export function isAdmin(role?: string | null): boolean {
    return (role ?? '').toUpperCase() === 'ADMIN'
}

export function isTaticoOuSuperior(cargo?: string | null): boolean {
    return cargo === 'Tático' || cargo === 'Estratégico' || cargo === CARGO_FANTASMA
}

export function isEstrategicoOuAdmin(cargo?: string | null): boolean {
    return cargo === 'Estratégico' || cargo === CARGO_FANTASMA
}

export function isNucleoGestaoDePessoas(nucleo?: string | null): boolean {
    return (nucleo ?? '').trim() === NUCLEO_GESTAO_DE_PESSOAS
}

export function isNucleoVicePresidencia(nucleo?: string | null): boolean {
    return (nucleo ?? '').trim() === NUCLEO_VICE_PRESIDENCIA
}

function isNucleoOverlay(nucleo?: string | null): boolean {
    return isNucleoGestaoDePessoas(nucleo) || isNucleoVicePresidencia(nucleo)
}

// Páginas que todo cargo (Operacional+) enxerga, independente de núcleo.
export const PAGINAS_UNIVERSAIS = [
    '/', '/profile', '/minhas-prioridades', '/performance', '/assistente-pessoal',
    '/wallet', '/pdi', '/formularios', '/milhas', '/punishments', '/pontuar-membros',
    '/presenca',
]

// Tático+ (de qualquer núcleo) OU qualquer cargo dos núcleos Gestão de
// Pessoas / Vice Presidência.
export const PAGINAS_TATICO_OU_NUCLEO_OVERLAY = [
    '/pdi-management', '/allocations-management',
]

// Padrão pra qualquer cargo do núcleo Gestão de Pessoas. Inclui
// /feedback-agente: essa tela já tem lógica própria (isCargoAssessorGP, em
// cargos.ts) pra liberar escolha de alvo a Operacionais desse núcleo — não
// fazia sentido deixá-la fora da matriz e invisível pra todo mundo.
export const PAGINAS_NUCLEO_GESTAO_DE_PESSOAS = [
    '/forms-management', '/points-management', '/miles-management',
    '/absences-management', '/reunioes-management', '/feedback-agente',
]

// Padrão pra qualquer cargo do núcleo Vice Presidência.
export const PAGINAS_NUCLEO_VICE_PRESIDENCIA = [
    '/pipj-management', '/absences-management', '/allocations-management',
]

// "Gestão de Usuários" não entra nas listas acima: o acesso varia por
// nível dentro da própria página (ver getUsersManagementTier).

// Conjunto de páginas que o cargo/núcleo dá por padrão (sem contar exceção
// manual nem o bypass de admin).
export function getPaginasPadrao(cargo?: string | null, nucleo?: string | null): Set<string> {
    const paginas = new Set<string>(PAGINAS_UNIVERSAIS)

    if (isTaticoOuSuperior(cargo) || isNucleoOverlay(nucleo)) {
        PAGINAS_TATICO_OU_NUCLEO_OVERLAY.forEach(p => paginas.add(p))
    }
    if (isNucleoGestaoDePessoas(nucleo)) {
        PAGINAS_NUCLEO_GESTAO_DE_PESSOAS.forEach(p => paginas.add(p))
    }
    if (isNucleoVicePresidencia(nucleo)) {
        PAGINAS_NUCLEO_VICE_PRESIDENCIA.forEach(p => paginas.add(p))
    }
    if (getUsersManagementTier(cargo, nucleo) > 0) {
        paginas.add('/users-management')
    }

    return paginas
}

// Nível de acesso dentro de Gestão de Usuários:
//   0 = sem acesso à página
//   1 = ver/editar dados básicos + desligar/reativar
//   2 = tier 1 + mudar cargo
//   3 = tier 2 + conceder acesso/role (inclui paginas_permitidas manuais e
//       os campos Pontos Negativos / Saldo PIPJ / Saldo de Milhas)
export function getUsersManagementTier(cargo?: string | null, nucleo?: string | null): 0 | 1 | 2 | 3 {
    if (isEstrategicoOuAdmin(cargo)) return 3

    const overlay = isNucleoOverlay(nucleo)
    if (overlay && isTaticoOuSuperior(cargo)) return 2
    if (overlay) return 1

    return 0
}

// Pontos Negativos / Saldo PIPJ / Saldo de Milhas — restrição que vale só
// dentro do diálogo de edição de Gestão de Usuários, em nenhuma outra tela.
export function podeEditarCamposSensiveisUsuarios(cargo?: string | null): boolean {
    return isEstrategicoOuAdmin(cargo)
}

// Página liberada pra esse colaborador: admin sempre, NPS Gerente pra
// cargos gerenciais (regra pré-existente, ver isCargoGerencial), senão
// matriz padrão + exceção manual (paginas_permitidas só soma, nunca
// restringe abaixo do padrão).
export function paginaPermitida(pathname: string, colaborador: AccessColaborador | null | undefined, role?: string | null): boolean {
    if (isAdmin(role)) return true

    if (pathname === '/nps-gerente' && isCargoGerencial(colaborador?.cargo_atual, colaborador?.nucleo_atual)) {
        return true
    }

    const padrao = getPaginasPadrao(colaborador?.cargo_atual, colaborador?.nucleo_atual)
    if (padrao.has(pathname)) return true

    const manual = colaborador?.paginas_permitidas
    if (manual && manual.includes(pathname)) return true

    return false
}
