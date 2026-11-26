// Equipe de cada projeto (gerente + consultores) e o autopreenchimento do
// formulário NPS Projetos.
//
// Os vínculos ficam na tabela projeto_equipe (ver a migração
// 20261126_projeto_equipe.sql), preenchida pela sincronização diária com o
// Monday (syncMondayEquipes em monday-sync.ts). Aqui ficam só a leitura e as
// regras puras — sem acesso a tela — para serem usadas por qualquer página e
// testadas isoladamente.
import { isSchemaDesatualizado } from './db-compat'
import { stripHtml } from './forms-runtime'
import { CONSULTOR_SO, GERENTE_SO } from './nps-competencias'

export type MembroEquipe = { id: string, nome: string }

export type ProjetoComEquipe = {
    id: string
    nome: string
    gerentes: MembroEquipe[]
    consultores: MembroEquipe[]
}

export type Papel = 'gerente' | 'consultor'

const porNome = (a: MembroEquipe, b: MembroEquipe) => a.nome.localeCompare(b.nome, 'pt-BR')

// Projetos ativos já com a equipe de cada um. `equipeDisponivel` é false
// quando a tabela projeto_equipe ainda não existe (migração pendente) — a
// tela então segue como era antes, sem equipes, em vez de quebrar.
// `client` pode ser o do navegador ou o admin (a tabela é lida como as demais).
export async function buscarProjetosComEquipe(client: any): Promise<{ projetos: ProjetoComEquipe[], equipeDisponivel: boolean }> {
    const { data: projetosRows } = await client.from('projetos').select('id, nome').eq('status', 'Ativo').order('nome')
    const projetos: ProjetoComEquipe[] = (projetosRows || []).map((p: any) => ({ id: p.id, nome: p.nome, gerentes: [], consultores: [] }))

    const { data: equipeRows, error } = await client
        .from('projeto_equipe')
        .select('projeto_id, papel, colaboradores!inner(id, nome, status)')
        .eq('colaboradores.status', 'Ativo')
    if (isSchemaDesatualizado(error)) return { projetos, equipeDisponivel: false }

    const porId = new Map(projetos.map(p => [p.id, p]))
    for (const row of (equipeRows || []) as any[]) {
        const projeto = porId.get(row.projeto_id)
        const colab = Array.isArray(row.colaboradores) ? row.colaboradores[0] : row.colaboradores
        // Quem foi desligado nunca aparece, mesmo que a sincronização ainda
        // não tenha removido o vínculo.
        if (!projeto || !colab || colab.status === 'Desligado') continue
        const membro = { id: colab.id as string, nome: colab.nome as string }
        if (row.papel === 'gerente') projeto.gerentes.push(membro)
        else projeto.consultores.push(membro)
    }
    for (const p of projetos) { p.gerentes.sort(porNome); p.consultores.sort(porNome) }
    return { projetos, equipeDisponivel: true }
}

export function papelNoProjeto(projeto: ProjetoComEquipe, membroId: string | null | undefined): Papel | null {
    if (!membroId) return null
    if (projeto.gerentes.some(m => m.id === membroId)) return 'gerente'
    if (projeto.consultores.some(m => m.id === membroId)) return 'consultor'
    return null
}

export function projetosDoMembro(projetos: ProjetoComEquipe[], membroId: string | null | undefined): ProjetoComEquipe[] {
    return projetos.filter(p => papelNoProjeto(p, membroId) !== null)
}

// "Gerente: Ana · Consultores: Bia, Caio" — texto curto para listas.
export function resumoEquipe(projeto: Pick<ProjetoComEquipe, 'gerentes' | 'consultores'>): string {
    const g = projeto.gerentes.length ? projeto.gerentes.map(m => m.nome).join(', ') : 'sem gerente'
    const c = projeto.consultores.length ? projeto.consultores.map(m => m.nome).join(', ') : 'sem consultores'
    return `Gerente: ${g} · Consultores: ${c}`
}

// ─── Autopreenchimento do formulário NPS Projetos ──────────────────────────
//
// O formulário (ver 20260911_nps_projetos_formulario_generico_fase_a.sql) tem:
//   1. seção inicial: "Sobre qual projeto?" + "Você é o gerente?"
//   2. seção do gerente: "Quem é o gerente?" + notas do gerente
//   3. de 1 a N seções de consultor: "Quem é o consultor?" + notas +
//      "Há outro consultor?"
// Como o formulário é editável por quem administra, as perguntas são achadas
// pelo que elas SÃO (tipo, competências avaliadas, texto), não por ID fixo.

type Pergunta = { id: string, tipo: string, titulo?: string | null, competencia?: string | null, opcoes?: unknown }

type SecaoNps = {
    perguntas: Pergunta[]
    papel: Papel | null   // quem a seção avalia (pelas competências das notas)
}

function agruparSecoes(perguntas: Pergunta[]): SecaoNps[] {
    const secoes: SecaoNps[] = []
    let atual: Pergunta[] = []
    const fecha = () => { secoes.push({ perguntas: atual, papel: null }); atual = [] }
    for (const p of perguntas) {
        if (p.tipo === 'secao') { fecha(); continue }
        atual.push(p)
    }
    fecha()
    for (const s of secoes) {
        const competencias = s.perguntas.filter(p => p.tipo === 'escala').map(p => (p.competencia || '').trim())
        if (competencias.some(c => CONSULTOR_SO.has(c))) s.papel = 'consultor'
        else if (competencias.some(c => GERENTE_SO.has(c))) s.papel = 'gerente'
    }
    return secoes
}

const ehSimNao = (p: Pergunta) => p.tipo === 'selecao_unica' && Array.isArray(p.opcoes) && (p.opcoes as unknown[]).includes('Sim') && (p.opcoes as unknown[]).includes('Não')

export type PerguntasNps = {
    projeto: string | null
    voceEGerente: string | null
    gerenteColaborador: string | null
    // Uma entrada por seção de consultor, na ordem do formulário.
    consultores: { colaborador: string, outroConsultor: string | null }[]
}

export function localizarPerguntasNps(perguntas: Pergunta[]): PerguntasNps {
    const ordenadas = perguntas.filter(p => p.tipo !== 'titulo')
    const secoes = agruparSecoes(ordenadas)

    const projeto = ordenadas.find(p => p.tipo === 'selecionar_projeto')?.id ?? null
    const secaoDoProjeto = secoes.find(s => s.perguntas.some(p => p.tipo === 'selecionar_projeto'))
    const voceEGerente = secaoDoProjeto?.perguntas.find(p => ehSimNao(p) && /gerente/i.test(stripHtml(p.titulo)))?.id ?? null

    const colaboradorDe = (s: SecaoNps) => s.perguntas.find(p => p.tipo === 'colaborador_unico')?.id ?? null
    const gerenteColaborador = (() => {
        const s = secoes.find(x => x.papel === 'gerente')
        return s ? colaboradorDe(s) : null
    })()
    const consultores: PerguntasNps['consultores'] = []
    for (const s of secoes) {
        if (s.papel !== 'consultor') continue
        const colaborador = colaboradorDe(s)
        if (!colaborador) continue
        const outro = s.perguntas.find(p => ehSimNao(p) && /outro/i.test(stripHtml(p.titulo)))?.id ?? null
        consultores.push({ colaborador, outroConsultor: outro })
    }
    return { projeto, voceEGerente, gerenteColaborador, consultores }
}

export type PreenchimentoNps = {
    // Respostas a gravar (perguntaId -> valor).
    respostas: Record<string, string>
    // Perguntas preenchidas pela equipe do projeto — a tela as mostra
    // bloqueadas, pra a avaliação ser sempre sobre as pessoas certas.
    travadas: Set<string>
}

// Dada a escolha do projeto, devolve o que o formulário já pode vir
// preenchido: se a pessoa é o gerente, o gerente a avaliar e os consultores
// (todos os outros do projeto, na ordem alfabética, um por seção). Quem não
// pertence ao projeto não recebe preenchimento (devolve null).
export function preencherNpsProjeto(perguntas: Pergunta[], projeto: ProjetoComEquipe, membroId: string | null | undefined): PreenchimentoNps | null {
    const meuPapel = papelNoProjeto(projeto, membroId)
    if (!meuPapel) return null

    const alvo = localizarPerguntasNps(perguntas)
    const respostas: Record<string, string> = {}
    const travadas = new Set<string>()
    const define = (id: string | null, valor: string) => { if (id) { respostas[id] = valor; travadas.add(id) } }

    // "Você é o gerente?" só é travada quando há equipe para confirmar.
    define(alvo.voceEGerente, meuPapel === 'gerente' ? 'Sim' : 'Não')

    if (meuPapel === 'consultor') {
        const gerente = projeto.gerentes.find(m => m.id !== membroId)
        if (gerente) define(alvo.gerenteColaborador, gerente.id)
    }

    // Consultores a avaliar: todos os do projeto, menos a própria pessoa.
    const duplas = projeto.consultores.filter(m => m.id !== membroId)
    alvo.consultores.forEach((secao, i) => {
        const dupla = duplas[i]
        if (!dupla) return
        define(secao.colaborador, dupla.id)
        // "Há outro consultor?" — Sim se ainda sobra alguém para a próxima seção.
        if (secao.outroConsultor) define(secao.outroConsultor, i < duplas.length - 1 && i < alvo.consultores.length - 1 ? 'Sim' : 'Não')
    })

    return { respostas, travadas }
}
