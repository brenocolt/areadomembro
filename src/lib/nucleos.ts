// Lista fixa de núcleos da área do membro. Usada como dropdown padronizado
// nos formulários de cadastro/edição (Gestão de Usuários, autocadastro,
// filtros) — ver também src/lib/cargos.ts.
//
// colaboradores.nucleo_atual continua sendo uma coluna TEXT livre no banco
// (para não obrigar migração dos dados já cadastrados), mas todo formulário
// novo/editado deve usar esta lista fechada em vez de texto livre.
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
