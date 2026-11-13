// Formulário "Solicitar Pagamento ou Reembolso" (substitui o WorkForms do
// Monday). Fonte única das perguntas, opções e regras condicionais — usada
// pelo formulário no navegador e revalidada no servidor
// (/api/pagamentos/solicitacoes), para que a regra nunca dependa só da tela.
//
// ⚠️ Itens marcados com "A CONFIRMAR" foram montados a partir da lista de
// campos do formulário original informada pela VP; as opções/obrigatoriedades
// ainda precisam ser conferidas com o WorkForms. Para corrigir, mude só este
// arquivo (e suba VERSAO_FORMULARIO).
import { validarChavePix } from './gasolina'
import { isAdmin, isNucleoVicePresidencia } from './access-control'

// Fase de testes: o formulário próprio fica visível só para a Vice
// Presidência e administradores; os demais membros continuam com o WorkForms
// do Monday. Para abrir a todos, PAGAMENTOS_FORMULARIO_LIBERADO=todos no
// Coolify (lido no servidor, sem precisar mudar código).
export function podeUsarFormularioProprio(
    colaborador: { nucleo_atual?: string | null } | null | undefined,
    role: string | null | undefined,
    liberadoParaTodos: boolean,
): boolean {
    return liberadoParaTodos || isAdmin(role) || isNucleoVicePresidencia(colaborador?.nucleo_atual)
}

// Sobe quando perguntas/opções mudarem: cada solicitação guarda a versão com
// que foi preenchida, para o n8n e o futuro Kanban saberem como ler.
export const VERSAO_FORMULARIO = 1

export const TIPOS_SOLICITACAO = ['REEMBOLSO', 'PAGAMENTO'] as const
export type TipoSolicitacao = typeof TIPOS_SOLICITACAO[number]

// A CONFIRMAR: lido como duas opções ("Boleto" e "Transferência / Cartão de
// crédito"), como estava escrito no formulário original.
export const FORMAS_PAGAMENTO = ['Boleto', 'Transferência / Cartão de crédito'] as const

export const SIM_NAO = ['Sim', 'Não'] as const

// Campo de categoria de cada centro de custo:
//   opcoes: lista fechada (lista suspensa obrigatória)
//   opcoes: null -> sem lista confirmada: texto livre opcional
export interface CentroCusto {
    nome: string
    categoria: { campo: 'categoria' | 'categoria_execucao' | 'outra_categoria', rotulo: string, opcoes: readonly string[] | null }
}

export const CENTROS_CUSTO: readonly CentroCusto[] = [
    // A CONFIRMAR: opções da "Categoria de execução de projetos" (no Monday
    // há ao menos "Gasolina", usada pelo reembolso de gasolina).
    { nome: 'Consultorias/Assessorias', categoria: { campo: 'categoria_execucao', rotulo: 'Categoria de execução de projetos', opcoes: null } },
    // A CONFIRMAR: sem lista de categorias informada.
    { nome: 'Diretoria Executiva', categoria: { campo: 'outra_categoria', rotulo: 'Outra categoria', opcoes: null } },
    { nome: 'Eventos MEJ', categoria: { campo: 'categoria', rotulo: 'Gasto com Evento MEJ', opcoes: ['Alimentação', 'Hospedagem', 'Ingresso', 'Passagem', 'Transporte'] } },
    { nome: 'Feira de carreira', categoria: { campo: 'outra_categoria', rotulo: 'Outra categoria', opcoes: null } },
    { nome: 'GP', categoria: { campo: 'categoria', rotulo: 'Categoria', opcoes: ['Desligamento', 'Endomarketing', 'Engajamento empresa', 'Engajamento GP'] } },
    { nome: 'Marketing', categoria: { campo: 'categoria', rotulo: 'Categoria', opcoes: ['Softwares e sistemas marketing', 'Telefone e internet', 'Terceirizada para marketing', 'Tráfego pago'] } },
    { nome: 'Presidência', categoria: { campo: 'outra_categoria', rotulo: 'Outra categoria', opcoes: null } },
    { nome: 'Projetos', categoria: { campo: 'categoria', rotulo: 'Categoria', opcoes: ['Capacitações', 'Engajamento projetos', 'Números Virtuais', 'Reconhecimento consultores', 'Workday'] } },
    { nome: 'VP', categoria: { campo: 'categoria', rotulo: 'Categoria', opcoes: ['Manutenção', 'Material de escritório', 'Softwares e sistemas', 'Workday'] } },
]

export function centroPorNome(nome: string | null | undefined): CentroCusto | undefined {
    return CENTROS_CUSTO.find(c => c.nome === nome)
}

// Categorias que pedem o anexo de Workday/SDR. A CONFIRMAR: no original o
// anexo aparece "quando aplicável"; aqui aparece (opcional) para "Workday".
export const CATEGORIAS_COM_ANEXO_WORKDAY = ['Workday'] as const

// Anexos
export const ANEXO_TIPOS_ACEITOS = [
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif',
] as const
export const ANEXO_EXTENSOES_ACEITAS = '.pdf,.jpg,.jpeg,.png,.webp,.heic,.heif'
export const ANEXO_TAMANHO_MAX = 10 * 1024 * 1024 // 10 MB por arquivo
export const ANEXO_QTD_MAX = 5                    // por campo

// ---------------------------------------------------------------------------
// Respostas
// ---------------------------------------------------------------------------

// O que o navegador envia (tudo texto; o servidor normaliza).
export interface RespostasFormulario {
    tipo?: string
    forma_pagamento?: string
    dados_bancarios?: string
    descricao?: string
    fornecedor?: string
    valor?: string
    centro_custo?: string
    categoria?: string
    categoria_execucao?: string
    outra_categoria?: string
    chave_pix?: string
    eh_pipj?: string
    eh_retirada_milha?: string
    tipo_retirada_milha?: string
    evento_mej?: string
}

// Dados normalizados que vão para o banco (campos ocultos ficam null).
export interface SolicitacaoNormalizada {
    tipo: TipoSolicitacao
    forma_pagamento: string | null
    dados_bancarios: string | null
    descricao: string
    fornecedor: string
    valor: number
    centro_custo: string
    categoria: string | null
    categoria_execucao: string | null
    outra_categoria: string | null
    chave_pix: string | null
    eh_pipj: boolean
    eh_retirada_milha: boolean
    tipo_retirada_milha: string | null
    evento_mej: string | null
}

export interface ResumoAnexos { comprovantes: number, workday: number }

// Quais perguntas aparecem para estas respostas (lógica condicional).
export function camposVisiveis(r: RespostasFormulario) {
    const centro = centroPorNome(r.centro_custo)
    const campoCategoria = centro?.categoria.campo
    return {
        forma_pagamento: r.tipo === 'PAGAMENTO',
        dados_bancarios: r.tipo === 'PAGAMENTO',
        chave_pix: r.tipo === 'REEMBOLSO',
        categoria: campoCategoria === 'categoria',
        categoria_execucao: campoCategoria === 'categoria_execucao',
        outra_categoria: campoCategoria === 'outra_categoria',
        evento_mej: r.centro_custo === 'Eventos MEJ',
        tipo_retirada_milha: r.eh_retirada_milha === 'Sim',
        anexo_workday: campoCategoria === 'categoria'
            && (CATEGORIAS_COM_ANEXO_WORKDAY as readonly string[]).includes(r.categoria ?? ''),
    }
}

// Aceita "1.234,56", "1234,56", "1234.56", "R$ 50". Até 2 casas decimais.
export function lerValorReais(entrada: unknown): number | null {
    if (typeof entrada === 'number') return Number.isFinite(entrada) ? Math.round(entrada * 100) / 100 : null
    if (typeof entrada !== 'string') return null
    let v = entrada.replace(/R\$/i, '').replace(/\s/g, '')
    if (!v) return null
    if (v.includes(',')) v = v.replace(/\./g, '').replace(',', '.')
    else if ((v.match(/\./g) ?? []).length > 1) v = v.replace(/\./g, '')
    if (!/^\d+(\.\d{1,2})?$/.test(v)) return null
    return Number(v)
}

export const VALOR_MAXIMO = 1_000_000

const LIMITES_TEXTO: Record<string, number> = {
    descricao: 2000, dados_bancarios: 1000, fornecedor: 200, categoria_execucao: 200,
    outra_categoria: 200, tipo_retirada_milha: 200, evento_mej: 200,
}

export type ErrosFormulario = Partial<Record<keyof RespostasFormulario | 'comprovantes' | 'anexos_workday', string>>

export function validarSolicitacao(r: RespostasFormulario, anexos: ResumoAnexos):
    { ok: true, dados: SolicitacaoNormalizada } | { ok: false, erros: ErrosFormulario } {
    const erros: ErrosFormulario = {}
    const vis = camposVisiveis(r)
    const txt = (campo: keyof RespostasFormulario) => (r[campo] ?? '').toString().trim()
    const obrigatorio = (campo: keyof RespostasFormulario, msg: string) => {
        const v = txt(campo)
        if (!v) erros[campo] = msg
        return v
    }
    const opcao = (campo: keyof RespostasFormulario, opcoes: readonly string[], msg: string) => {
        const v = txt(campo)
        if (!opcoes.includes(v)) erros[campo] = msg
        return v
    }

    const tipo = opcao('tipo', TIPOS_SOLICITACAO, 'Escolha o tipo de solicitação.') as TipoSolicitacao
    const descricao = obrigatorio('descricao', 'Descreva o pagamento.')
    const fornecedor = obrigatorio('fornecedor', 'Informe o fornecedor.')

    const valor = lerValorReais(r.valor)
    if (!txt('valor')) erros.valor = 'Informe o valor.'
    else if (valor === null) erros.valor = 'Valor inválido. Use o formato 1.234,56.'
    else if (valor <= 0) erros.valor = 'O valor precisa ser maior que zero.'
    else if (valor > VALOR_MAXIMO) erros.valor = 'Valor acima do limite permitido.'

    const centroNome = opcao('centro_custo', CENTROS_CUSTO.map(c => c.nome), 'Escolha o centro de custo.')
    const centro = centroPorNome(centroNome)

    let categoria: string | null = null
    if (vis.categoria && centro?.categoria.opcoes) {
        categoria = opcao('categoria', centro.categoria.opcoes, `Escolha: ${centro.categoria.rotulo}.`)
    }
    const categoriaExecucao = vis.categoria_execucao ? (txt('categoria_execucao') || null) : null
    const outraCategoria = vis.outra_categoria ? (txt('outra_categoria') || null) : null

    let formaPagamento: string | null = null
    let dadosBancarios: string | null = null
    if (vis.forma_pagamento) {
        formaPagamento = opcao('forma_pagamento', FORMAS_PAGAMENTO, 'Escolha a forma de pagamento.')
        // A CONFIRMAR: obrigatório só para transferência/cartão (no boleto os
        // dados já vêm no próprio boleto anexado).
        dadosBancarios = formaPagamento === 'Boleto'
            ? (txt('dados_bancarios') || null)
            : obrigatorio('dados_bancarios', 'Informe os dados bancários.') || null
    }

    let chavePix: string | null = null
    if (vis.chave_pix) {
        const pix = validarChavePix(txt('chave_pix'))
        if (pix.ok) chavePix = pix.chave
        else erros.chave_pix = pix.error
    }

    const ehPipj = opcao('eh_pipj', SIM_NAO, 'Responda se é PIPJ.') === 'Sim'
    const ehRetirada = opcao('eh_retirada_milha', SIM_NAO, 'Responda se é retirada por milha.') === 'Sim'
    const tipoRetirada = vis.tipo_retirada_milha ? obrigatorio('tipo_retirada_milha', 'Informe o tipo de retirada por milha.') || null : null
    const eventoMej = vis.evento_mej ? obrigatorio('evento_mej', 'Informe qual Evento MEJ.') || null : null

    if (anexos.comprovantes < 1) erros.comprovantes = 'Anexe o comprovante.'
    if (anexos.comprovantes > ANEXO_QTD_MAX) erros.comprovantes = `Envie no máximo ${ANEXO_QTD_MAX} arquivos.`
    if (anexos.workday > ANEXO_QTD_MAX) erros.anexos_workday = `Envie no máximo ${ANEXO_QTD_MAX} arquivos.`
    if (!vis.anexo_workday && anexos.workday > 0) erros.anexos_workday = 'Este anexo não se aplica à categoria escolhida.'

    for (const [campo, max] of Object.entries(LIMITES_TEXTO)) {
        if (txt(campo as keyof RespostasFormulario).length > max) erros[campo as keyof RespostasFormulario] = `Use no máximo ${max} caracteres.`
    }

    if (Object.keys(erros).length) return { ok: false, erros }
    return {
        ok: true,
        dados: {
            tipo, forma_pagamento: formaPagamento, dados_bancarios: dadosBancarios,
            descricao, fornecedor, valor: valor!, centro_custo: centroNome,
            categoria, categoria_execucao: categoriaExecucao, outra_categoria: outraCategoria,
            chave_pix: chavePix, eh_pipj: ehPipj, eh_retirada_milha: ehRetirada,
            tipo_retirada_milha: tipoRetirada, evento_mej: eventoMej,
        },
    }
}

// Situação da solicitação nas automações (n8n). O portal grava
// "recebida" / "enviada_n8n" / "erro_envio"; o n8n informa o resto.
export const STATUS_PROCESSAMENTO = [
    'recebida',           // gravada no portal, ainda não entregue ao n8n
    'enviada_n8n',        // webhook do n8n respondeu OK
    'erro_envio',         // webhook falhou (o n8n pode buscar pela lista)
    'em_processamento',   // n8n validando (agenda, [PJ], Workday/SDR, IA...)
    'aguardando_aprovacao', // n8n aguardando decisão humana (ex.: Slack)
    'aprovada',
    'recusada',
    'erro_processamento', // n8n registrou falha numa etapa
] as const
export type StatusProcessamento = typeof STATUS_PROCESSAMENTO[number]
export const STATUS_FINAIS: readonly StatusProcessamento[] = ['aprovada', 'recusada']
