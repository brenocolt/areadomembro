// Configuração editável do NPS Projeto — título de cada pergunta e o
// critério manual de cada nota (1 a 5), por trás do botão "Editar Perguntas
// do NPS Projetos" em Gestão de Formulários (ver
// nps-projeto-perguntas-dialog.tsx).
//
// O NPS Projeto continua gravando as respostas em `avaliacoes_nps` (colunas
// fixas: comunicacao, dedicacao, pontualidade etc.) — isso NÃO muda, porque
// PIPJ, Performance, NPS Gerente, Wallet e o Agente de Feedback dependem
// dessas colunas. Só o TEXTO de cada pergunta e os critérios de 1 a 5 viram
// editáveis, guardados como uma única linha em `configuracoes` (mesma tabela
// já usada para nps_projeto_ativo/nps_projeto_prazo) — sem precisar de
// migração nova.
import { supabase } from '@/lib/supabase'
import type { CriterioEscala } from '@/components/forms/escala-picker'

export const NPS_PROJETO_CONFIG_CHAVE = 'nps_projeto_perguntas'

export interface NpsProjetoPerguntaConfig {
    titulo?: string
    // Critério de cada nota, 1 a 5 — mesmo formato (título curto + descrição)
    // das perguntas de escala do motor genérico de formulários (ver
    // create-form-dialog.tsx / escala-picker.tsx).
    criterios?: Partial<Record<'1' | '2' | '3' | '4' | '5', CriterioEscala>>
}

export type NpsProjetoBloco = 'gerente' | 'consultor'

export type NpsProjetoConfig = {
    [bloco in NpsProjetoBloco]?: Record<string, NpsProjetoPerguntaConfig>
}

// Texto padrão de cada pergunta (o que já existia hardcoded antes deste
// recurso) — usado quando ninguém personalizou ainda. `obs` é a observação
// extra que só a pergunta de Pontualidade do consultor tinha.
export const GERENTE_CAMPOS: { campo: string, tituloPadrao: string, obs?: string }[] = [
    { campo: 'comunicacao', tituloPadrao: 'Quão clara foi a COMUNICAÇÃO do seu gerente, tanto na escuta quanto na fala, neste mês?' },
    { campo: 'suporte', tituloPadrao: 'Avalie o quão você ficou satisfeito(a) com o SUPORTE do seu gerente em relação à EXECUÇÃO do projeto durante esse mês.' },
    { campo: 'relacionamento', tituloPadrao: 'Avalie o quão você ficou satisfeito(a) com o RELACIONAMENTO do seu gerente em relação à EQUIPE do projeto durante esse mês.' },
    { campo: 'resolutividade', tituloPadrao: 'Avalie o nível de RESOLUTIVIDADE do seu gerente do projeto durante esse mês.' },
    { campo: 'lideranca', tituloPadrao: 'Avalie o quão satisfeito(a) você ficou com a LIDERANÇA do seu gerente em relação ao projeto neste mês.' },
]

export const CONSULTOR_CAMPOS: { campo: string, tituloPadrao: string, obs?: string }[] = [
    { campo: 'comunicacao', tituloPadrao: 'O quão eficaz foi a COMUNICAÇÃO do(a) consultor(a) com a equipe esse mês?' },
    { campo: 'dedicacao', tituloPadrao: 'Avalie o quanto o(a) consultor(a) SE DEDICOU ao projeto esse mês:' },
    { campo: 'confianca', tituloPadrao: 'Avalie o quanto você tem CONFIANÇA no trabalho deste(a) consultor(a) no projeto esse mês:' },
    { campo: 'pontualidade', tituloPadrao: 'O quanto esse(a) consultor(a) foi PONTUAL durante o mês?', obs: 'Lembrando que Pontualidade não é só em reuniões com o cliente, mas também em reuniões internas, como sprints e construções, e cumprimento de prazos com as entregas.' },
    { campo: 'organizacao', tituloPadrao: 'O quanto esse(a) consultor(a) foi ORGANIZADO durante esse mês?' },
    { campo: 'proatividade', tituloPadrao: 'O quanto esse(a) consultor(a) foi PROATIVO durante esse mês?' },
    { campo: 'qualidade_entregas', tituloPadrao: 'Como você se sentiu em relação à QUALIDADE das ENTREGAS desse(a) consultor(a) nesse último mês?' },
    { campo: 'dominio_tecnico', tituloPadrao: 'Como você avalia o DOMÍNIO TÉCNICO desse(a) consultor(a) durante o último mês?' },
]

// Critério genérico de 1 a 5 que já era usado (igualmente) em TODAS as
// perguntas de escala do NPS Projeto — fica como padrão de cada pergunta até
// alguém personalizar especificamente ela.
export const CRITERIOS_PADRAO: Record<number, CriterioEscala> = {
    1: { titulo: 'Abaixo das expectativas' },
    2: { titulo: 'Pode melhorar' },
    3: { titulo: 'Razoável/Neutro' },
    4: { titulo: 'Satisfatório' },
    5: { titulo: 'Acima das expectativas' },
}

export async function loadNpsProjetoConfig(): Promise<NpsProjetoConfig> {
    const { data } = await supabase
        .from('configuracoes')
        .select('valor')
        .eq('chave', NPS_PROJETO_CONFIG_CHAVE)
        .maybeSingle()
    return (data?.valor as NpsProjetoConfig) || {}
}

export async function saveNpsProjetoConfig(config: NpsProjetoConfig): Promise<void> {
    const { error } = await supabase.from('configuracoes').upsert({ chave: NPS_PROJETO_CONFIG_CHAVE, valor: config })
    if (error) throw new Error(error.message)
}

// Resolve o título e os critérios EFETIVOS de uma pergunta: o que foi
// personalizado prevalece, campo a campo — uma pergunta pode ter só o título
// mudado e manter os critérios padrão, ou só um dos 5 critérios preenchido.
export function resolverPergunta(
    config: NpsProjetoConfig, bloco: NpsProjetoBloco, campo: string, tituloPadrao: string
): { titulo: string, criterios: Record<number, CriterioEscala> } {
    const cfg = config[bloco]?.[campo]
    const titulo = cfg?.titulo?.trim() || tituloPadrao
    const criterios: Record<number, CriterioEscala> = {}
    for (let v = 1; v <= 5; v++) {
        const chave = String(v) as '1' | '2' | '3' | '4' | '5'
        const personalizado = cfg?.criterios?.[chave]
        const temPersonalizado = (personalizado?.titulo || '').trim() || (personalizado?.descricao || '').trim()
        criterios[v] = temPersonalizado ? personalizado! : CRITERIOS_PADRAO[chave]
    }
    return { titulo, criterios }
}
