// Leitura de formulários de avaliação de pessoas para os dashboards e o
// relatório administrativo (FormResponsesDashboard): quem foi avaliado, em
// qual papel ("aba") e com quais notas.
//
// O avaliado vem de dois lugares:
//  - de uma pergunta "Selecionar 1 colaborador" dona da seção (Piloto de
//    Elite, NPS Diretor, NPS Projetos...). Nesse caso o PAPEL é a própria
//    pergunta: no NPS Projetos, quem aparece em "Quem é o gerente deste
//    projeto?" é avaliado como Tático, e quem aparece em "Quem é o(a)
//    consultor(a) que você está avaliando?" (as 3 duplas) como Operacional —
//    independente do cargo cadastrado da pessoa;
//  - do alvo da resposta, nos formulários direcionados pela aba Público
//    (Piloto de Elite: GP, NPS Liderança...), que não têm essa pergunta.
import { avaliadoPerguntaPorSecao, competenciaLabel, stripHtml } from './forms-runtime'

const TIPOS_TEXTO = new Set(['texto', 'texto_longo', 'paragrafo'])
export const PAPEL_ALVO = '__alvo__'

export interface Papel {
    chave: string
    label: string
}

export interface Criterio {
    chave: string
    label: string
}

// Uma resposta vira uma linha por pessoa avaliada nela (o NPS Projetos avalia
// o gerente e até 3 consultores na MESMA resposta).
export interface LinhaAvaliacao {
    resposta: any
    papel: string | null
    avaliadoId: string | null
    notas: { perguntaId: string; valor: number }[]
    textos: { perguntaId: string; valor: string }[]
}

export interface ItemRanking {
    avaliadoId: string
    media: number
    qtdNotas: number
    qtdRespostas: number
}

export interface ResumoPapel {
    chave: string | null
    label: string
    media: number | null
    qtdNotas: number
    ranking: ItemRanking[]
    criterios: (Criterio & { media: number | null; qtd: number })[]
}

export function normalizarTexto(valor: string | null | undefined): string {
    return (valor || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()
}

function decodificarEntidades(texto: string): string {
    return texto
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim()
}

export function textoLimpo(html: string | null | undefined): string {
    return decodificarEntidades(stripHtml(html))
}

export function rotuloCriterio(pergunta: { competencia?: string | null; titulo?: string | null }): string {
    return decodificarEntidades(competenciaLabel(pergunta))
}

export function notaValida(valor: unknown): number | null {
    if (valor === null || valor === undefined || valor === '') return null
    const v = Number(valor)
    return isNaN(v) ? null : v
}

function rotuloPapel(chave: string, tituloPergunta: string): string {
    if (chave === PAPEL_ALVO) return 'Avaliados'
    if (chave.includes('gerente')) return 'Táticos'
    if (chave.includes('consultor')) return 'Operacionais'
    return tituloPergunta || 'Avaliados'
}

// `perguntas` precisa vir na ordem do formulário (campo `ordem`).
export function modeloAvaliacao(perguntas: any[], respostas: any[]) {
    const porId = new Map<string, any>(perguntas.map(p => [p.id, p]))
    const temPerguntaColaborador = perguntas.some(p => p.tipo === 'colaborador_unico')
    // O alvo da resposta só vale quando não há pergunta de colaborador —
    // senão uma nota de uma seção sem avaliado seria atribuída a uma pessoa.
    const temAlvo = !temPerguntaColaborador && respostas.some(r => r.alvo_colaborador_id)
    const donoPorSecao = avaliadoPerguntaPorSecao(perguntas)

    const donoDaPergunta = (perguntaId: string): string | undefined =>
        porId.get(perguntaId)?.tipo === 'colaborador_unico' ? perguntaId : donoPorSecao.get(perguntaId)

    const chavePapelDoDono = (donoId: string) => normalizarTexto(textoLimpo(porId.get(donoId)?.titulo)) || donoId

    const papelDaPergunta = (perguntaId: string): string | null => {
        if (!temPerguntaColaborador) return temAlvo ? PAPEL_ALVO : null
        const dono = donoDaPergunta(perguntaId)
        return dono ? chavePapelDoDono(dono) : null
    }

    const avaliadoDaPergunta = (resposta: any, perguntaId: string): string | null => {
        if (!temPerguntaColaborador) return resposta.alvo_colaborador_id || null
        const dono = donoDaPergunta(perguntaId)
        if (!dono) return null
        return (resposta.formulario_respostas_itens || []).find((it: any) => it.pergunta_id === dono)?.valor || null
    }

    // Papéis com notas e os critérios (competências) de cada um, na ordem do
    // formulário. Critérios repetidos entre seções do mesmo papel (as 3
    // duplas do NPS Projetos) viram um só.
    const papeis: Papel[] = []
    const criteriosPorPapel = new Map<string | null, Criterio[]>()
    for (const p of perguntas) {
        if (p.tipo !== 'escala') continue
        const papel = papelDaPergunta(p.id)
        if (papel && !papeis.some(x => x.chave === papel)) {
            const dono = temPerguntaColaborador ? donoDaPergunta(p.id) : undefined
            papeis.push({ chave: papel, label: rotuloPapel(papel, dono ? textoLimpo(porId.get(dono)?.titulo) : '') })
        }
        const label = rotuloCriterio(p)
        const chave = normalizarTexto(label)
        const lista = criteriosPorPapel.get(papel) || []
        if (!lista.some(c => c.chave === chave)) lista.push({ chave, label })
        criteriosPorPapel.set(papel, lista)
    }

    const linhasDaResposta = (resposta: any): LinhaAvaliacao[] => {
        const grupos = new Map<string, LinhaAvaliacao>()
        for (const it of resposta.formulario_respostas_itens || []) {
            const p = porId.get(it.pergunta_id)
            if (!p) continue
            const ehNota = p.tipo === 'escala'
            if (!ehNota && !TIPOS_TEXTO.has(p.tipo)) continue
            const grupo = temPerguntaColaborador ? (donoDaPergunta(p.id) ?? '') : ''
            let linha = grupos.get(grupo)
            if (!linha) {
                linha = { resposta, papel: papelDaPergunta(p.id), avaliadoId: avaliadoDaPergunta(resposta, p.id), notas: [], textos: [] }
                grupos.set(grupo, linha)
            }
            if (ehNota) {
                const v = notaValida(it.valor)
                if (v !== null) linha.notas.push({ perguntaId: p.id, valor: v })
            } else if (it.valor && String(it.valor).trim()) {
                linha.textos.push({ perguntaId: p.id, valor: String(it.valor) })
            }
        }
        return Array.from(grupos.values()).filter(l => l.notas.length > 0 || l.textos.length > 0)
    }

    const criterioDaPergunta = (perguntaId: string) => normalizarTexto(rotuloCriterio(porId.get(perguntaId) || {}))

    // Média geral, ranking por avaliado e média por critério — por papel.
    // `apenasPapel` restringe o resumo a uma aba; sem ele, todos os papéis.
    const resumir = (linhas: LinhaAvaliacao[], apenasPapel?: string) => {
        const media = (soma: number, qtd: number) => qtd > 0 ? soma / qtd : null
        let somaGeral = 0
        let qtdGeral = 0
        const chavesPapel: (string | null)[] = apenasPapel !== undefined
            ? [apenasPapel]
            : [...papeis.map(p => p.chave), null]
        const resumoPapeis: ResumoPapel[] = []
        for (const chave of chavesPapel) {
            const doPapel = linhas.filter(l => l.papel === chave)
            const criterios = criteriosPorPapel.get(chave) || []
            if (doPapel.length === 0) continue
            let soma = 0
            let qtd = 0
            const porAvaliado = new Map<string, { soma: number; qtd: number; respostas: Set<string> }>()
            const porCriterio = new Map<string, { soma: number; qtd: number }>()
            for (const l of doPapel) {
                for (const n of l.notas) {
                    soma += n.valor
                    qtd++
                    const c = criterioDaPergunta(n.perguntaId)
                    const acc = porCriterio.get(c) || { soma: 0, qtd: 0 }
                    acc.soma += n.valor
                    acc.qtd++
                    porCriterio.set(c, acc)
                    if (l.avaliadoId) {
                        const a = porAvaliado.get(l.avaliadoId) || { soma: 0, qtd: 0, respostas: new Set<string>() }
                        a.soma += n.valor
                        a.qtd++
                        a.respostas.add(l.resposta.id)
                        porAvaliado.set(l.avaliadoId, a)
                    }
                }
            }
            somaGeral += soma
            qtdGeral += qtd
            resumoPapeis.push({
                chave,
                label: papeis.find(p => p.chave === chave)?.label || 'Geral',
                media: media(soma, qtd),
                qtdNotas: qtd,
                ranking: Array.from(porAvaliado.entries())
                    .map(([avaliadoId, a]) => ({ avaliadoId, media: a.soma / a.qtd, qtdNotas: a.qtd, qtdRespostas: a.respostas.size }))
                    .sort((x, y) => y.media - x.media),
                criterios: criterios.map(c => {
                    const acc = porCriterio.get(c.chave)
                    return { ...c, media: acc ? media(acc.soma, acc.qtd) : null, qtd: acc?.qtd || 0 }
                }),
            })
        }
        return {
            mediaGeral: media(somaGeral, qtdGeral),
            qtdNotas: qtdGeral,
            papeis: resumoPapeis,
        }
    }

    return {
        temPerguntaColaborador,
        papeis,
        criteriosPorPapel,
        papelDaPergunta,
        avaliadoDaPergunta,
        linhasDaResposta,
        resumir,
    }
}

export type ModeloAvaliacao = ReturnType<typeof modeloAvaliacao>
export type ResumoAvaliacao = ReturnType<ModeloAvaliacao['resumir']>

// ── Relatório (HTML para impressão/PDF) ──────────────────────────────────────

function escapeHtml(texto: string): string {
    return texto
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
}

const corNota = (v: number) => v >= 4.5 ? '#10b981' : v >= 3.5 ? '#f59e0b' : '#ef4444'
const fundoNota = (v: number) => v >= 4.5 ? '#ecfdf5' : v >= 3.5 ? '#fffbeb' : '#fef2f2'

export function gerarRelatorioHtml(params: {
    titulo: string
    filtros: string[]
    resumo: ResumoAvaliacao
    mediaDoPapel: (chave: string | null) => number | null
    linhas: LinhaAvaliacao[]
    perguntas: any[]
    nomeDe: (id: string) => string
    mostrarPapel: boolean
}): string {
    const { titulo, filtros, resumo, mediaDoPapel, linhas, perguntas, nomeDe, mostrarPapel } = params
    const porId = new Map<string, any>(perguntas.map(p => [p.id, p]))
    const e = (s: string) => escapeHtml(s)
    const fmt = (v: number | null) => v === null ? '—' : v.toFixed(2)
    const blocosPapel = resumo.papeis.filter(p => p.qtdNotas > 0 || p.criterios.length > 0)
    const multiPapel = blocosPapel.length > 1

    const secaoCriterios = blocosPapel.map(p => `
        <div class="bloco">
            <h3>${multiPapel ? `${e(p.label)} — ` : ''}Média por Pergunta</h3>
            <table>
                <thead><tr><th>Critério</th><th style="width:90px">Média</th><th style="width:90px">Notas</th></tr></thead>
                <tbody>${p.criterios.map(c => `<tr>
                    <td>${e(c.label)}</td>
                    <td style="font-weight:bold;color:${c.media === null ? '#94a3b8' : corNota(c.media)}">${fmt(c.media)}</td>
                    <td>${c.qtd}</td>
                </tr>`).join('')}</tbody>
            </table>
        </div>`).join('')

    const secaoRanking = blocosPapel.filter(p => p.ranking.length > 0).map(p => {
        const base = mediaDoPapel(p.chave)
        return `
        <div class="bloco">
            <h3>${multiPapel ? `${e(p.label)} — ` : ''}Ranking dos Avaliados${base !== null ? ` <small>(média ${base.toFixed(2)})</small>` : ''}</h3>
            <table>
                <thead><tr><th style="width:40px">#</th><th>Avaliado</th><th style="width:90px">Média</th><th style="width:110px">Avaliações</th></tr></thead>
                <tbody>${p.ranking.map((r, i) => `<tr>
                    <td>${i + 1}</td>
                    <td>${e(nomeDe(r.avaliadoId))}${base !== null && r.media < base ? ' <span class="abaixo">abaixo da média</span>' : ''}</td>
                    <td style="font-weight:bold;color:${corNota(r.media)}">${r.media.toFixed(2)}</td>
                    <td>${r.qtdRespostas}</td>
                </tr>`).join('')}</tbody>
            </table>
        </div>`
    }).join('')

    const linhasOrdenadas = [...linhas].sort((a, b) => String(b.resposta.enviado_em).localeCompare(String(a.resposta.enviado_em)))
    const rotuloPapelDe = (chave: string | null) => resumo.papeis.find(p => p.chave === chave)?.label || ''
    const detalhes = linhasOrdenadas.map(l => {
        const r = l.resposta
        const data = new Date(r.enviado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
        const media = l.notas.length > 0 ? l.notas.reduce((s, n) => s + n.valor, 0) / l.notas.length : null
        const chips = l.notas.map(n => `<span class="chip"><small>${e(rotuloCriterio(porId.get(n.perguntaId) || {}))}</small><strong style="color:${corNota(n.valor)}">${n.valor}</strong></span>`).join('')
        const comentarios = l.textos.map(t => e(t.valor)).join('<br/>') || '—'
        return `<tr>
            <td>${e(r.colaboradores?.nome || 'Anônimo')}</td>
            <td>${l.avaliadoId ? e(nomeDe(l.avaliadoId)) : '—'}${mostrarPapel && l.papel ? `<br/><span class="tag">${e(rotuloPapelDe(l.papel))}</span>` : ''}</td>
            <td style="text-align:center">${media === null ? '—' : `<span class="nota" style="color:${corNota(media)};background:${fundoNota(media)}">${media.toFixed(1)}</span>`}</td>
            <td>${chips || '—'}</td>
            <td style="white-space:nowrap">${data}</td>
            <td>${comentarios}</td>
        </tr>`
    }).join('')

    const agora = new Date()
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Relatório — ${e(titulo)}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 30px; color: #1e293b; font-size: 12px; line-height: 1.5; }
        .header { margin-bottom: 20px; border-bottom: 3px solid #6366f1; padding-bottom: 14px; }
        .logo { font-size: 20px; font-weight: 800; color: #6366f1; }
        h1 { font-size: 22px; color: #0f172a; }
        h2 { font-size: 15px; margin: 24px 0 12px; color: #334155; border-bottom: 2px solid #6366f1; padding-bottom: 6px; }
        h3 { font-size: 13px; margin: 16px 0 8px; color: #334155; }
        h3 small { color: #64748b; font-weight: normal; }
        .subtitle { color: #64748b; font-size: 11px; }
        .filtros { margin-top: 8px; font-size: 11px; color: #475569; }
        .filtros span { display: inline-block; background: #eef2ff; color: #4338ca; border-radius: 6px; padding: 2px 8px; margin: 2px 6px 2px 0; }
        .kpis { display: flex; gap: 12px; margin-bottom: 8px; }
        .kpi { flex: 1; border: 1px solid #e2e8f0; border-radius: 10px; padding: 10px 14px; background: #f8fafc; }
        .kpi small { display: block; font-size: 10px; text-transform: uppercase; color: #64748b; font-weight: 700; }
        .kpi strong { font-size: 22px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 11px; }
        th { background: #f1f5f9; border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; font-size: 10px; text-transform: uppercase; color: #475569; }
        td { border: 1px solid #e2e8f0; padding: 8px 10px; vertical-align: top; }
        tr:nth-child(even) td { background: #f8fafc; }
        .bloco { page-break-inside: avoid; }
        .chip { display: inline-block; margin: 0 6px 6px 0; background: #f8fafc; padding: 3px 7px; border-radius: 6px; border: 1px solid #e2e8f0; }
        .chip small { display: block; font-size: 8px; color: #64748b; text-transform: uppercase; }
        .nota { display: inline-block; padding: 3px 9px; border-radius: 8px; font-weight: bold; font-size: 13px; }
        .tag { display: inline-block; margin-top: 3px; font-size: 10px; color: #64748b; background: #f1f5f9; padding: 1px 6px; border-radius: 4px; }
        .abaixo { font-size: 9px; color: #ef4444; background: #fef2f2; border-radius: 4px; padding: 1px 5px; }
        @media print { body { padding: 15px; } }
    </style>
</head>
<body>
    <div class="header">
        <div class="logo">Produtiva Júnior</div>
        <h1>Relatório: ${e(titulo)}</h1>
        <p class="subtitle">Gerado em ${agora.toLocaleDateString('pt-BR')} às ${agora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</p>
        ${filtros.length > 0 ? `<div class="filtros">Filtros: ${filtros.map(f => `<span>${e(f)}</span>`).join('')}</div>` : ''}
    </div>
    <div class="kpis">
        <div class="kpi"><small>Média Geral</small><strong style="color:${resumo.mediaGeral === null ? '#94a3b8' : corNota(resumo.mediaGeral)}">${fmt(resumo.mediaGeral)}</strong> <span class="subtitle">/5 (${resumo.qtdNotas} notas)</span></div>
        <div class="kpi"><small>Respostas</small><strong>${new Set(linhas.map(l => l.resposta.id)).size}</strong></div>
        <div class="kpi"><small>Pessoas avaliadas</small><strong>${new Set(linhas.map(l => l.avaliadoId).filter(Boolean)).size}</strong></div>
    </div>
    ${secaoCriterios}
    ${secaoRanking}
    <h2>Respostas</h2>
    ${detalhes ? `<table>
        <thead><tr><th>Respondente</th><th>Sobre</th><th style="width:60px">Nota</th><th>Detalhamento</th><th style="width:80px">Data</th><th>Comentários</th></tr></thead>
        <tbody>${detalhes}</tbody>
    </table>` : '<p class="subtitle">Nenhuma resposta dentro dos filtros aplicados.</p>'}
</body>
</html>`
}
