// Lista fixa de cargos da área do membro, simplificada em 3 níveis
// hierárquicos + a conta de uso administrativo do sistema. Usada nos
// formulários de cadastro/edição (dropdown) e nas regras de cálculo de PIPJ.
//
// Mapeamento em relação aos cargos antigos (mais granulares, hoje só
// preservados em registros históricos como historico_cargos.cargo,
// ocorrencias.cargo_na_epoca e transacoes_pipj.cargo_no_periodo):
//   Operacional:   Assessor, Consultor, SDR
//   Tático:        Closer + todos os cargos de Gerência (Gerente de
//                  Projetos, Gerente de Inovação, Gerente de Operações,
//                  Gerente de CS, Gerente de Gente, Gerente Institucional)
//   Estratégico:   Diretor
//   Administrador: mantido — conta fantasma de uso administrativo do
//                  sistema, nunca recebe PIPJ, milhas ou pontos.
export const CARGOS = [
    'Operacional',
    'Tático',
    'Estratégico',
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

// Núcleo cujo Tático equivale ao antigo cargo "Closer" — ver src/lib/nucleos.ts.
export const NUCLEO_MARKETING = 'Marketing'

// Núcleo usado no corte de "Assessor de Gestão de Pessoas" — ver
// isCargoAssessorGP abaixo.
export const NUCLEO_GESTAO_DE_PESSOAS = 'Gestão de Pessoas'

// Um Tático fora do núcleo Marketing equivale a um dos antigos cargos de
// Gerência (Gerente de Projetos, Gerente de Inovação, ...); um Tático DO
// núcleo Marketing equivale ao antigo Closer. Várias telas do sistema
// restringiam acesso a funcionalidades gerenciais checando
// `cargo.includes('gerente')` no cargo antigo — o que sempre bateu para os
// "Gerente de X" e nunca para Closer, Diretor, Administrador ou os cargos
// operacionais. Esta função reproduz exatamente o mesmo corte com o cargo
// simplificado.
export function isCargoGerencial(cargo?: string | null, nucleo?: string | null): boolean {
    return cargo === 'Tático' && (nucleo || '').trim() !== NUCLEO_MARKETING
}

// Equivale ao antigo `cargo.includes('administrador') || cargo.includes('diretor')`
// — usado para liberar acesso de Diretoria (agora Estratégico) e da conta de
// Administrador a telas que antes checavam essas duas strings.
export function isCargoDiretoria(cargo?: string | null): boolean {
    return cargo === 'Estratégico' || cargo === CARGO_FANTASMA
}

// Equivale ao antigo corte "cargo === 'Assessor' && núcleo === 'Gestão de
// Pessoas'" (usado no Agente de Feedback para liberar escolha de alvo a
// assessores de Gestão de Pessoas). Como Assessor, Consultor e SDR viraram
// um único cargo Operacional, esse corte agora libera todo o núcleo Gestão
// de Pessoas em nível Operacional — na prática o mesmo grupo de pessoas, já
// que os demais cargos operacionais não costumam existir nesse núcleo.
export function isCargoAssessorGP(cargo?: string | null, nucleo?: string | null): boolean {
    return cargo === 'Operacional' && (nucleo || '').trim() === NUCLEO_GESTAO_DE_PESSOAS
}
