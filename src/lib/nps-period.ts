// Toda avaliação (NPS Projeto, NPS Interno, etc.) é sempre sobre o mês
// imediatamente anterior ao mês em que foi respondida/enviada.
export function mesReferenciaFromDate(date: Date | string): { mes: number; ano: number } {
    const d = typeof date === 'string' ? new Date(date) : date
    const mesEnvio = d.getMonth() + 1
    const anoEnvio = d.getFullYear()
    return mesEnvio === 1
        ? { mes: 12, ano: anoEnvio - 1 }
        : { mes: mesEnvio - 1, ano: anoEnvio }
}

// Intervalo de ENVIO (enviado_em, em ISO) das respostas cujo mês de
// referência cai em `filtro` — mês/ano, ou o ano inteiro. Serve para o banco
// devolver só o período pedido em vez do histórico todo. Tem um dia de folga
// de cada lado, porque mesReferenciaFromDate usa o fuso local e o banco
// compara em UTC: quem usa ainda confere cada linha com mesReferenciaFromDate.
// Sem ano não dá para limitar (devolve null).
export function janelaEnvioDaReferencia(filtro?: { mes?: number; ano?: number }): { desde: string; ate: string } | null {
    if (!filtro?.ano) return null
    const inicio = filtro.mes ? Date.UTC(filtro.ano, filtro.mes, 1) : Date.UTC(filtro.ano, 1, 1)
    const fim = filtro.mes ? Date.UTC(filtro.ano, filtro.mes + 1, 1) : Date.UTC(filtro.ano + 1, 1, 1)
    const umDia = 24 * 60 * 60 * 1000
    return { desde: new Date(inicio - umDia).toISOString(), ate: new Date(fim + umDia).toISOString() }
}

// Envios que caem nos `qtd` meses de referência mais recentes (o mês
// anterior ao atual e os `qtd - 1` antes dele), com um dia de folga.
export function janelaEnvioUltimosMeses(qtd: number, agora: Date = new Date()): { desde: string } {
    const inicio = Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - (qtd - 1), 1)
    return { desde: new Date(inicio - 24 * 60 * 60 * 1000).toISOString() }
}

// Mês de uma resposta de formulário: nos formulários de avaliação mensal
// (NPS Interno e NPS Projetos — ver formulariosDeMesAvaliado) é o mês
// avaliado, o anterior ao envio, igual a Performance e PIPJ; nos demais, o
// próprio mês do envio.
export function mesDaResposta(enviadoEm: string, mesAvaliado: boolean): { mes: number; ano: number } {
    if (mesAvaliado) return mesReferenciaFromDate(enviadoEm)
    const d = new Date(enviadoEm)
    return { mes: d.getMonth() + 1, ano: d.getFullYear() }
}

export const chaveDoMes = (m: { mes: number; ano: number }) => `${m.ano}-${String(m.mes).padStart(2, '0')}`

// Intervalo de envio (ISO) que cobre as respostas do mês `m` nos formulários
// `ids`: nos de mês avaliado, as enviadas no mês seguinte; nos demais, as
// enviadas no próprio mês. Um dia de folga de cada lado por causa do fuso
// (mesDaResposta usa o horário local, o banco compara em UTC) — quem usa
// confere cada resposta com mesDaResposta.
export function janelaDoMes(m: { mes: number; ano: number }, ids: string[], mesAvaliado: Set<string>): { desde: string; ate: string } {
    const algumAvaliado = ids.some(id => mesAvaliado.has(id))
    const algumPorEnvio = ids.some(id => !mesAvaliado.has(id))
    const inicio = algumPorEnvio ? Date.UTC(m.ano, m.mes - 1, 1) : Date.UTC(m.ano, m.mes, 1)
    const fim = algumAvaliado ? Date.UTC(m.ano, m.mes + 1, 1) : Date.UTC(m.ano, m.mes, 1)
    const umDia = 24 * 60 * 60 * 1000
    return { desde: new Date(inicio - umDia).toISOString(), ate: new Date(fim + umDia).toISOString() }
}
