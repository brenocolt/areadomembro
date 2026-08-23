// Antes da simplificação de cargos em Gestão de Usuários, o PIPJ tinha uma
// regra de valor diferente para cada cargo de gerência (Gerente de
// Projetos, Closer, Gerente de Inovação, Gerente de Operações, Gerente de
// CS, Gerente de Gente, Gerente Institucional). Como colaboradores.cargo_atual
// não guarda mais esse nível de detalhe (ver src/lib/cargos.ts), essas
// regras são recuperadas cruzando o cargo (tier) atual com o núcleo do
// colaborador:
//   Tático + núcleo Projetos  → equivale ao antigo "Gerente de Projetos"
//   Tático + núcleo Marketing → equivale ao antigo "Closer"
//   Tático + demais núcleos   → equivale aos antigos demais gerentes
//
// As tabelas de valores do PIPJ (em src/app/api/pipj/preview/route.ts,
// src/app/api/pipj/lancar/route.ts e
// src/app/(dashboard)/wallet/components/pipj-forecast-card.tsx) são
// indexadas por essas chaves — geradas por resolvePipjCargoKey — e não mais
// diretamente por cargo_atual.
import { NUCLEO_MARKETING } from './cargos'

export const PIPJ_CARGO_KEYS = {
    OPERACIONAL: 'Operacional',
    TATICO_PROJETOS: 'Tático (Projetos)',
    TATICO_MARKETING: 'Tático (Marketing)',
    TATICO_GERAL: 'Tático (Geral)',
    ESTRATEGICO: 'Estratégico',
} as const

const NUCLEO_PROJETOS = 'Projetos'

export function resolvePipjCargoKey(cargo?: string | null, nucleo?: string | null): string {
    const nucleoNorm = (nucleo || '').trim()

    if (cargo === 'Tático') {
        if (nucleoNorm === NUCLEO_PROJETOS) return PIPJ_CARGO_KEYS.TATICO_PROJETOS
        if (nucleoNorm === NUCLEO_MARKETING) return PIPJ_CARGO_KEYS.TATICO_MARKETING
        return PIPJ_CARGO_KEYS.TATICO_GERAL
    }
    if (cargo === 'Estratégico') return PIPJ_CARGO_KEYS.ESTRATEGICO

    // Operacional e qualquer valor desconhecido caem no mesmo tratamento que
    // o antigo fallback `cargo_atual || 'Assessor'`.
    return PIPJ_CARGO_KEYS.OPERACIONAL
}
