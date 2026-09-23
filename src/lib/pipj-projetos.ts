// Regra de corte de "quinzena" para contar um projeto no PIPJ: um projeto
// que começa na segunda quinzena do mês (dia 16 em diante) só entra na
// conta do PIPJ a partir do mês seguinte. Ex.: projeto iniciado em 20/08 só
// conta a partir do lançamento de setembro.
//
// Usado tanto pela sincronização com o Monday (que grava data_inicio/
// data_fim em colaboradores.projetos_ativos_detalhe) quanto pelas rotas de
// lançamento/preview de PIPJ (que decidem, pra um mês/ano específico, quais
// desses projetos entram na conta).

export type ProjetoAtivoDetalhe = {
    nome: string
    data_inicio: string | null
    data_fim: string | null
}

// Compatibilidade com dados sincronizados antes dessa mudança, quando
// projetos_ativos_detalhe era só um array de nomes (string[]).
export function normalizarProjetoDetalhe(raw: any): ProjetoAtivoDetalhe {
    if (typeof raw === 'string') return { nome: raw, data_inicio: null, data_fim: null }
    return {
        nome: raw?.nome || '',
        data_inicio: raw?.data_inicio || null,
        data_fim: raw?.data_fim || null,
    }
}

function compararAnoMes(ano1: number, mes1: number, ano2: number, mes2: number): number {
    if (ano1 !== ano2) return ano1 - ano2
    return mes1 - mes2
}

// A partir de que mês/ano um projeto passa a contar no PIPJ, dada sua data
// de início (formato "YYYY-MM-DD", como o Monday retorna).
export function mesEfetivoInicio(dataInicio: string): { ano: number; mes: number } {
    const d = new Date(dataInicio + 'T12:00:00')
    const dia = d.getDate()
    let mes = d.getMonth() + 1
    let ano = d.getFullYear()
    if (dia >= 16) {
        mes += 1
        if (mes > 12) { mes = 1; ano += 1 }
    }
    return { ano, mes }
}

// Um projeto sem data_inicio conhecida (dado antigo, ainda sem sincronizar)
// conta sempre, pra não regredir o comportamento anterior a essa mudança.
export function contaProjetoNoMes(projeto: ProjetoAtivoDetalhe, mes: number, ano: number): boolean {
    if (!projeto.data_inicio) return true

    const inicio = mesEfetivoInicio(projeto.data_inicio)
    if (compararAnoMes(inicio.ano, inicio.mes, ano, mes) > 0) return false

    if (projeto.data_fim) {
        const fim = new Date(projeto.data_fim + 'T12:00:00')
        if (compararAnoMes(fim.getFullYear(), fim.getMonth() + 1, ano, mes) < 0) return false
    }

    return true
}

export function contarProjetosNoMes(projetos: ProjetoAtivoDetalhe[], mes: number, ano: number): number {
    return projetos.filter(p => contaProjetoNoMes(p, mes, ano)).length
}
