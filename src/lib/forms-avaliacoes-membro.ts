import { isSchemaDesatualizado } from './db-compat'
import { avaliadoPerguntaPorSecao } from './forms-runtime'

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
    .select('id, formulario_id, tipo, titulo, competencia, ordem')
  const perguntas = (perguntasRows || []) as { id: string; formulario_id: string; tipo: string; titulo?: string | null; competencia?: string | null; ordem?: number }[]
  const perguntasPorForm = new Map<string, typeof perguntas>()
  for (const p of perguntas) {
    const arr = perguntasPorForm.get(p.formulario_id) || []
    arr.push(p)
    perguntasPorForm.set(p.formulario_id, arr)
  }

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
  const comAlvo = await supabaseAdmin
    .from('formulario_respostas')
    .select('id, formulario_id, enviado_em, alvo_colaborador_id, formulario_respostas_itens(pergunta_id, valor)')
    .eq('alvo_colaborador_id', colaboradorId)
  const respostasDirecionadas = isSchemaDesatualizado(comAlvo.error) ? [] : (comAlvo.data || [])

  // Respostas do modelo "Selecionar 1 Colaborador": acha os itens que
  // apontam pra este colaborador e busca as respostas correspondentes.
  const perguntasColabUnicoIds = perguntas.filter((p) => p.tipo === 'colaborador_unico').map((p) => p.id)
  const respostasColabUnico: any[] = []
  if (perguntasColabUnicoIds.length > 0) {
    const { data: itensMatch } = await supabaseAdmin
      .from('formulario_respostas_itens')
      .select('resposta_id, pergunta_id')
      .in('pergunta_id', perguntasColabUnicoIds)
      .eq('valor', colaboradorId)

    // Uma resposta pode ter mais de uma pergunta colaborador_unico batendo
    // com este colaborador (raro, mas possível) — guarda TODAS as que
    // bateram, pra filtrar os itens certos abaixo.
    const matchedPerguntaIdsPorResposta = new Map<string, Set<string>>()
    for (const it of (itensMatch || []) as { resposta_id: string; pergunta_id: string }[]) {
      const set = matchedPerguntaIdsPorResposta.get(it.resposta_id) || new Set<string>()
      set.add(it.pergunta_id)
      matchedPerguntaIdsPorResposta.set(it.resposta_id, set)
    }
    const respostaIds = Array.from(matchedPerguntaIdsPorResposta.keys())
    if (respostaIds.length > 0) {
      const { data } = await supabaseAdmin
        .from('formulario_respostas')
        .select('id, formulario_id, enviado_em, formulario_respostas_itens(pergunta_id, valor)')
        .in('id', respostaIds)
      for (const r of (data || []) as any[]) {
        const avaliadoMap = avaliadoPorFormPergunta.get(r.formulario_id) || new Map<string, string>()
        const matchedIds = matchedPerguntaIdsPorResposta.get(r.id) || new Set<string>()
        const itensDaSecaoCerta = (r.formulario_respostas_itens || []).filter((it: any) =>
          matchedIds.has(avaliadoMap.get(it.pergunta_id) || '')
        )
        respostasColabUnico.push({ ...r, formulario_respostas_itens: itensDaSecaoCerta })
      }
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
