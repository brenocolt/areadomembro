import { mesReferenciaFromDate } from './nps-period'

// Calcula, para o mês de referência informado, a nota média do NPS Interno
// (respostas do formulário "Piloto de Elite") recebida por cada colaborador
// — mesma agregação usada na página NPS Interno (média de todos os valores
// de todas as perguntas do tipo "escala", em todas as avaliações daquele
// mês). Usada como uma das duas fontes do NPS do PIPJ, junto com a página
// Performance (avaliacoes_nps).
export async function getNpsInternoMap(supabaseAdmin: any, mes: number, ano: number): Promise<Map<string, number>> {
  const result = new Map<string, number>()

  const { data: forms } = await supabaseAdmin
    .from('formularios')
    .select('id, titulo')
    .or('titulo.ilike.%piloto%,titulo.ilike.%elite%')

  if (!forms || forms.length === 0) return result
  const formId = forms[0].id

  const { data: perguntas } = await supabaseAdmin
    .from('formulario_perguntas')
    .select('id, tipo')
    .eq('formulario_id', formId)

  if (!perguntas) return result

  const avaliadoPergunta = perguntas.find((p: any) => p.tipo === 'colaborador_unico')
  const escalaPerguntaIds = new Set(perguntas.filter((p: any) => p.tipo === 'escala').map((p: any) => p.id))

  if (!avaliadoPergunta || escalaPerguntaIds.size === 0) return result

  const { data: respostas } = await supabaseAdmin
    .from('formulario_respostas')
    .select('id, enviado_em, formulario_respostas_itens(pergunta_id, valor)')
    .eq('formulario_id', formId)

  if (!respostas) return result

  const valsByColab = new Map<string, number[]>()
  for (const r of respostas as any[]) {
    const items = r.formulario_respostas_itens || []
    const avaliadoItem = items.find((it: any) => it.pergunta_id === avaliadoPergunta.id)
    if (!avaliadoItem || !avaliadoItem.valor) continue

    const { mes: mesRef, ano: anoRef } = mesReferenciaFromDate(r.enviado_em)
    if (mesRef !== mes || anoRef !== ano) continue

    const colabId = avaliadoItem.valor
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
