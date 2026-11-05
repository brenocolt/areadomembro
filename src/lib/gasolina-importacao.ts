// Importação da planilha antiga "REEMBOLSO GASOLINA" para as tabelas da Área
// do Membro (fase 4). A planilha é lida no navegador (gasolina-planilha.ts);
// aqui chega só o resultado estruturado. O mesmo código simula (só relatório)
// e grava, para o relatório mostrar exatamente o que vai acontecer.
//
// Regras (decididas com a VP):
// - só viagens com data a partir de 01/01/2026 (o corte já vem do leitor);
// - só membros cadastrados na Área do Membro — aba sem cadastro fica de fora;
// - litros/preço/valor como na planilha (valor = litros × preço do mês, porque
//   a coluna VALOR da planilha zera tudo o que não está Pendente);
// - status mantido; Pendente com mais de 2 meses entra como Vencido;
// - membro que já tem viagens importadas é pulado (reimportar é seguro).
// - gravação em lotes por membro; carros e preços são reaproveitados se já
//   existirem, então rodar de novo depois de uma falha não duplica nada.
import { dataMaisAntigaPermitida, inicioDoMes, type GasolinaCentroCusto } from './gasolina'
import { normalizarTexto, type AbaPlanilha, type PlanilhaGasolina } from './gasolina-planilha'
import { listarOpcoesDropdown } from './monday'

export type SituacaoAba = 'importar' | 'ambiguo' | 'nao_encontrado' | 'ja_importado' | 'sem_viagens' | 'nao_importar'

export interface RelatorioAba {
    aba: string
    oculta: boolean
    situacao: SituacaoAba
    colaborador: { id: string, nome: string } | null
    candidatos: { id: string, nome: string }[]
    viagens: { Pendente: number, Reembolsado: number, Vencido: number }
    carros_novos: string[]
    sem_data: number
    sem_litros: number
    sem_preco: number
    projetos_fora_do_monday: string[]   // só das viagens Pendentes (precisam ser corrigidas para solicitar)
}

export interface RelatorioImportacao {
    gravado: boolean
    precos_novos: number
    abas: RelatorioAba[]
    colaboradores: { id: string, nome: string }[]
    aviso_monday: string | null
    totais: { membros: number, viagens: number, carros: number }
}

type Colab = { id: string, nome: string }

const PALAVRAS_IGNORADAS = new Set(['DE', 'DA', 'DO', 'DAS', 'DOS', 'E'])
const palavras = (nome: string) => normalizarTexto(nome).split(' ').filter(p => p && !PALAVRAS_IGNORADAS.has(p))

// Nome da aba ("Breno Colt") x cadastro ("Breno Colt de Souza"): igual, ou um
// único colaborador com o mesmo primeiro nome que contém todas as palavras da aba.
export function casarColaborador(aba: string, colaboradores: Colab[]): { colaborador: Colab | null, candidatos: Colab[] } {
    const alvo = normalizarTexto(aba)
    const exato = colaboradores.filter(c => normalizarTexto(c.nome) === alvo)
    if (exato.length === 1) return { colaborador: exato[0], candidatos: exato }
    const p = palavras(aba)
    if (!p.length) return { colaborador: null, candidatos: [] }
    const candidatos = colaboradores.filter(c => {
        const pc = palavras(c.nome)
        return pc[0] === p[0] && p.every(x => pc.includes(x))
    })
    return { colaborador: candidatos.length === 1 ? candidatos[0] : null, candidatos }
}

// Mesma normalização da automação do n8n para casar projetos: sem acento,
// pontuação e espaços, e singular ("Conexões" = "CONEXAO").
function chaveProjeto(texto: string): string {
    const s = normalizarTexto(texto).replace(/[^A-Z0-9]/g, '')
    return s.endsWith('S') ? s.slice(0, -1) : s
}

function statusDaPlanilha(texto: string, data: string, limite: string): 'Pendente' | 'Reembolsado' | 'Vencido' {
    const t = normalizarTexto(texto)
    if (t === 'REEMBOLSADO') return 'Reembolsado'
    if (t === 'VENCIDO') return 'Vencido'
    return data < limite ? 'Vencido' : 'Pendente'
}

const vazio = (texto: string, padrao: string) => (texto && texto.trim() ? texto.trim().slice(0, 200) : padrao)

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function processarImportacao(supabase: any, planilha: PlanilhaGasolina, opcoes: { gravar: boolean, mapeamento?: Record<string, string | null> }): Promise<RelatorioImportacao> {
    const [{ data: colabs }, { data: centros }, { data: precosBanco }, { data: jaImportados }] = await Promise.all([
        supabase.from('colaboradores').select('id, nome').order('nome'),
        supabase.from('gasolina_centros_custo').select('*'),
        supabase.from('gasolina_precos').select('mes, preco_litro'),
        supabase.from('gasolina_viagens').select('colaborador_id').eq('origem', 'planilha'),
    ])
    const colaboradores: Colab[] = (colabs ?? []).filter((c: Colab) => c.nome)
    const porId = new Map(colaboradores.map(c => [c.id, c]))
    const importados = new Set<string>((jaImportados ?? []).map((v: { colaborador_id: string }) => v.colaborador_id))

    // Centros: Prospecção -> centro fixo de rótulo PROSPECÇÃO; o resto -> centro de projetos.
    const lista: GasolinaCentroCusto[] = centros ?? []
    const centroProspeccao = lista.find(c => c.tipo === 'fixo' && chaveProjeto(c.rotulo_fixo ?? '') === 'PROSPECCAO')
    const centroProjetos = lista.find(c => c.tipo === 'projeto' && c.ativo) ?? lista.find(c => c.tipo === 'projeto')
    if (!centroProspeccao || !centroProjetos) throw new Error('Centros de custo de Prospecção e de Projetos precisam existir antes da importação.')

    // Projetos do Monday para padronizar o nome (ex.: "Conexão" -> "CONEXÃO").
    const projetosMonday = new Map<string, string>()
    let avisoMonday: string | null = null
    try {
        for (const p of await listarOpcoesDropdown(centroProjetos.monday_coluna_projeto ?? '')) projetosMonday.set(chaveProjeto(p), p)
    } catch (err) {
        avisoMonday = `Não foi possível ler a lista de projetos do Monday (${err instanceof Error ? err.message : String(err)}). Os projetos ficam com o nome da planilha.`
    }

    // Preços: os da planilha só entram nos meses que a VP ainda não lançou.
    const precos = new Map<string, number>((precosBanco ?? []).map((p: { mes: string, preco_litro: number }) => [p.mes.slice(0, 10), Number(p.preco_litro)]))
    const precosNovos = planilha.precos.filter(p => !precos.has(p.mes))
    for (const p of precosNovos) precos.set(p.mes, p.preco_litro)
    if (opcoes.gravar && precosNovos.length) {
        const { error } = await supabase.from('gasolina_precos').insert(precosNovos.map(p => ({ mes: p.mes, preco_litro: p.preco_litro })))
        if (error) throw new Error(`Erro ao gravar preços: ${error.message}`)
    }

    const limite = dataMaisAntigaPermitida()
    const relatorio: RelatorioAba[] = []
    let totalViagens = 0, totalCarros = 0, totalMembros = 0

    for (const aba of planilha.abas) {
        const { colaborador: sugerido, candidatos } = casarColaborador(aba.nome, colaboradores)
        const escolhido = opcoes.mapeamento && aba.nome in opcoes.mapeamento
            ? (opcoes.mapeamento[aba.nome] ? porId.get(opcoes.mapeamento[aba.nome] as string) ?? null : null)
            : sugerido
        const r: RelatorioAba = {
            aba: aba.nome, oculta: aba.oculta, situacao: 'importar', colaborador: escolhido,
            candidatos: candidatos.slice(0, 10), viagens: { Pendente: 0, Reembolsado: 0, Vencido: 0 },
            carros_novos: [], sem_data: aba.sem_data, sem_litros: 0, sem_preco: 0, projetos_fora_do_monday: [],
        }
        relatorio.push(r)

        if (!aba.viagens.length) { r.situacao = 'sem_viagens'; continue }
        if (!escolhido) {
            r.situacao = opcoes.mapeamento && aba.nome in opcoes.mapeamento ? 'nao_importar'
                : candidatos.length > 1 ? 'ambiguo' : 'nao_encontrado'
            continue
        }
        if (importados.has(escolhido.id)) { r.situacao = 'ja_importado'; continue }

        const resultado = await importarAba(supabase, aba, escolhido.id, {
            gravar: opcoes.gravar, limite, precos, projetosMonday,
            centroProspeccao: centroProspeccao.id, centroProjetos: centroProjetos.id,
        })
        Object.assign(r, resultado)
        importados.add(escolhido.id)   // mesma pessoa em duas abas: só a primeira entra
        totalMembros++
        totalViagens += resultado.viagens.Pendente + resultado.viagens.Reembolsado + resultado.viagens.Vencido
        totalCarros += resultado.carros_novos.length
    }

    return {
        gravado: opcoes.gravar,
        precos_novos: precosNovos.length,
        abas: relatorio,
        colaboradores,
        aviso_monday: avisoMonday,
        totais: { membros: totalMembros, viagens: totalViagens, carros: totalCarros },
    }
}

async function importarAba(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    supabase: any, aba: AbaPlanilha, colaboradorId: string,
    ctx: { gravar: boolean, limite: string, precos: Map<string, number>, projetosMonday: Map<string, string>, centroProspeccao: string, centroProjetos: string },
): Promise<Pick<RelatorioAba, 'viagens' | 'carros_novos' | 'sem_litros' | 'sem_preco' | 'projetos_fora_do_monday'>> {
    // Carros: reaproveita o carro ativo de mesmo nome; senão cria (sem foto).
    const { data: existentes } = await supabase.from('gasolina_veiculos')
        .select('id, modelo, autonomia_km_l').eq('colaborador_id', colaboradorId).eq('ativo', true)
    const carros = new Map<string, { id: string | null, autonomia: number }>()
    for (const v of existentes ?? []) carros.set(normalizarTexto(v.modelo), { id: v.id, autonomia: Number(v.autonomia_km_l) })
    const carrosNovos: string[] = []
    for (const c of aba.carros) {
        const chave = normalizarTexto(c.nome)
        if (carros.has(chave)) continue
        carrosNovos.push(c.nome)
        let id: string | null = null
        if (ctx.gravar) {
            const { data, error } = await supabase.from('gasolina_veiculos').insert({
                colaborador_id: colaboradorId,
                modelo: c.nome.slice(0, 80),
                combustivel: 'Não informado',
                autonomia_informada: c.autonomia,
                autonomia_km_l: c.autonomia,
                foto_painel_url: '',
            }).select('id').single()
            if (error) throw new Error(`Erro ao gravar carro "${c.nome}" (${aba.nome}): ${error.message}`)
            id = data.id
        }
        carros.set(chave, { id, autonomia: c.autonomia })
    }

    const viagens = { Pendente: 0, Reembolsado: 0, Vencido: 0 }
    const foraDoMonday = new Set<string>()
    let semLitros = 0, semPreco = 0
    const linhas = []

    for (const v of aba.viagens) {
        const data = v.data as string
        const carro = carros.get(normalizarTexto(v.carro))
        const km = v.distancia_km as number
        const litros = v.litros ?? (carro?.autonomia ? Math.round((km / carro.autonomia) * 1000) / 1000 : null)
        const preco = ctx.precos.get(inicioDoMes(data)) ?? v.preco_litro
        const status = statusDaPlanilha(v.status, data, ctx.limite)
        if (litros == null) semLitros++
        if (preco == null) semPreco++
        viagens[status]++

        const motivo = vazio(v.motivo, 'Sem projeto')
        const prospeccao = chaveProjeto(motivo) === 'PROSPECCAO'
        const projetoMonday = prospeccao ? null : ctx.projetosMonday.get(chaveProjeto(motivo))
        if (!prospeccao && !projetoMonday && status === 'Pendente' && ctx.projetosMonday.size) foraDoMonday.add(motivo)

        linhas.push({
            colaborador_id: colaboradorId,
            veiculo_id: carro?.id ?? null,
            centro_custo_id: prospeccao ? ctx.centroProspeccao : ctx.centroProjetos,
            projeto: prospeccao ? 'PROSPECÇÃO' : (projetoMonday ?? motivo),
            projeto_original: v.motivo || null,
            origem_local: vazio(v.origem, '—'),
            destino_local: vazio(v.destino, '—'),
            distancia_km: km,
            data_viagem: data,
            autonomia_usada: carro?.autonomia ?? (litros ? Math.round((km / litros) * 100) / 100 : null),
            litros,
            preco_litro: preco,
            valor: litros != null && preco != null ? Math.round(litros * preco * 100) / 100 : null,
            status,
            origem: 'planilha',
        })
    }

    // Um insert só por membro (no máximo ~200 viagens): ou entram todas, ou
    // nenhuma — assim uma falha no meio não deixa o membro pela metade, e
    // rodar de novo continua seguro.
    if (ctx.gravar && linhas.length) {
        const { error } = await supabase.from('gasolina_viagens').insert(linhas)
        if (error) throw new Error(`Erro ao gravar viagens de ${aba.nome}: ${error.message}`)
    }

    return { viagens, carros_novos: carrosNovos, sem_litros: semLitros, sem_preco: semPreco, projetos_fora_do_monday: [...foraDoMonday] }
}
