// Lista fixa de cargos da área do membro. Usada nos formulários de
// cadastro/edição (dropdown) e nas regras de cálculo de PIPJ.
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
