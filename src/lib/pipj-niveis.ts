// Regras de remuneração do PIPJ por nível de cargo (Operacional / Tático /
// Estratégico) — compartilhadas entre o cálculo real (API de preview e
// lançamento) e a prévia exibida ao colaborador na Carteira PIPJ, para as
// duas contas nunca divergirem.
//
// Antes da simplificação de cargos em níveis, cada função específica tinha
// sua própria linha nessas tabelas (Consultor, Assessor, SDR, Closer, um
// "Gerente de X" por núcleo, Diretor). Os valores abaixo preservam
// exatamente a mesma matemática: dentro de um nível, todo mundo já recebia
// o mesmo valor — a única exceção era o cargo "Gerente de Projetos", que
// tinha uma taxa por projeto menor que os demais gerentes. Essa exceção
// virou uma regra de núcleo (ver PIPJ_NUCLEO_TAXA_REDUZIDA), já que "Gerente
// de Projetos" e os outros gerentes agora são todos "Tático".

export const PIPJ_FIXED_VALUES: Record<string, number> = {
    'Operacional': 100,
    'Tático': 150,
    'Estratégico': 250,
}

export const PIPJ_VARIABLE_PER_PROJECT: Record<string, number> = {
    'Operacional': 15,
    'Tático': 15,
}

// Núcleo com taxa por projeto reduzida dentro do nível Tático — mesma regra
// que existia para o cargo específico "Gerente de Projetos".
export const PIPJ_NUCLEO_TAXA_REDUZIDA = 'Projetos'
export const PIPJ_VARIABLE_PER_PROJECT_NUCLEO_REDUZIDO = 5
export const PIPJ_VARIABLE_PER_PROJECT_NUCLEO_REDUZIDO_MES_SEM_LUCRO = 5

// "Mês sem lucro": reduz o valor base em 30% (Operacional) ou usa um valor
// fixo reduzido (Tático/Estratégico), e o adicional por projeto de R$15
// para R$10, aplicado a todos.
export const PIPJ_MES_SEM_LUCRO_BASE_MULTIPLIER = 0.70
export const PIPJ_MES_SEM_LUCRO_BASE_FIXO: Record<string, number> = {
    'Tático': 115,
    'Estratégico': 215,
}
export const PIPJ_VARIABLE_PER_PROJECT_MES_SEM_LUCRO: Record<string, number> = {
    'Operacional': 10,
    'Tático': 10,
}

export const PIPJ_LEVEL_BONUS: Record<string, number> = {
    'Júnior': 0,
    'Junior': 0,
    'Pleno': 15,
    'Sênior': 30,
    'Senior': 30,
}

// Níveis que recebem bônus fixo de cargo (Tático/Estratégico) em vez do
// bônus por nível de consultor (só Operacional tem nível Júnior/Pleno/Sênior).
export const PIPJ_NIVEIS_SEM_BONUS_NIVEL = ['Tático', 'Estratégico']

export function pipjBaseCargo(nivelCargo: string, mesSemLucro: boolean): number {
    const integral = PIPJ_FIXED_VALUES[nivelCargo] ?? PIPJ_FIXED_VALUES['Operacional']
    if (!mesSemLucro) return integral
    return PIPJ_MES_SEM_LUCRO_BASE_FIXO[nivelCargo]
        ?? Math.round(integral * PIPJ_MES_SEM_LUCRO_BASE_MULTIPLIER * 100) / 100
}

export function pipjTaxaPorProjeto(nivelCargo: string, nucleo: string | null | undefined, mesSemLucro: boolean): number {
    const ehNucleoReduzido = (nucleo || '').trim().toLowerCase() === PIPJ_NUCLEO_TAXA_REDUZIDA.toLowerCase()
    if (nivelCargo === 'Tático' && ehNucleoReduzido) {
        return mesSemLucro ? PIPJ_VARIABLE_PER_PROJECT_NUCLEO_REDUZIDO_MES_SEM_LUCRO : PIPJ_VARIABLE_PER_PROJECT_NUCLEO_REDUZIDO
    }
    const tabela = mesSemLucro ? PIPJ_VARIABLE_PER_PROJECT_MES_SEM_LUCRO : PIPJ_VARIABLE_PER_PROJECT
    return tabela[nivelCargo] ?? 0
}

export function pipjTemBonusNivel(nivelCargo: string): boolean {
    return !PIPJ_NIVEIS_SEM_BONUS_NIVEL.includes(nivelCargo)
}
