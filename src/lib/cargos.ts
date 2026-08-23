// Lista fixa de cargos específicos da área do membro. Usada no autocadastro
// (signup) e como "Função" no detalhe de Gestão de Usuários — continua
// granular porque outras partes do site (NPS Gerente/Projeto, Agente de
// Feedback, menu lateral) precisam saber exatamente qual é a função da
// pessoa, não só o nível dela.
export const CARGOS = [
    'Assessor',
    'Consultor',
    'SDR',
    'Closer',
    'Diretor',
    'Gerente de Projetos',
    'Gerente de Inovação',
    'Gerente de Operações',
    'Gerente de CS',
    'Gerente de Gente',
    'Gerente Institucional',
    'Administrador',
] as const

export type Cargo = typeof CARGOS[number]

// Contas fantasmas (uso administrativo do sistema, sem vínculo de
// remuneração) — nunca recebem PIPJ, milhas ou pontos, e ficam de fora de
// rankings/totais.
export const CARGO_FANTASMA = 'Administrador'

// Cargos oferecidos no autocadastro público (sem "Administrador" — essa
// atribuição só pode ser feita manualmente por um admin).
export const CARGOS_AUTOCADASTRO = CARGOS.filter(c => c !== CARGO_FANTASMA)

// Níveis simplificados de cargo, exibidos e editados em Gestão de Usuários
// (campo "Cargo"). Substituem a lista extensa de funções específicas como a
// categorização principal mostrada aos administradores.
export const NIVEIS_CARGO = [
    'Operacional',
    'Tático',
    'Estratégico',
    'Administrador',
] as const

export type NivelCargo = typeof NIVEIS_CARGO[number]

export const NIVEL_CARGO_FANTASMA: NivelCargo = 'Administrador'

// Descrição de cada nível — usada como apoio visual no dropdown.
export const NIVEL_CARGO_DESCRICAO: Record<NivelCargo, string> = {
    Operacional: 'Assessor, Consultor e SDR',
    Tático: 'Gerentes e Closer',
    Estratégico: 'Diretor',
    Administrador: 'Conta administrativa do sistema',
}

// Mapa da função específica (cargo antigo) para o nível correspondente —
// usado para popular Gestão de Usuários automaticamente ao editar a
// "Função" de alguém, e para a migração que preencheu os dados existentes.
export const CARGO_PARA_NIVEL: Record<string, NivelCargo> = {
    'Assessor': 'Operacional',
    'Consultor': 'Operacional',
    'SDR': 'Operacional',
    'Closer': 'Tático',
    'Gerente de Projetos': 'Tático',
    'Gerente de Inovação': 'Tático',
    'Gerente de Operações': 'Tático',
    'Gerente de CS': 'Tático',
    'Gerente de Gente': 'Tático',
    'Gerente Institucional': 'Tático',
    'Diretor': 'Estratégico',
    'Administrador': 'Administrador',
}

// Deriva o nível a partir de uma função específica. Cai em "Operacional"
// para valores fora da lista (defensivo — mesma régua usada na migração de
// dados).
export function cargoParaNivel(cargo: string | null | undefined): NivelCargo {
    if (!cargo) return 'Operacional'
    return CARGO_PARA_NIVEL[cargo] || 'Operacional'
}
