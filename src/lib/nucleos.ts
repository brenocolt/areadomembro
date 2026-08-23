// Lista fixa de núcleos da área do membro. Usada nos dropdowns de
// cadastro/edição (signup e Gestão de Usuários) — mantida em espelho com a
// tabela `nucleos` no banco de dados (ver supabase/migrations), que é a
// referência para futuras integrações que precisem consultar os núcleos
// existentes sem depender do código do site.
export const NUCLEOS = [
    'Marketing',
    'Projetos',
    'Vice Presidência',
    'Presidência',
    'Gestão de Pessoas',
    'Customer Success',
    'Inovação',
    'Tecnologia',
    'Escopos & Produtos',
] as const

export type Nucleo = typeof NUCLEOS[number]
