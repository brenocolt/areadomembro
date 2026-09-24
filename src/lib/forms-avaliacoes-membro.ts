import { isSchemaDesatualizado, type ErroPostgrest } from './db-compat'
import { avaliadoPerguntaPorSecao } from './forms-runtime'
import { buscarTodasPaginas } from './paginacao'

// Busca, em TODOS os formulários do sistema (qualquer tipo/pasta, marcados
// ou não como NPS Interno), as respostas em que um colaborador específico é
// o AVALIADO — usado pelo Assistente Pessoal e pelo Agente de Feedback para
// que a leitura de feedbacks de um membro não dependa de o formulário estar
// marcado com um propósito específico (NPS Interno, por exemplo): qualquer
// formulário direcionado (Quem Recebe) ou com uma pergunta "Selecionar 1
// Colaborador" que tenha avaliado essa pessoa entra na conta.
//
// Resolve "sobre quem é a resposta" das duas formas que existem no sistema
// — formulario_respostas.alvo_colaborador_id (formulário direcionado) e a
// resposta de uma pergunta do tipo colaborador_unico (modelo antigo, usado
// pelo Piloto de Elite) — mesmo raciocínio de FormularioCompetenciasView e
// getNpsInternoRespostasSobre, só que sem restringir a formulários
// marcados com nps_interno.
//
// Um formulário pode ter VÁRIAS perguntas colaborador_unico (uma por seção
// — ex.: um NPS Projetos único perguntando "quem é o gerente" numa seção e
// "quem é a dupla" noutra), cada uma avaliando uma pessoa diferente na
// MESMA resposta. Por isso os itens de cada resposta são filtrados pra só
// entrar os que pertencem à(s) seção(ões) cujo colaborador_unico bateu com
// este colaborador (ver avaliadoPerguntaPorSecao) — sem isso, as notas de
// outra pessoa avaliada na mesma resposta vazariam pra cá.
//
// As duas leituras deixam de fora as CÓPIAS do histórico de avaliacoes_nps
// que a migração 20260914 gravou no formulário genérico do NPS Projetos (as
// únicas respostas desse formulário com alvo_colaborador_id). Quem chama já
// lê avaliacoes_nps direto — contá-las aqui também dobraria o NPS Projetos
// antigo (mesma regra de getAvaliacoesNpsGenericoSinteticas).
export type RespostaFormularioSobreColaborador = {
  formularioId: string
  formularioTitulo: string
  tipoFormulario: string
  enviado_em: string
  perguntas: { id: string; tipo: string; titulo?: string | null; competencia?: string | null }[]
  itens: { pergunta_id: string; valor: string | null }[]
}

type FormRow = { id: string; titulo: string; tipo_formulario?: string | null; nps_projetos_generico?: boolean | null }
type PerguntaRow = { id: string; formulario_id: string; tipo: string; titulo?: string | null; competencia?: string | null; ordem?: number }
type RespostaRow = { id: string; formulario_id: string; enviado_em: string; alvo_colaborador_id?: string | null; formulario_respostas_itens?: { pergunta_id: string; valor: string | null }[] }

// `.in('id', [...])` vai na URL — com muitos ids ela passa do limite do
// servidor. Consultas por lista de ids são feitas em lotes deste tamanho.
const LOTE_IDS = 100

// Formulários e perguntas de todo o sistema (as perguntas em páginas: são
// ~20 por formulário e a API corta em 1000 linhas).
async function carregarFormulariosEPerguntas(supabaseAdmin: any) {
  let formsRes = await supabaseAdmin.from('formularios').select('id, titulo, tipo_formulario, nps_projetos_generico')
  // nps_projetos_generico vem da migração 20260912 — sem ela, não há cópias.
  if (isSchemaDesatualizado(formsRes.error)) formsRes = await supabaseAdmin.from('formularios').select('id, titulo, tipo_formulario')
  const forms = (formsRes.data || []) as FormRow[]
  const formsById = new Map(forms.map((f) => [f.id, f]))
  const formsNpsProjetos = new Set(forms.filter((f) => f.nps_projetos_generico).map((f) => f.id))

  const { data: perguntas } = await buscarTodasPaginas<PerguntaRow>((de, ate) => supabaseAdmin
    .from('formulario_perguntas')
    .select('id, formulario_id, tipo, titulo, competencia, ordem')
    .order('id')
    .range(de, ate))
  const perguntasPorForm = new Map<string, PerguntaRow[]>()
  for (const p of perguntas) {
    const arr = perguntasPorForm.get(p.formulario_id) || []
    arr.push(p)
    perguntasPorForm.set(p.formulario_id, arr)
  }

  const ehCopiaDoHistorico = (r: RespostaRow) => !!r.alvo_colaborador_id && formsNpsProjetos.has(r.formulario_id)
  return { forms, formsById, formsNpsProjetos, perguntas, perguntasPorForm, ehCopiaDoHistorico }
}

function paraSaida(r: RespostaRow, formsById: Map<string, FormRow>, perguntasPorForm: Map<string, PerguntaRow[]>): RespostaFormularioSobreColaborador {
  const form = formsById.get(r.formulario_id)
  return {
    formularioId: r.formulario_id,
    formularioTitulo: form?.titulo || 'Formulário',
    tipoFormulario: form?.tipo_formulario || 'Formulário',
    enviado_em: r.enviado_em,
    perguntas: perguntasPorForm.get(r.formulario_id) || [],
    itens: r.formulario_respostas_itens || [],
  }
}

export async function getRespostasFormulariosSobreColaborador(
  supabaseAdmin: any,
  colaboradorId: string,
): Promise<RespostaFormularioSobreColaborador[]> {
  const { forms, formsById, perguntas, perguntasPorForm, ehCopiaDoHistorico } = await carregarFormulariosEPerguntas(supabaseAdmin)
  if (forms.length === 0) return []

  // Pergunta de escala/texto -> pergunta colaborador_unico da mesma seção,
  // pré-computado por formulário (ver avaliadoPerguntaPorSecao).
  const avaliadoPorFormPergunta = new Map<string, Map<string, string>>()
  for (const [formId, ps] of perguntasPorForm.entries()) {
    const ordenadas = [...ps].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    avaliadoPorFormPergunta.set(formId, avaliadoPerguntaPorSecao(ordenadas))
  }

  // Respostas direcionadas diretamente a este colaborador. Sem a coluna
  // alvo_colaborador_id (migração 20260824), sobram só as do modelo
  // colaborador_unico abaixo.
  const comAlvo = await buscarTodasPaginas<RespostaRow, ErroPostgrest>((de, ate) => supabaseAdmin
    .from('formulario_respostas')
    .select('id, formulario_id, enviado_em, alvo_colaborador_id, formulario_respostas_itens(pergunta_id, valor)')
    .eq('alvo_colaborador_id', colaboradorId)
    .order('enviado_em').order('id')
    .range(de, ate))
  const direcionadas = isSchemaDesatualizado(comAlvo.error) ? [] : comAlvo.data
  // As cópias do histórico são sempre sobre o próprio alvo, então todas as
  // desta pessoa aparecem aqui — e saem das duas listas.
  const copias = new Set(direcionadas.filter(ehCopiaDoHistorico).map((r) => r.id))

  // Respostas do modelo "Selecionar 1 Colaborador": acha os itens que
  // apontam pra este colaborador e busca as respostas correspondentes.
  const perguntasColabUnicoIds = perguntas.filter((p) => p.tipo === 'colaborador_unico').map((p) => p.id)
  const respostasColabUnico: RespostaRow[] = []
  if (perguntasColabUnicoIds.length > 0) {
    const { data: itensMatch } = await buscarTodasPaginas<{ resposta_id: string; pergunta_id: string }>((de, ate) => supabaseAdmin
      .from('formulario_respostas_itens')
      .select('resposta_id, pergunta_id')
      .in('pergunta_id', perguntasColabUnicoIds)
      .eq('valor', colaboradorId)
      .order('resposta_id').order('pergunta_id')
      .range(de, ate))

    // Uma resposta pode ter mais de uma pergunta colaborador_unico batendo
    // com este colaborador (raro, mas possível) — guarda TODAS as que
    // bateram, pra filtrar os itens certos abaixo.
    const matchedPerguntaIdsPorResposta = new Map<string, Set<string>>()
    for (const it of itensMatch) {
      if (copias.has(it.resposta_id)) continue
      const set = matchedPerguntaIdsPorResposta.get(it.resposta_id) || new Set<string>()
      set.add(it.pergunta_id)
      matchedPerguntaIdsPorResposta.set(it.resposta_id, set)
    }
    const respostaIds = Array.from(matchedPerguntaIdsPorResposta.keys())
    for (let i = 0; i < respostaIds.length; i += LOTE_IDS) {
      const { data } = await supabaseAdmin
        .from('formulario_respostas')
        .select('id, formulario_id, enviado_em, formulario_respostas_itens(pergunta_id, valor)')
        .in('id', respostaIds.slice(i, i + LOTE_IDS))
      for (const r of (data || []) as RespostaRow[]) {
        const avaliadoMap = avaliadoPorFormPergunta.get(r.formulario_id) || new Map<string, string>()
        const matchedIds = matchedPerguntaIdsPorResposta.get(r.id) || new Set<string>()
        const itensDaSecaoCerta = (r.formulario_respostas_itens || []).filter((it) =>
          matchedIds.has(avaliadoMap.get(it.pergunta_id) || '')
        )
        respostasColabUnico.push({ ...r, formulario_respostas_itens: itensDaSecaoCerta })
      }
    }
  }

  const vistos = new Set<string>()
  const resultado: RespostaFormularioSobreColaborador[] = []
  for (const r of [...direcionadas, ...respostasColabUnico]) {
    if (vistos.has(r.id) || copias.has(r.id)) continue
    vistos.add(r.id)
    resultado.push(paraSaida(r, formsById, perguntasPorForm))
  }
  return resultado
}

// Mesma leitura acima, mas SEM filtrar por "sobre quem é a resposta" — as
// respostas de TODOS os formulários do sistema. Usado pelo Agente de
// Feedback em modo geral (nenhum colaborador escolhido ainda), pra dar uma
// visão agregada da empresa inteira em vez de uma pessoa específica.
//
// `janela` (datas de envio, ver janelaEnvioDaReferencia) faz o banco devolver
// só o período que o agente vai usar — sem ela, o histórico todo, em páginas.
export async function getRespostasFormulariosGeral(
  supabaseAdmin: any,
  janela?: { desde?: string; ate?: string } | null,
): Promise<RespostaFormularioSobreColaborador[]> {
  const { forms, formsById, formsNpsProjetos, perguntasPorForm, ehCopiaDoHistorico } = await carregarFormulariosEPerguntas(supabaseAdmin)
  if (forms.length === 0) return []

  const buscar = (colunas: string, semCopias: boolean) => buscarTodasPaginas<RespostaRow, ErroPostgrest>((de, ate) => {
    let q = supabaseAdmin.from('formulario_respostas').select(colunas)
    // As cópias do histórico saem já no banco (são ~450 respostas).
    if (semCopias && formsNpsProjetos.size > 0) {
      q = q.or(`alvo_colaborador_id.is.null,formulario_id.not.in.(${Array.from(formsNpsProjetos).join(',')})`)
    }
    if (janela?.desde) q = q.gte('enviado_em', janela.desde)
    if (janela?.ate) q = q.lt('enviado_em', janela.ate)
    return q.order('enviado_em').order('id').range(de, ate)
  })
  let res = await buscar('id, formulario_id, enviado_em, alvo_colaborador_id, formulario_respostas_itens(pergunta_id, valor)', true)
  // Sem a coluna alvo_colaborador_id (migração 20260824) também não há cópias.
  if (isSchemaDesatualizado(res.error)) res = await buscar('id, formulario_id, enviado_em, formulario_respostas_itens(pergunta_id, valor)', false)

  return res.data
    .filter((r) => !ehCopiaDoHistorico(r))
    .map((r) => paraSaida(r, formsById, perguntasPorForm))
}
