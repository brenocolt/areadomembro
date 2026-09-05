"use client"
import { useState, useEffect, useMemo } from "react"
import { supabase } from "@/lib/supabase"
import { useColaborador } from "@/hooks/use-supabase"
import { FileQuestion, CheckCircle2, Clock, Send, ArrowRight, Loader2, Lock, Pencil } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { colaboradorNoPublico, resolveAlvos, type PublicoPar } from "@/lib/forms-publico"
import { isSchemaDesatualizado } from "@/lib/db-compat"
import { buildSections, computeNext, validateSection, buildRespostaItens } from "@/lib/forms-runtime"
import { PerguntaInput } from "@/components/forms/pergunta-input"

// Chave usada no mapa de respostas/navegação por alvo quando o formulário
// NÃO é direcionado (Quem Recebe = Ninguém) — a resposta é sobre o próprio
// respondente.
const SELF_KEY = '__self__'

export default function FormulariosPage() {
    const { colaborador, loading: loadingColaborador } = useColaborador()
    const [forms, setForms] = useState<any[]>([])
    // Respostas do respondente atual neste mês — inclui alvo_colaborador_id
    // para dar suporte a formulários direcionados (ver targetsByForm abaixo).
    const [respostasFeitas, setRespostasFeitas] = useState<any[]>([])
    // Todas as respostas do respondente atual, sem filtro de mês — usada só
    // para formulários com modo_resposta 'unica'/'unica_editavel', cuja
    // restrição vale para sempre (não "reseta" todo mês como o padrão
    // 'multipla' faz com respostasFeitas). Ver fonteRespostas/modoDoForm.
    const [respostasTotais, setRespostasTotais] = useState<any[]>([])
    // Resposta anterior (id) de cada alvo/self já respondido em formulário
    // 'unica_editavel' — reenviar atualiza essa resposta em vez de criar uma
    // nova. Preenchido ao abrir o formulário (ver openForm).
    const [respostaIdPorAlvo, setRespostaIdPorAlvo] = useState<Record<string, string>>({})
    // Abas/self travados porque o formulário é 'unica' e já foi respondido —
    // não é possível reenviar.
    const [bloqueadosPorAlvo, setBloqueadosPorAlvo] = useState<Set<string>>(new Set())
    const [activeFormId, setActiveFormId] = useState<string | null>(null)
    const [perguntas, setPerguntas] = useState<any[]>([])

    // Público do formulário aberto (ver src/lib/forms-publico.ts). `targets`
    // null = formulário comum, sem direcionamento; array = uma aba de
    // preenchimento por pessoa (pode ter zero pessoas só transitoriamente,
    // entre o fechamento de uma aba e o fetch seguinte — a lista de
    // formulários já esconde formulários com pool vazio).
    const [targets, setTargets] = useState<{ id: string, nome: string }[] | null>(null)
    const [activeAlvoId, setActiveAlvoId] = useState<string | null>(null)
    const [enviadosPorAlvo, setEnviadosPorAlvo] = useState<Set<string>>(new Set())
    // Formulário -> lista de alvos elegíveis para o colaborador atual,
    // calculada uma vez no fetchData (evita recalcular a cada render/abertura).
    const [targetsByForm, setTargetsByForm] = useState<Map<string, { id: string, nome: string }[]>>(new Map())

    // Respostas/navegação são guardadas POR ALVO (SELF_KEY quando não há
    // direcionamento), para que cada aba seja preenchida e navegada de forma
    // independente. `respostas`/`sectionIndex`/`sectionHistory` abaixo são
    // apenas a "fatia" do alvo ativo — todo o resto do componente continua
    // lendo/escrevendo neles exatamente como antes.
    const [respostasPorAlvo, setRespostasPorAlvo] = useState<Record<string, Record<string, any>>>({})
    const [sectionIndexPorAlvo, setSectionIndexPorAlvo] = useState<Record<string, number>>({})
    const [sectionHistoryPorAlvo, setSectionHistoryPorAlvo] = useState<Record<string, number[]>>({})

    const currentAlvoKey = targets ? (activeAlvoId || SELF_KEY) : SELF_KEY
    const respostas = respostasPorAlvo[currentAlvoKey] || {}
    const setRespostas = (updated: Record<string, any>) => {
        setRespostasPorAlvo(prev => ({ ...prev, [currentAlvoKey]: updated }))
    }
    const sectionIndex = sectionIndexPorAlvo[currentAlvoKey] ?? 0
    const setSectionIndex = (idx: number) => {
        setSectionIndexPorAlvo(prev => ({ ...prev, [currentAlvoKey]: idx }))
    }
    const sectionHistory = sectionHistoryPorAlvo[currentAlvoKey] || []
    const setSectionHistory = (updater: (h: number[]) => number[]) => {
        setSectionHistoryPorAlvo(prev => ({ ...prev, [currentAlvoKey]: updater(prev[currentAlvoKey] || []) }))
    }

    const [submitting, setSubmitting] = useState(false)
    const [colaboradores, setColaboradores] = useState<any[]>([])
    // Projetos ativos — só usado pela pergunta do tipo "selecionar_projeto"
    // (ex.: NPS Projetos).
    const [projetos, setProjetos] = useState<{ id: string, nome: string }[]>([])

    const fetchData = async () => {
        await supabase
            .from('formularios')
            .update({ status: 'encerrado' })
            .eq('status', 'ativo')
            .lt('data_prazo', new Date().toISOString())
            .not('data_prazo', 'is', null)

        const { data: formsData, error: formsError } = await supabase
            .from('formularios')
            .select('*')
            .eq('status', 'ativo')
            .order('created_at', { ascending: false })
        if (formsError) {
            console.error('Erro ao carregar formulários ativos:', formsError)
            toast.error('Erro ao carregar os formulários: ' + formsError.message)
        }

        // Colaboradores com cargo/núcleo — usado tanto para as perguntas do
        // tipo "Selecionar Colaborador" quanto para resolver o público de
        // formulários direcionados (ver src/lib/forms-publico.ts).
        const { data: cData } = await supabase.from('colaboradores').select('id, nome, cargo_atual, nucleo_atual')
        const colaboradoresFull = cData || []
        setColaboradores(colaboradoresFull)

        const { data: pData } = await supabase.from('projetos').select('id, nome').eq('status', 'Ativo').order('nome')
        setProjetos(pData || [])

        let visibleForms = formsData || []
        const newTargetsByForm = new Map<string, { id: string, nome: string }[]>()

        if (visibleForms.length > 0 && colaborador) {
          // Se a resolução de público falhar (ex.: migração pendente), o
          // formulário deve continuar aparecendo como um formulário comum.
          // Esconder tudo por causa de um erro de leitura seria pior do que
          // mostrar um formulário sem direcionamento.
          try {
            const formIds = visibleForms.map(f => f.id)
            const [{ data: respondeRows, error: erroResponde }, { data: recebeRows, error: erroRecebe }] = await Promise.all([
                supabase.from('formulario_publico_responde').select('formulario_id, cargo, nucleo').in('formulario_id', formIds),
                supabase.from('formulario_publico_recebe').select('formulario_id, cargo, nucleo').in('formulario_id', formIds),
            ])
            if (erroResponde || erroRecebe) {
                throw new Error((erroResponde || erroRecebe)!.message)
            }

            const groupByForm = (rows: any[] | null) => {
                const map = new Map<string, PublicoPar[]>()
                for (const r of rows || []) {
                    const arr = map.get(r.formulario_id) || []
                    arr.push({ cargo: r.cargo, nucleo: r.nucleo })
                    map.set(r.formulario_id, arr)
                }
                return map
            }
            const respondeByForm = groupByForm(respondeRows)
            const recebeByForm = groupByForm(recebeRows)

            visibleForms = visibleForms.filter(f => {
                // "Quem Responde": só aparece pra quem bate com o público
                // (lista vazia = Todos, comportamento de sempre).
                if (!colaboradorNoPublico(colaborador, respondeByForm.get(f.id) || [])) return false

                // "Quem Recebe": formulário direcionado — se não sobrar
                // ninguém pra avaliar (pool vazio após excluir o próprio
                // respondente), não há o que preencher, então esconde.
                const recebe = recebeByForm.get(f.id) || []
                if (recebe.length > 0) {
                    const alvos = resolveAlvos(colaboradoresFull, recebe, colaborador.id)
                    if (alvos.length === 0) return false
                    newTargetsByForm.set(f.id, alvos
                        .map(a => ({ id: a.id, nome: a.nome }))
                        .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')))
                }
                return true
            })
          } catch (err) {
            console.error('Erro ao resolver o público dos formulários — exibindo todos sem direcionamento:', err)
          }
        }

        setForms(visibleForms)
        setTargetsByForm(newTargetsByForm)

        if (colaborador?.id) {
            const now = new Date()
            const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
            const lastDayOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString()

            // Busca apenas respostas do mês atual — respostas de meses anteriores
            // não devem marcar o formulário como "já respondido" no novo mês.
            const respostasQuery = (colunas: string) => supabase
                .from('formulario_respostas')
                .select(colunas)
                .eq('colaborador_id', colaborador.id)
                .gte('enviado_em', firstDayOfMonth)
                .lte('enviado_em', lastDayOfMonth)
                .order('enviado_em', { ascending: false })

            // Sem a coluna alvo_colaborador_id (migração 20260824) a leitura
            // inteira seria recusada e nenhum formulário apareceria como já
            // respondido. Sem ela, resta o comportamento antigo: uma resposta
            // por formulário, sem alvo.
            const respostasComAlvo = await respostasQuery('formulario_id, enviado_em, alvo_colaborador_id')
            const rData = isSchemaDesatualizado(respostasComAlvo.error)
                ? (await respostasQuery('formulario_id, enviado_em')).data
                : respostasComAlvo.data
            if (rData) setRespostasFeitas(rData as unknown[])

            // Mesma busca, mas sem filtro de mês — só usada por formulários
            // 'unica'/'unica_editavel' (ver fonteRespostas), cuja restrição
            // não é mensal.
            const respostasTotaisQuery = (colunas: string) => supabase
                .from('formulario_respostas')
                .select(colunas)
                .eq('colaborador_id', colaborador.id)
                .order('enviado_em', { ascending: false })
            const respostasTotaisComAlvo = await respostasTotaisQuery('id, formulario_id, enviado_em, alvo_colaborador_id')
            const rtData = isSchemaDesatualizado(respostasTotaisComAlvo.error)
                ? (await respostasTotaisQuery('id, formulario_id, enviado_em')).data
                : respostasTotaisComAlvo.data
            if (rtData) setRespostasTotais(rtData as unknown[])
        }
    }

    useEffect(() => {
        // Só busca depois que o colaborador logado foi resolvido. Rodar antes
        // disso dispararia um fetchData sem `colaborador`, que pula todo o
        // filtro de público — e, como as duas chamadas são assíncronas, a
        // resposta sem filtro podia chegar por último e sobrescrever a
        // correta, deixando um formulário direcionado sem nenhuma aba.
        if (loadingColaborador) return
        fetchData()
    }, [loadingColaborador, colaborador?.id])

    // Modo de resposta do formulário — ver
    // supabase/migrations/20260908_formularios_modo_resposta.sql. Ausente
    // (migração pendente) ou qualquer valor desconhecido cai no padrão de
    // sempre: múltiplas respostas, sem limite.
    const modoDoForm = (formId: string): 'unica' | 'unica_editavel' | 'multipla' => {
        const modo = forms.find(f => f.id === formId)?.modo_resposta
        return modo === 'unica' || modo === 'unica_editavel' ? modo : 'multipla'
    }
    // 'multipla' usa a janela do mês atual (respostasFeitas) — comportamento
    // de sempre. 'unica'/'unica_editavel' usam o histórico completo
    // (respostasTotais): a restrição vale para sempre, não só neste mês.
    const fonteRespostas = (formId: string) => modoDoForm(formId) === 'multipla' ? respostasFeitas : respostasTotais

    const getLastResponseDate = (formId: string) => {
        const resp = fonteRespostas(formId).find(r => r.formulario_id === formId)
        return resp ? new Date(resp.enviado_em) : null
    }

    // Formulário direcionado só conta como "respondido" quando TODOS os
    // alvos atuais têm pelo menos uma resposta na fonte relevante — se um
    // novo alvo entrar no público depois, o formulário volta a ficar
    // pendente mesmo que os alvos antigos já tenham sido respondidos.
    const hasResponded = (formId: string) => {
        const fonte = fonteRespostas(formId)
        const alvos = targetsByForm.get(formId)
        if (!alvos) return fonte.some(r => r.formulario_id === formId)
        if (alvos.length === 0) return false
        const respondidos = new Set(fonte.filter(r => r.formulario_id === formId).map(r => r.alvo_colaborador_id))
        return alvos.every(a => respondidos.has(a.id))
    }
    const responseCount = (formId: string) => fonteRespostas(formId).filter(r => r.formulario_id === formId).length
    // Progresso de um formulário direcionado (null = não é direcionado).
    const alvosStatus = (formId: string): { total: number, respondidos: number } | null => {
        const alvos = targetsByForm.get(formId)
        if (!alvos) return null
        const respondidos = new Set(fonteRespostas(formId).filter(r => r.formulario_id === formId).map(r => r.alvo_colaborador_id))
        return { total: alvos.length, respondidos: alvos.filter(a => respondidos.has(a.id)).length }
    }

    const openForm = async (formId: string) => {
        setActiveFormId(formId)
        // Só perguntas ativas — uma pergunta arquivada (removida numa
        // edição do formulário, ver 20260909_formulario_perguntas_ativa.sql)
        // não deve mais aparecer pra responder, mesmo que o histórico de
        // respostas antigas dela continue preservado.
        const comAtiva = await supabase.from('formulario_perguntas').select('*').eq('formulario_id', formId).eq('ativa', true).order('ordem')
        const { data } = isSchemaDesatualizado(comAtiva.error)
            ? await supabase.from('formulario_perguntas').select('*').eq('formulario_id', formId).order('ordem')
            : comAtiva
        if (data) setPerguntas(data)

        const alvosDoForm = targetsByForm.get(formId) || null
        setTargets(alvosDoForm)

        // Estado de preenchimento limpo a cada abertura.
        setRespostasPorAlvo({})
        setSectionIndexPorAlvo({})
        setSectionHistoryPorAlvo({})
        setRespostaIdPorAlvo({})
        setBloqueadosPorAlvo(new Set())

        const modo = modoDoForm(formId)
        const respostasDoForm = fonteRespostas(formId).filter(r => r.formulario_id === formId)

        // Abas/self já respondidas (na fonte certa pro modo — ver
        // fonteRespostas) começam marcadas — em modo 'multipla' a pessoa pode
        // reabri-las e responder de novo se quiser.
        const jaRespondidoKeys = new Set(respostasDoForm.map(r => r.alvo_colaborador_id || SELF_KEY))
        setEnviadosPorAlvo(jaRespondidoKeys)

        if (modo === 'unica') {
            // Resposta única: quem já respondeu fica travado, sem reenviar.
            setBloqueadosPorAlvo(jaRespondidoKeys)
        }

        if (modo === 'unica_editavel' && respostasDoForm.length > 0) {
            // Carrega a resposta mais recente de cada alvo/self já
            // respondido para pré-preencher o formulário — reenviar edita a
            // mesma resposta em vez de criar uma nova.
            const maisRecentePorAlvo = new Map<string, any>()
            for (const r of respostasDoForm) {
                const key = r.alvo_colaborador_id || SELF_KEY
                const atual = maisRecentePorAlvo.get(key)
                if (!atual || new Date(r.enviado_em) > new Date(atual.enviado_em)) maisRecentePorAlvo.set(key, r)
            }
            const idsRespostas = Array.from(maisRecentePorAlvo.values()).map(r => r.id).filter(Boolean)
            const tipoPorPergunta = new Map<string, string>((data || []).map((p: any) => [p.id, p.tipo]))
            let itensData: any[] = []
            if (idsRespostas.length > 0) {
                const { data: itensResult } = await supabase.from('formulario_respostas_itens').select('resposta_id, pergunta_id, valor, valores').in('resposta_id', idsRespostas)
                itensData = itensResult || []
            }

            const novosRespostaId: Record<string, string> = {}
            const novasRespostasPorAlvo: Record<string, Record<string, any>> = {}
            for (const [key, r] of maisRecentePorAlvo.entries()) {
                if (!r.id) continue
                novosRespostaId[key] = r.id
                const itens = (itensData || []).filter((it: any) => it.resposta_id === r.id)
                const valores: Record<string, any> = {}
                for (const it of itens) {
                    const tipo = tipoPorPergunta.get(it.pergunta_id)
                    if (tipo === 'grade_multipla_escolha') {
                        try { valores[it.pergunta_id] = it.valor ? JSON.parse(it.valor) : {} } catch { valores[it.pergunta_id] = {} }
                    } else if (Array.isArray(it.valores) && it.valores.length > 0) {
                        valores[it.pergunta_id] = it.valores
                    } else {
                        valores[it.pergunta_id] = it.valor
                    }
                }
                novasRespostasPorAlvo[key] = valores
            }
            setRespostaIdPorAlvo(novosRespostaId)
            setRespostasPorAlvo(novasRespostasPorAlvo)
        }

        // Abre já na primeira aba ainda não travada (em 'unica', pula direto
        // pras que faltam responder; nos outros modos não faz diferença).
        setActiveAlvoId(alvosDoForm && alvosDoForm.length > 0
            ? (alvosDoForm.find(a => !jaRespondidoKeys.has(a.id) || modo !== 'unica') || alvosDoForm[0]).id
            : null)
    }

    // Seções derivadas da lista linear de perguntas (ver buildSections) e a
    // numeração absoluta de cada pergunta real, calculada sobre a ordem
    // completa do formulário — assim o número de uma pergunta não muda
    // conforme o caminho percorrido pela lógica condicional.
    const sections = useMemo(() => buildSections(perguntas), [perguntas])
    const questionNumbers = useMemo(() => {
        const map = new Map<string, number>()
        let n = 0
        for (const p of perguntas) {
            if (p.tipo === 'titulo' || p.tipo === 'secao') continue
            n++
            map.set(p.id, n)
        }
        return map
    }, [perguntas])

    const handleNext = async () => {
        const section = sections[sectionIndex]
        if (!section) return
        const error = validateSection(section, respostas)
        if (error) {
            toast.error(error)
            return
        }
        const next = computeNext(sections, sectionIndex, respostas)
        if (next.type === 'submit') {
            await submitAnswers()
        } else {
            setSectionHistory(h => [...h, sectionIndex])
            setSectionIndex(next.index)
        }
    }

    const handleBack = () => {
        if (sectionHistory.length === 0) {
            setActiveFormId(null)
            return
        }
        const prev = sectionHistory[sectionHistory.length - 1]
        setSectionHistory(h => h.slice(0, -1))
        setSectionIndex(prev)
    }

    const submitAnswers = async () => {
        if (!colaborador?.id || !activeFormId) return

        // Só envia respostas das seções realmente visitadas neste percurso —
        // perguntas de seções puladas pela lógica condicional (ou respostas
        // "órfãs" de uma navegação anterior por outro caminho) não entram.
        const visitedIndices = new Set([...sectionHistory, sectionIndex])
        const visitedPerguntaIds = new Set(
            sections.filter((_, i) => visitedIndices.has(i)).flatMap(s => s.perguntas.map((p: any) => p.id))
        )
        const realPerguntas = perguntas.filter(p => p.tipo !== 'titulo' && p.tipo !== 'secao' && visitedPerguntaIds.has(p.id))

        for (const p of realPerguntas) {
            if (p.obrigatoria) {
                if (p.tipo === 'grade_multipla_escolha') {
                    const linhas: string[] = p.opcoes?.linhas || []
                    const respostaGrade = respostas[p.id] || {}
                    const allAnswered = linhas.every((l: string) => respostaGrade[l])
                    if (!allAnswered) {
                        toast.error(`Pergunta obrigatória não respondida: "${p.titulo}" — responda todas as linhas`)
                        return
                    }
                } else {
                    const val = respostas[p.id]
                    if (!val || (typeof val === 'string' && val.trim() === '') || (Array.isArray(val) && val.length === 0)) {
                        toast.error(`Pergunta obrigatória não respondida: "${p.titulo}"`)
                        return
                    }
                }
            }
        }

        // Em formulário direcionado, cada envio é sobre a aba (alvo) ativa.
        const alvoId = targets ? activeAlvoId : null
        const alvoKey = alvoId || SELF_KEY
        const modo = modoDoForm(activeFormId)

        if (modo === 'unica' && bloqueadosPorAlvo.has(alvoKey)) {
            toast.error(targets
                ? `Este formulário só pode ser respondido uma vez, e você já enviou sua resposta sobre ${targets.find(t => t.id === alvoId)?.nome || 'esta pessoa'}.`
                : "Este formulário só pode ser respondido uma vez, e você já enviou sua resposta.")
            return
        }

        setSubmitting(true)

        // 'unica_editavel' com resposta anterior: edita a mesma resposta (só
        // troca os itens) em vez de criar uma nova.
        const respostaExistenteId = modo === 'unica_editavel' ? respostaIdPorAlvo[alvoKey] : undefined

        let respData: { id: string } | null = null
        if (respostaExistenteId) {
            const { error: updError } = await supabase
                .from('formulario_respostas')
                .update({ enviado_em: new Date().toISOString() })
                .eq('id', respostaExistenteId)
            if (updError) {
                toast.error("Erro ao atualizar sua resposta.")
                setSubmitting(false)
                return
            }
            await supabase.from('formulario_respostas_itens').delete().eq('resposta_id', respostaExistenteId)
            respData = { id: respostaExistenteId }
        } else {
            const { data: inserted, error } = await supabase.from('formulario_respostas').insert({
                formulario_id: activeFormId,
                colaborador_id: colaborador.id,
                alvo_colaborador_id: alvoId,
            }).select().single()

            if (error || !inserted) {
                toast.error("Erro ao enviar respostas.")
                setSubmitting(false)
                return
            }
            respData = inserted
        }

        if (!respData) {
            toast.error("Erro ao enviar respostas.")
            setSubmitting(false)
            return
        }

        // Perguntas marcadas como "Não avaliar" ficam de fora — a pessoa
        // declarou não ter insumo, então a nota não deve existir nem entrar
        // em nenhuma média.
        const items = buildRespostaItens(respData.id, realPerguntas, respostas)

        if (items.length === 0) {
            // Numa edição, a resposta já existia antes desta tentativa — só
            // apaga a resposta inteira quando ela acabou de ser criada agora.
            if (!respostaExistenteId) await supabase.from('formulario_respostas').delete().eq('id', respData.id)
            toast.error('Não foi possível salvar suas respostas. Responda ao menos uma pergunta (respostas marcadas como "Não avaliar" não são gravadas).')
            setSubmitting(false)
            return
        }

        const { error: itemsError } = await supabase.from('formulario_respostas_itens').insert(items)
        if (itemsError) {
            if (!respostaExistenteId) await supabase.from('formulario_respostas').delete().eq('id', respData.id)
            console.error('Erro ao salvar itens da resposta:', itemsError)
            toast.error('Erro ao salvar suas respostas: ' + itemsError.message)
            setSubmitting(false)
            return
        }

        setSubmitting(false)

        if (modo === 'unica') {
            setBloqueadosPorAlvo(prev => new Set(prev).add(alvoKey))
        }

        // Formulário direcionado: marca esta aba como enviada. Se sobrar
        // alguma aba pendente, avança pra ela e mantém o formulário aberto —
        // só fecha (e conta como concluído) quando todas as abas tiverem
        // sido enviadas nesta sessão.
        if (targets && alvoId) {
            const nomeAlvo = targets.find(t => t.id === alvoId)?.nome || ''
            const novosEnviados = new Set(enviadosPorAlvo)
            novosEnviados.add(alvoId)
            setEnviadosPorAlvo(novosEnviados)

            const proximo = targets.find(t => !novosEnviados.has(t.id))
            if (proximo) {
                toast.success(`Resposta sobre ${nomeAlvo} enviada!`)
                setActiveAlvoId(proximo.id)
                return
            }
            toast.success("Todas as respostas foram enviadas! 🎉")
        } else {
            toast.success("Respostas enviadas com sucesso! 🎉")
        }

        const submittedForm = forms.find(f => f.id === activeFormId)
        setActiveFormId(null)
        await fetchData()

        if (submittedForm?.pagina_destino) {
            let url = submittedForm.pagina_destino
            if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('/')) {
                url = 'https://' + url
            }
            window.location.href = url
        }
    }

    const pendentes = forms.filter(f => !hasResponded(f.id))
    const jaRespondidos = forms.filter(f => hasResponded(f.id))

    if (activeFormId) {
        const form = forms.find(f => f.id === activeFormId)
        const modoAtivo = modoDoForm(activeFormId)
        const alvoKeyAtivo = targets ? (activeAlvoId || SELF_KEY) : SELF_KEY
        const bloqueadoAtivo = bloqueadosPorAlvo.has(alvoKeyAtivo)
        const editandoAtivo = modoAtivo === 'unica_editavel' && !!respostaIdPorAlvo[alvoKeyAtivo]
        const prevCount = responseCount(activeFormId)
        const currentSection = sections[sectionIndex] || sections[0]
        const nextIsSubmit = computeNext(sections, sectionIndex, respostas).type === 'submit'

        return (
            <div className="flex flex-col gap-6 pb-8 max-w-2xl mx-auto">
                <div className="bg-white dark:bg-[#0F172A] rounded-3xl border border-slate-100 dark:border-slate-800/50 shadow-sm overflow-hidden">
                    {form?.banner_url && (
                        <img src={form.banner_url} className="w-full h-40 object-cover rounded-2xl mb-6" alt="" />
                    )}
                    <div className="p-8">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="bg-violet-50 dark:bg-violet-500/10 p-2 rounded-xl">
                                <FileQuestion className="h-5 w-5 text-violet-600 dark:text-violet-400" />
                            </div>
                            <h1 className="text-xl font-bold text-slate-900 dark:text-white">{form?.titulo}</h1>
                        </div>
                        {form?.descricao && (
                            <p className="text-sm text-slate-500 ml-12 mb-2 whitespace-normal break-words" dangerouslySetInnerHTML={{ __html: form.descricao }}></p>
                        )}

                        {targets && targets.length > 0 && (
                            <div className="ml-12 mb-4">
                                <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mb-2">
                                    Responda sobre cada pessoa abaixo:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {targets.map(t => {
                                        const done = enviadosPorAlvo.has(t.id)
                                        const bloqueado = bloqueadosPorAlvo.has(t.id)
                                        const active = t.id === activeAlvoId
                                        return (
                                            <button
                                                key={t.id}
                                                type="button"
                                                disabled={bloqueado}
                                                title={bloqueado ? `Este formulário só pode ser respondido uma vez — resposta sobre ${t.nome} já enviada.` : undefined}
                                                onClick={() => { if (!bloqueado) setActiveAlvoId(t.id) }}
                                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                                                    active
                                                        ? 'bg-violet-600 text-white shadow-sm shadow-violet-500/20'
                                                        : bloqueado
                                                        ? 'bg-slate-100/70 dark:bg-slate-800/50 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                                        : done
                                                        ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-violet-50 dark:hover:bg-violet-500/10'
                                                }`}
                                            >
                                                {bloqueado ? <Lock className="h-3.5 w-3.5" /> : done && <CheckCircle2 className="h-3.5 w-3.5" />}
                                                {t.nome}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                        )}

                        {!targets && modoAtivo === 'multipla' && prevCount > 0 && (
                            <div className="ml-12 mb-4">
                                <Badge className="bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400 text-[10px] font-bold border-none">
                                    Você já respondeu {prevCount}x — esta será uma nova resposta
                                </Badge>
                            </div>
                        )}

                        {!targets && modoAtivo === 'unica_editavel' && !!respostaIdPorAlvo[SELF_KEY] && (
                            <div className="ml-12 mb-4">
                                <Badge className="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 text-[10px] font-bold border-none flex items-center gap-1 w-fit">
                                    <Pencil className="h-3 w-3" /> Você já respondeu — isto vai corrigir sua resposta anterior
                                </Badge>
                            </div>
                        )}

                        {sections.length > 1 && (
                            <div className="ml-12 mb-2">
                                <Badge className="bg-slate-50 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-bold border-none">
                                    Seção {sectionIndex + 1} de {sections.length}
                                </Badge>
                            </div>
                        )}

                        {(currentSection.titulo || currentSection.descricao) && (
                            <div className="mb-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                                {currentSection.titulo && (
                                    <h2 className="text-lg font-bold text-slate-900 dark:text-white">{currentSection.titulo}</h2>
                                )}
                                {currentSection.descricao && (
                                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{currentSection.descricao}</p>
                                )}
                            </div>
                        )}

                        <div className="space-y-6 mt-6">
                            {currentSection.perguntas.map((p) => (
                                <PerguntaInput
                                    key={p.id}
                                    pergunta={p}
                                    valor={respostas[p.id]}
                                    onChange={(v) => setRespostas({ ...respostas, [p.id]: v })}
                                    colaboradores={colaboradores}
                                    projetos={projetos}
                                    selfId={colaborador?.id}
                                    numero={questionNumbers.get(p.id) || 0}
                                />
                            ))}
                        </div>

                        <div className="flex justify-between items-center mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
                            <Button variant="ghost" onClick={handleBack} className="rounded-xl font-bold text-slate-500">
                                ← Voltar
                            </Button>
                            <Button
                                onClick={handleNext}
                                disabled={submitting || (nextIsSubmit && bloqueadoAtivo)}
                                title={nextIsSubmit && bloqueadoAtivo ? 'Este formulário só pode ser respondido uma vez — resposta já enviada.' : undefined}
                                className="rounded-xl font-bold h-11 px-8 bg-violet-600 hover:bg-violet-700 text-white shadow-lg shadow-violet-500/20"
                            >
                                {submitting
                                    ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                    : nextIsSubmit && bloqueadoAtivo
                                    ? <Lock className="h-4 w-4 mr-2" />
                                    : (nextIsSubmit ? <Send className="h-4 w-4 mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />)}
                                {submitting
                                    ? 'Enviando...'
                                    : nextIsSubmit && bloqueadoAtivo
                                    ? 'Já respondido'
                                    : nextIsSubmit
                                    ? (targets
                                        ? `${editandoAtivo ? 'Corrigir' : 'Enviar'} sobre ${targets.find(t => t.id === activeAlvoId)?.nome || ''}`
                                        : (editandoAtivo ? 'Corrigir Respostas' : 'Enviar Respostas'))
                                    : 'Próxima Seção'}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col gap-8 pb-8">
            <div className="flex items-center gap-3">
                <div className="bg-violet-50 dark:bg-violet-500/10 p-2.5 rounded-2xl border border-violet-100 dark:border-violet-500/20">
                    <FileQuestion className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Formulários</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Responda os formulários disponíveis para você.</p>
                </div>
            </div>

            {pendentes.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Clock className="h-5 w-5 text-amber-500" /> Pendentes
                    </h2>
                    <div className="grid gap-3">
                        {pendentes.map(form => {
                            const status = alvosStatus(form.id)
                            return (
                            <div
                                key={form.id}
                                onClick={() => openForm(form.id)}
                                className="bg-white dark:bg-[#0F172A] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 shadow-sm cursor-pointer hover:border-violet-300 dark:hover:border-violet-600 transition-all group"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2 bg-amber-50 dark:bg-amber-500/10 rounded-xl">
                                            <FileQuestion className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-900 dark:text-white">{form.titulo}</h3>
                                            {form.descricao && <p className="text-sm text-slate-500 mt-0.5 whitespace-normal break-words line-clamp-2" dangerouslySetInnerHTML={{ __html: form.descricao }}></p>}
                                            <div className="flex items-center gap-3 mt-1">
                                                {status && (
                                                    <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                                        {status.respondidos}/{status.total} pessoas avaliadas
                                                    </span>
                                                )}
                                                {form.data_prazo && (
                                                    <p className="text-xs text-slate-400">
                                                        Prazo: {new Date(form.data_prazo).toLocaleDateString('pt-BR')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-violet-500 transition-colors" />
                                </div>
                            </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {jaRespondidos.length > 0 && (
                <div className="space-y-3">
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Já Respondidos
                    </h2>
                    <div className="grid gap-3">
                        {jaRespondidos.map(form => {
                            const lastDate = getLastResponseDate(form.id)
                            const count = responseCount(form.id)
                            const status = alvosStatus(form.id)
                            const modo = modoDoForm(form.id)
                            // Formulário 'unica' sem direcionamento (self):
                            // fica travado de vez, não há o que reabrir.
                            const travadoParaSempre = modo === 'unica' && !targetsByForm.has(form.id)
                            return (
                                <div
                                    key={form.id}
                                    onClick={() => {
                                        if (travadoParaSempre) {
                                            toast.info('Este formulário só pode ser respondido uma vez, e você já enviou sua resposta.')
                                            return
                                        }
                                        openForm(form.id)
                                    }}
                                    className={`bg-white dark:bg-[#0F172A] rounded-2xl p-5 border border-slate-100 dark:border-slate-800/50 shadow-sm transition-all group ${
                                        travadoParaSempre ? 'opacity-70 cursor-default' : 'cursor-pointer hover:border-violet-300 dark:hover:border-violet-600'
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 bg-emerald-50 dark:bg-emerald-500/10 rounded-xl">
                                                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-900 dark:text-white">{form.titulo}</h3>
                                                <div className="flex items-center gap-3 mt-0.5">
                                                    <p className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                                                        {status ? `✓ ${status.respondidos}/${status.total} pessoas avaliadas` : `✓ Respondido ${count}x`}
                                                    </p>
                                                    {lastDate && (
                                                        <span className="text-xs text-slate-400">
                                                            Última: {lastDate.toLocaleDateString('pt-BR')} às {lastDate.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    )}
                                                </div>
                                                {form.data_prazo && (
                                                    <p className="text-xs text-slate-400 mt-1">
                                                        Prazo: {new Date(form.data_prazo).toLocaleDateString('pt-BR')}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {modo === 'unica' ? (
                                                <Badge className="bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 text-[10px] font-bold border-none flex items-center gap-1">
                                                    <Lock className="h-3 w-3" /> Resposta única enviada
                                                </Badge>
                                            ) : modo === 'unica_editavel' ? (
                                                <Badge className="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 text-[10px] font-bold border-none flex items-center gap-1">
                                                    <Pencil className="h-3 w-3" /> Corrigir resposta
                                                </Badge>
                                            ) : (
                                                <Badge className="bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 text-[10px] font-bold border-none">
                                                    Responder novamente
                                                </Badge>
                                            )}
                                            {!travadoParaSempre && <ArrowRight className="h-5 w-5 text-slate-300 group-hover:text-violet-500 transition-colors" />}
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            )}

            {forms.length === 0 && (
                <div className="bg-white dark:bg-[#0F172A] rounded-3xl p-12 border border-slate-100 dark:border-slate-800/50 shadow-sm text-center">
                    <FileQuestion className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                    <p className="text-lg font-bold text-slate-400">Nenhum formulário adicional disponível</p>
                    <p className="text-sm text-slate-400 mt-1">Quando houver formulários ativos, eles aparecerão aqui.</p>
                </div>
            )}
        </div>
    )
}
