// Monta e cria o card de reembolso de gasolina no board "Processos de
// Pagamento", preenchendo as mesmas colunas que o formulário do Monday
// preenche — a automação "AUTOMAÇÃO PAGAMENTO VP" (n8n) lê o card pelo título
// das colunas (ver o nó "// NORMALIZAÇÃO + PRESERVA ORIGINAL").
import { comentarItem, criarItemPagamento, encontrarOpcao, normalizarRotulo } from './monday'
import { formatarData, formatarNumero, formatarReais, type MondayColunaValor } from './gasolina'
import type { ViagemPreview } from './gasolina-server'

export const COLUNAS_PAGAMENTO = {
    tipo: 'color_mkqcmsdp',          // TIPO DE SOLICITAÇÃO
    nome: 'dropdown_mkxbgsh',        // NOME
    email: 'short_textn6hs0e96',     // E-MAIL
    pix: 'text_mkqng1y1',            // CHAVE PIX PARA REEMBOLSO
    descricao: 'text_mkqc7q7r',      // DESCRIÇÃO DO PAGAMENTO
    valor: 'numeric_mkqcty4e',       // VALOR
    centro: 'color_mkqck97p',        // CENTRO DE CUSTO
    status: 'color_mkqq2agk',        // Status (kanban)
} as const

// Não mudar sem ajustar o IF "Pedido da Área do Membro?" na automação do n8n.
export const MARCA_APP = '(Área do Membro)'

interface DadosCard {
    solicitacaoId: string
    membro: { nome: string, email: string }
    chavePix: string
    centro: { monday_centro_custo: string, monday_coluna_projeto: string | null, monday_colunas: MondayColunaValor[], tipo: 'projeto' | 'fixo' }
    projeto: string
    viagens: ViagemPreview[]
    valorTotal: number
    litrosTotal: number
}

// Coluna de escolha única (status / single_select) recebe {label}; dropdown
// recebe {labels: [...]}. O rótulo precisa existir — conferido antes para não
// criar opção nova no Monday por erro de digitação na configuração.
function ehDropdown(coluna: string) { return coluna.startsWith('dropdown') }
function ehEscolha(coluna: string) { return /^(color|status|single_select)/.test(coluna) || ehDropdown(coluna) }

async function rotuloExistente(coluna: string, valor: string, descricao: string): Promise<string> {
    const exato = await encontrarOpcao(coluna, valor)
    if (!exato) {
        throw new Error(`A opção "${valor}" não existe na coluna ${descricao} (${coluna}) do Monday. Ajuste na aba "Centros de custo".`)
    }
    return exato
}

function valorColuna(coluna: string, rotulo: string) {
    return ehDropdown(coluna) ? { labels: [rotulo] } : { label: rotulo }
}

export async function criarCardReembolso(d: DadosCard): Promise<string> {
    const colunas: Record<string, unknown> = {}

    colunas[COLUNAS_PAGAMENTO.tipo] = { label: await rotuloExistente(COLUNAS_PAGAMENTO.tipo, 'REEMBOLSO', 'Tipo de solicitação') }
    colunas[COLUNAS_PAGAMENTO.centro] = { label: await rotuloExistente(COLUNAS_PAGAMENTO.centro, d.centro.monday_centro_custo, 'Centro de custo') }
    colunas[COLUNAS_PAGAMENTO.email] = d.membro.email
    colunas[COLUNAS_PAGAMENTO.pix] = d.chavePix
    colunas[COLUNAS_PAGAMENTO.descricao] = `Reembolso Gasolina (${d.projeto})`
    colunas[COLUNAS_PAGAMENTO.valor] = d.valorTotal.toFixed(2)

    if (d.centro.tipo === 'projeto' && d.centro.monday_coluna_projeto) {
        const col = d.centro.monday_coluna_projeto
        colunas[col] = valorColuna(col, await rotuloExistente(col, d.projeto, 'de projetos'))
    }
    for (const extra of d.centro.monday_colunas) {
        colunas[extra.coluna] = ehEscolha(extra.coluna)
            ? valorColuna(extra.coluna, await rotuloExistente(extra.coluna, extra.valor, 'extra do centro de custo'))
            : extra.valor
    }

    // Nome: usa a opção existente do dropdown NOME se bater com o cadastro
    // (sem acento/caixa); senão cria a opção — só esse campo pode criar rótulo.
    const nomeExistente = await encontrarOpcao(COLUNAS_PAGAMENTO.nome, d.membro.nome)
    colunas[COLUNAS_PAGAMENTO.nome] = { labels: [nomeExistente ?? d.membro.nome] }

    // A marca MARCA_APP no título é o que a automação do n8n usa para desviar
    // o card para /api/gasolina/integracao/validar em vez da planilha.
    const itemId = await criarItemPagamento(
        `Reembolso Gasolina — ${nomeExistente ?? d.membro.nome} ${MARCA_APP}`,
        colunas,
        !nomeExistente,
    )

    // Extrato no lugar do antigo print da planilha. Falha aqui não desfaz o card.
    try {
        const linhas = d.viagens.map(v => {
            const trajeto = [v.origem_local, ...(v.paradas ?? []), v.destino_local].join(' → ')
            return `• ${formatarData(v.data_viagem)} — ${trajeto} — ${formatarNumero(v.distancia_km, 1)} km, ${formatarNumero(v.litros, 2)} L × R$ ${formatarNumero(v.preco_litro, 2)} = ${formatarReais(v.valor)}${v.veiculo?.modelo ? ` (${v.veiculo.modelo})` : ''}`
        })
        await comentarItem(itemId, [
            `<b>Solicitado pela Área do Membro</b> (ref. ${d.solicitacaoId})`,
            `Projeto: <b>${d.projeto}</b> — ${d.viagens.length} viagem(ns), ${formatarNumero(d.litrosTotal, 2)} L, total <b>${formatarReais(d.valorTotal)}</b>`,
            '',
            ...linhas,
        ].join('<br>'))
    } catch (err) {
        console.error('[gasolina] Card criado, mas falhou ao comentar o extrato:', err)
    }
    return itemId
}

// Status do kanban do Monday -> status da solicitação no app.
export function statusDoKanban(texto: string): 'Solicitado' | 'Aprovado' | 'Lançado' | 'Pago' | 'Recusado' | null {
    const t = normalizarRotulo(texto)
    if (t === 'APROVADO') return 'Aprovado'
    if (t === 'LANCADO') return 'Lançado'
    // "PAGO URGENTE" é uma coluna do kanban de pedidos a pagar com urgência —
    // ainda não pago, então não conta como Pago.
    if (t === 'PAGO') return 'Pago'
    if (t === 'RECUSADO') return 'Recusado'
    return null
}
