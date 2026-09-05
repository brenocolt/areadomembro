import { isSchemaDesatualizado } from './db-compat'

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
export type RespostaFormularioSobreColaborador = {
  formularioId: string
  formularioTitulo: string
  tipoFormulario: string
  enviado_em: string
  perguntas: { id: string; tipo: string; titulo?: string | null; competencia?: string | null }[]
  itens: { pergunta_id: string; valor: string | null }[]
}

export async function getRespostasFormulariosSobreColaborador(
  supabaseAdmin: any,
  colaboradorId: string,
): Promise<RespostaFormularioSobreColaborador[]> {
  const { data: formsData } = await supabaseAdmin.from('formularios').select('id, titulo, tipo_formulario')
  const forms = (formsData || []) as { id: string; titulo: string; tipo_formulario?: string | null }[]
  if (forms.length === 0) return []
  const formsById = new Map(forms.map((f) => [f.id, f]))

  const { data: perguntasRows } = await supabaseAdmin
    .from('formulario_perguntas')
    .select('id, formulario_id, tipo, titulo, competencia')
  const perguntas = (perguntasRows || []) as { id: string; formulario_id: string; tipo: string; titulo?: string | null; competencia?: string | null }[]
  const perguntasPorForm = new Map<string, typeof perguntas>()
  for (const p of perguntas) {
    const arr = perguntasPorForm.get(p.formulario_id) || []
    arr.push(p)
    perguntasPorForm.set(p.formulario_id, arr)
  }

  // Respostas direcionadas diretamente a este colaborador. Sem a coluna
  // alvo_colaborador_id (migração 20260824), sobram só as do modelo
  // colaborador_unico abaixo.
  const comAlvo = await supabaseAdmin
    .from('formulario_respostas')
    .select('id, formulario_id, enviado_em, alvo_colaborador_id, formulario_respostas_itens(pergunta_id, valor)')
    .eq('alvo_colaborador_id', colaboradorId)
  const respostasDirecionadas = isSchemaDesatualizado(comAlvo.error) ? [] : (comAlvo.data || [])

  // Respostas do modelo "Selecionar 1 Colaborador": acha os itens que
  // apontam pra este colaborador e busca as respostas correspondentes.
  const perguntasColabUnicoIds = perguntas.filter((p) => p.tipo === 'colaborador_unico').map((p) => p.id)
  let respostasColabUnico: any[] = []
  if (perguntasColabUnicoIds.length > 0) {
    const { data: itensMatch } = await supabaseAdmin
      .from('formulario_respostas_itens')
      .select('resposta_id')
      .in('pergunta_id', perguntasColabUnicoIds)
      .eq('valor', colaboradorId)
    const respostaIds = Array.from(new Set((itensMatch || []).map((it: any) => it.resposta_id)))
    if (respostaIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('formulario_respostas')
        .select('id, formulario_id, enviado_em, formulario_respostas_itens(pergunta_id, valor)')
        .in('id', respostaIds)
      respostasColabUnico = data || []
    }
  }

  const vistos = new Set<string>()
  const resultado: RespostaFormularioSobreColaborador[] = []
  for (const r of [...respostasDirecionadas, ...respostasColabUnico]) {
    if (vistos.has(r.id)) continue
    vistos.add(r.id)
    const form = formsById.get(r.formulario_id)
    resultado.push({
      formularioId: r.formulario_id,
      formularioTitulo: form?.titulo || 'Formulário',
      tipoFormulario: form?.tipo_formulario || 'Formulário',
      enviado_em: r.enviado_em,
      perguntas: perguntasPorForm.get(r.formulario_id) || [],
      itens: r.formulario_respostas_itens || [],
    })
  }
  return resultado
}
