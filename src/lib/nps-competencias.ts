// Competências avaliadas no NPS Projetos, separadas por papel. "Comunicação"
// é comum aos dois e por isso não aparece aqui: as demais são exclusivas de
// um papel, e é isso que permite saber, olhando só as perguntas de uma seção
// do formulário, se ela avalia o GERENTE ou um CONSULTOR.
//
// Arquivo sem dependências (importado tanto pelas consultas de NPS quanto
// pelo autopreenchimento do formulário — ver src/lib/projetos-equipe.ts).
export const CONSULTOR_SO = new Set(['Dedicação', 'Confiança', 'Pontualidade', 'Organização', 'Proatividade', 'Qualidade das Entregas', 'Domínio Técnico'])
export const GERENTE_SO = new Set(['Suporte à Execução', 'Relacionamento com a Equipe', 'Resolutividade', 'Liderança'])
