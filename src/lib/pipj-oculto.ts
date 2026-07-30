// Pedido específico: estes colaboradores não devem aparecer na aba "Saldos
// da Equipe" nem contar no total de "PIPJ em Circulação" do pipj-management
// (mas continuam normais em todas as outras telas de PIPJ — rankings,
// histórico de movimentações, wallet do próprio colaborador, etc).
export const OCULTOS_SALDOS_EQUIPE = [
    '3c473480-00b5-424b-bdba-0a6d1bc213c5', // Carolina Abreu
    'a34e8f53-cc3d-41e6-a2ae-e5fcc048a5cb', // João Pedro Fernandes
    '9d0a9bcf-a074-4d80-8d8f-8808ee21ede8', // Lucas Damaceno
]
