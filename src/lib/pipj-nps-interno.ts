import { mesReferenciaFromDate } from './nps-period'
import { isSchemaDesatualizado } from './db-compat'

// Formulários marcados como fonte do NPS Interno (formularios.nps_interno) —
// ver migração 20260905_formularios_subaba_nome_nps_interno.sql. Vários
// formulários podem estar marcados ao mesmo tempo (um por núcleo, um para
// diretores, um para gerentes etc.) — todos alimentam o mesmo "NPS Interno".
// Enquanto a coluna não existir, cai de volta na heurística antiga por
// título ("contém piloto/elite"), que só encontra UM formulário — era o
// único jeito de achar esse formulário antes de existir um mecanismo
// explícito, e por isso não suporta múltiplos.
export async function getNpsInternoFormIds(supabaseAdmin: any): Promise<string[]> {
  const porMarcador = await supabaseAdmin.from('formularios').select('id').eq('nps_interno', true)
  if (!porMarcador.error) {
    return (porMarcador.data || []).map((f: any) => f.id)
  }
  if (!isSchemaDesatualizado(porMarcador.error)) return []

  const porHeuristica = await supabaseAdmin.from('formularios').select('id').or('titulo.ilike.%piloto%,titulo.ilike.%elite%').limit(1)
  return porHeuristica.data && porHeuristica.data.length > 0 ? [porHeuristica.data[0].id] : []
}

type PerguntaRow = { id: string; formulario_id: string; tipo: string; titulo?: string }
type ItemRow = { pergunta_id: string; valor: string | null }
type RespostaRow = { id: string; formulario_id: string; enviado_em: string; alvo_colaborador_id?: string | null; formulario_respostas_itens?: ItemRow[] }

// Busca perguntas + respostas de TODOS os formulários do NPS Interno de uma
// vez, já resolvendo "sobre quem é cada resposta" das duas formas que
// existem no sistema: formulario_respostas.alvo_colaborador_id (formulários
// direcionados, ver src/lib/forms-publico.ts) e a resposta de uma pergunta
// do tipo colaborador_unico (modelo antigo, ainda usado pelo Piloto de
// Elite) — mesmo raciocínio de FormularioCompetenciasView.
async function carregarRespostasNpsInterno(supabaseAdmin: any): Promise<{ perguntasPorForm: Map<string, PerguntaRow[]>; respostas: RespostaRow[] }> {
  const formIds = await getNpsInternoFormIds(supabaseAdmin)
  if (formIds.length === 0) return { perguntasPorForm: new Map(), respostas: [] }

  const { data: perguntasRows } = await supabaseAdmin
    .from('formulario_perguntas')
    .select('id, formulario_id, tipo, titulo')
    .in('formulario_id', formIds)

  const perguntasPorForm = new Map<string, PerguntaRow[]>()
  for (const p of (perguntasRows || []) as PerguntaRow[]) {
    const arr = perguntasPorForm.get(p.formulario_id) || []
    arr.push(p)
    perguntasPorForm.set(p.formulario_id, arr)
  }

  // `alvo_colaborador_id` só existe a partir da migração 20260824 — sem
  // ela, o PostgREST recusa a leitura inteira e sobram só as respostas do
  // modelo colaborador_unico.
  const comAlvo = await supabaseAdmin
    .from('formulario_respostas')
    .select('id, formulario_id, enviado_em, alvo_colaborador_id, formulario_respostas_itens(pergunta_id, valor)')
    .in('formulario_id', formIds)
  const semAlvo = isSchemaDesatualizado(comAlvo.error)
    ? await supabaseAdmin.from('formulario_respostas').select('id, formulario_id, enviado_em, formulario_respostas_itens(pergunta_id, valor)').in('formulario_id', formIds)
    : null

  const respostas = ((semAlvo ? semAlvo.data : comAlvo.data) || []) as RespostaRow[]
  return { perguntasPorForm, respostas }
}

function resolveAvaliado(r: RespostaRow, formPerguntas: PerguntaRow[]): string | null {
  if (r.alvo_colaborador_id) return r.alvo_colaborador_id
  const avaliadoPergunta = formPerguntas.find(p => p.tipo === 'colaborador_unico')
  if (!avaliadoPergunta) return null
  const items = r.formulario_respostas_itens || []
  const it = items.find(i => i.pergunta_id === avaliadoPergunta.id)
  return it?.valor || null
}

// Calcula, para o mês de referência informado, a nota média do NPS Interno
// (respostas de TODOS os formulários marcados como tal) recebida por cada
// colaborador — mesma agregação usada na página NPS Interno (média de todos
// os valores de todas as perguntas do tipo "escala", em todas as avaliações
// daquele mês, somando as respostas de todos os formulários-fonte). Usada
// como uma das duas fontes do NPS do PIPJ, junto com a página Performance
// (avaliacoes_nps).
export async function getNpsInternoMap(supabaseAdmin: any, mes: number, ano: number): Promise<Map<string, number>> {
  const result = new Map<string, number>()
  const { perguntasPorForm, respostas } = await carregarRespostasNpsInterno(supabaseAdmin)
  if (respostas.length === 0) return result

  const valsByColab = new Map<string, number[]>()
  for (const r of respostas) {
    const formPerguntas = perguntasPorForm.get(r.formulario_id) || []
    const escalaPerguntaIds = new Set(formPerguntas.filter(p => p.tipo === 'escala').map(p => p.id))
    if (escalaPerguntaIds.size === 0) continue

    const colabId = resolveAvaliado(r, formPerguntas)
    if (!colabId) continue

    const { mes: mesRef, ano: anoRef } = mesReferenciaFromDate(r.enviado_em)
    if (mesRef !== mes || anoRef !== ano) continue

    const items = r.formulario_respostas_itens || []
    for (const it of items) {
      if (!escalaPerguntaIds.has(it.pergunta_id)) continue
      const v = Number(it.valor)
      if (isNaN(v)) continue
      const arr = valsByColab.get(colabId) || []
      arr.push(v)
      valsByColab.set(colabId, arr)
    }
  }

  for (const [colabId, vals] of valsByColab.entries()) {
    result.set(colabId, vals.reduce((a, b) => a + b, 0) / vals.length)
  }

  return result
}

export type NpsInternoRespostaSobre = {
  enviado_em: string
  perguntas: PerguntaRow[]
  itens: ItemRow[]
}

// Mesma resolução acima, mas devolvendo as respostas (com suas perguntas)
// sobre UM colaborador específico — usado pelo Assistente Pessoal e pelo
// Agente de Feedback para montar o histórico de NPS Interno de uma pessoa,
// já somando as respostas vindas de todos os formulários-fonte.
export async function getNpsInternoRespostasSobre(supabaseAdmin: any, colaboradorId: string): Promise<NpsInternoRespostaSobre[]> {
  const { perguntasPorForm, respostas } = await carregarRespostasNpsInterno(supabaseAdmin)
  const resultado: NpsInternoRespostaSobre[] = []

  for (const r of respostas) {
    const formPerguntas = perguntasPorForm.get(r.formulario_id) || []
    const avaliado = resolveAvaliado(r, formPerguntas)
    if (avaliado !== colaboradorId) continue

    resultado.push({
      enviado_em: r.enviado_em,
      perguntas: formPerguntas,
      itens: r.formulario_respostas_itens || [],
    })
  }

  return resultado
}
