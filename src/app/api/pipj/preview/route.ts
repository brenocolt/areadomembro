import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { CARGO_FANTASMA } from '@/lib/cargos'
import { getNpsInternoMap } from '@/lib/pipj-nps-interno'

// Business Rules Constants
const FIXED_VALUES: Record<string, number> = {
  'Consultor': 100,
  'Assessor': 100,
  'SDR': 100,
  'Closer': 150,
  'Diretor': 250,
  'Gerente de Projetos': 150,
  'Gerente de Inovação': 150,
  'Gerente de Operações': 150,
  'Gerente de CS': 150,
  'Gerente de Gente': 150,
  'Gerente Institucional': 150,
}

const VARIABLE_PER_PROJECT: Record<string, number> = {
  'Consultor': 15,
  'Assessor': 15,
  'SDR': 15,
  // Gerente de Projetos ganha um adicional por projeto menor que os demais
  // cargos de gerência — os outros seguem a mesma taxa de Consultor/Assessor.
  'Gerente de Projetos': 5,
  'Gerente de Inovação': 15,
  'Gerente de Operações': 15,
  'Gerente de CS': 15,
  'Gerente de Gente': 15,
  'Gerente Institucional': 15,
}

// "Mês sem lucro": reduz o valor base do cargo em 30% e o adicional por
// projeto de R$15 para R$10, aplicado a todos os colaboradores.
const MES_SEM_LUCRO_BASE_MULTIPLIER = 0.70
const VARIABLE_PER_PROJECT_MES_SEM_LUCRO: Record<string, number> = {
  'Consultor': 10,
  'Assessor': 10,
  'SDR': 10,
  'Gerente de Projetos': 5,
  'Gerente de Inovação': 10,
  'Gerente de Operações': 10,
  'Gerente de CS': 10,
  'Gerente de Gente': 10,
  'Gerente Institucional': 10,
}

const LEVEL_BONUS: Record<string, number> = {
  'Júnior': 0,
  'Junior': 0,
  'Pleno': 15,
  'Sênior': 30,
  'Senior': 30,
}

const PUNISHMENT_PER_POINT = 10
const NPS_THRESHOLD = 4
const NPS_BONUS_PERCENT = 0.10
const MAX_PER_PERSON = 300

// Roles that get exclusive role bonus (no level bonus)
const EXCLUSIVE_ROLES = [
  'Diretor', 'Closer',
  'Gerente de Projetos', 'Gerente de Inovação', 'Gerente de Operações',
  'Gerente de CS', 'Gerente de Gente', 'Gerente Institucional',
]

function getBusinessDaysInMonth(year: number, month: number): number {
  let count = 0
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const day = new Date(year, month - 1, d).getDay()
    if (day !== 0 && day !== 6) count++
  }
  return count
}

function getAbsenceBusinessDays(dataIda: string, dataVolta: string, year: number, month: number): number {
  const start = new Date(dataIda)
  const end = new Date(dataVolta)
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 0)

  const effectiveStart = start < monthStart ? monthStart : start
  const effectiveEnd = end > monthEnd ? monthEnd : end

  if (effectiveStart > effectiveEnd) return 0

  let count = 0
  const current = new Date(effectiveStart)
  while (current <= effectiveEnd) {
    const day = current.getDay()
    if (day !== 0 && day !== 6) count++
    current.setDate(current.getDate() + 1)
  }
  return count
}

export async function GET(req: NextRequest) {
  try {
    const supabaseAdmin = createServerSupabaseClient()
    const now = new Date()
    const url = new URL(req.url)
    const mes = url.searchParams.get('mes') ? parseInt(url.searchParams.get('mes')!) : now.getMonth() + 1
    const ano = url.searchParams.get('ano') ? parseInt(url.searchParams.get('ano')!) : now.getFullYear()
    const mesSemLucro = url.searchParams.get('mesSemLucro') === 'true'

    // Fetch active colaboradores sorted alphabetically (desligados e contas
    // fantasma de administrador não recebem PIPJ nos lançamentos)
    const { data: colaboradores, error: colabError } = await supabaseAdmin
      .from('colaboradores')
      .select('id, nome, cargo_atual, nivel_consultor, projetos, pontos_negativos, saldo_pipj')
      .eq('status', 'Ativo')
      .neq('cargo_atual', CARGO_FANTASMA)
      .order('nome', { ascending: true })

    if (colabError || !colaboradores) {
      return NextResponse.json({ error: 'Erro ao buscar colaboradores.' }, { status: 500 })
    }

    // Fetch colaboradores em plano de punição ativo
    const { data: planosPunicao } = await supabaseAdmin
      .from('plano_punicao')
      .select('colaborador_id')
      .eq('ativo', true)

    const emPlanoPunicao = new Set((planosPunicao || []).map((p: any) => p.colaborador_id))

    // Fetch scheduled absences for this month
    const monthStart = `${ano}-${String(mes).padStart(2, '0')}-01`
    const monthEnd = `${ano}-${String(mes).padStart(2, '0')}-${new Date(ano, mes, 0).getDate()}`

    const { data: ausencias } = await supabaseAdmin
      .from('ausencias')
      .select('colaborador_id, data_ida, data_volta')
      .eq('status', 'APROVADA')
      .lte('data_ida', monthEnd)
      .gte('data_volta', monthStart)

    const absenceMap = new Map<string, number>()
    if (ausencias) {
      for (const a of ausencias) {
        const days = getAbsenceBusinessDays(a.data_ida, a.data_volta, ano, mes)
        absenceMap.set(a.colaborador_id, (absenceMap.get(a.colaborador_id) || 0) + days)
      }
    }

    const businessDays = getBusinessDaysInMonth(ano, mes)

    // Início do mês seguinte ao selecionado — usado para "rebobinar" saldos e
    // contadores correntes até o fim exato do mês de referência.
    const nextMonthStart = mes === 12 ? `${ano + 1}-01-01` : `${ano}-${String(mes + 1).padStart(2, '0')}-01`

    // Fetch NPS evaluations do mês de referência selecionado (não o mais
    // recente disponível) e calcula a média por colaborador.
    const { data: avaliacoesNps } = await supabaseAdmin
      .from('avaliacoes_nps')
      .select('colaborador_id, nps_geral')
      .eq('ano', ano)
      .eq('mes', mes)

    const npsGroupMap = new Map<string, number[]>()
    if (avaliacoesNps) {
      for (const nps of avaliacoesNps) {
        const val = Number(nps.nps_geral)
        if (isNaN(val)) continue
        const arr = npsGroupMap.get(nps.colaborador_id) || []
        arr.push(val)
        npsGroupMap.set(nps.colaborador_id, arr)
      }
    }

    const npsMap = new Map<string, number>()
    for (const [id, vals] of npsGroupMap.entries()) {
      npsMap.set(id, vals.reduce((a, b) => a + b, 0) / vals.length)
    }

    // NPS final = média entre a nota da página Performance (avaliacoes_nps,
    // acima) e a nota do NPS Interno (formulário "Piloto de Elite"), ambas
    // do mês de referência selecionado. Se só uma das duas existir para o
    // colaborador naquele mês, usa só ela — a média só ocorre quando as
    // duas fontes têm avaliação no mês.
    const npsInternoMap = await getNpsInternoMap(supabaseAdmin, mes, ano)
    const npsFinalMap = new Map<string, number>()
    for (const id of new Set([...npsMap.keys(), ...npsInternoMap.keys()])) {
      const perf = npsMap.get(id)
      const interno = npsInternoMap.get(id)
      if (perf !== undefined && interno !== undefined) npsFinalMap.set(id, (perf + interno) / 2)
      else if (perf !== undefined) npsFinalMap.set(id, perf)
      else if (interno !== undefined) npsFinalMap.set(id, interno)
    }

    // Pontos negativos referentes ao fim do mês de referência: parte do
    // saldo atual (colaboradores.pontos_negativos) e desfaz tudo que
    // aconteceu DEPOIS do mês escolhido — equivalente a (saldo antes do mês
    // + ocorrências do mês), sem depender de reconstruir o histórico inteiro
    // desde a criação da conta.
    const { data: ocorrenciasFuturas } = await supabaseAdmin
      .from('ocorrencias')
      .select('colaborador_id, pontuacao')
      .gte('data', nextMonthStart)

    const adicoesFuturasMap = new Map<string, number>()
    if (ocorrenciasFuturas) {
      for (const o of ocorrenciasFuturas) {
        adicoesFuturasMap.set(o.colaborador_id, (adicoesFuturasMap.get(o.colaborador_id) || 0) + (o.pontuacao || 0))
      }
    }

    const { data: remocoesFuturas } = await supabaseAdmin
      .from('solicitacoes_remocao')
      .select('colaborador_id, pontos_solicitados')
      .eq('status', 'APROVADA')
      .gte('created_at', nextMonthStart)

    const remocoesFuturasMap = new Map<string, number>()
    if (remocoesFuturas) {
      for (const r of remocoesFuturas) {
        remocoesFuturasMap.set(r.colaborador_id, (remocoesFuturasMap.get(r.colaborador_id) || 0) + (r.pontos_solicitados || 0))
      }
    }

    // Projetos referentes ao fim do mês de referência: usa o histórico de
    // auditoria (audit_logs, campo "projetos") para achar o último valor
    // registrado até o fim do mês escolhido. Sem histórico anterior a esse
    // mês (cobertura parcial), cai de volta no valor corrente do colaborador.
    const { data: projetosAuditoria } = await supabaseAdmin
      .from('audit_logs')
      .select('colaborador_id, valor_novo, created_at')
      .eq('campo', 'projetos')
      .lt('created_at', nextMonthStart)
      .order('created_at', { ascending: false })

    const projetosHistoricoMap = new Map<string, number>()
    if (projetosAuditoria) {
      for (const a of projetosAuditoria) {
        if (projetosHistoricoMap.has(a.colaborador_id)) continue
        const parsed = parseInt(a.valor_novo, 10)
        if (!isNaN(parsed)) projetosHistoricoMap.set(a.colaborador_id, parsed)
      }
    }

    const detalhes: any[] = []
    let totalLancado = 0

    for (const colab of colaboradores) {
      const cargo = colab.cargo_atual || 'Assessor'
      const nivel = colab.nivel_consultor || 'Júnior'
      const projetos = projetosHistoricoMap.has(colab.id) ? projetosHistoricoMap.get(colab.id)! : (colab.projetos || 0)
      const pontosNegativosAtual = colab.pontos_negativos || 0
      const pontosNegativos = Math.max(0, pontosNegativosAtual - (adicoesFuturasMap.get(colab.id) || 0) + (remocoesFuturasMap.get(colab.id) || 0))

      // 1. Fixed base value (reduzido 30% em mês sem lucro)
      const baseCargoIntegral = FIXED_VALUES[cargo] || 100
      const baseCargo = mesSemLucro
        ? Math.round(baseCargoIntegral * MES_SEM_LUCRO_BASE_MULTIPLIER * 100) / 100
        : baseCargoIntegral
      let subtotal = baseCargo

      // 2. Variable per project (only Consultor/Gerente/SDR/Assessor; valor
      // reduzido de R$15 para R$10 em mês sem lucro)
      const tabelaPorProjeto = mesSemLucro ? VARIABLE_PER_PROJECT_MES_SEM_LUCRO : VARIABLE_PER_PROJECT
      const bonusProjetos = tabelaPorProjeto[cargo] ? tabelaPorProjeto[cargo] * projetos : 0
      subtotal += bonusProjetos

      // 3. Level bonus (only for non-exclusive roles)
      const bonusNivel = !EXCLUSIVE_ROLES.includes(cargo) ? (LEVEL_BONUS[nivel] || 0) : 0
      subtotal += bonusNivel

      // 4. Punishment deduction
      const descontoPunicao = PUNISHMENT_PER_POINT * pontosNegativos
      subtotal -= descontoPunicao

      // 5. Absence deduction (proportional)
      const absenceDays = absenceMap.get(colab.id) || 0
      let descontoAusencia = 0
      if (absenceDays > 0 && businessDays > 0) {
        descontoAusencia = Math.round(((absenceDays / businessDays) * subtotal) * 100) / 100
      }
      
      let subtotalAposAusencia = Math.max(0, subtotal - descontoAusencia)

      // 6. NPS Bonus (+10% if NPS > 4)
      const latestNps = npsFinalMap.get(colab.id) || 0
      const bonusNps = latestNps > NPS_THRESHOLD ? Math.round(subtotalAposAusencia * NPS_BONUS_PERCENT * 100) / 100 : 0
      
      let pipj = Math.round((subtotalAposAusencia + bonusNps) * 100) / 100
      pipj = Math.min(pipj, MAX_PER_PERSON)

      // Plano de punição: zera o PIPJ
      const planoPunicaoAtivo = emPlanoPunicao.has(colab.id)
      if (planoPunicaoAtivo) pipj = 0

      // Build calculation breakdown
      const detalhesCalculo = {
        base_cargo: baseCargo,
        bonus_projetos: bonusProjetos,
        qtd_projetos: projetos,
        bonus_nivel: bonusNivel,
        nivel: nivel,
        desconto_punicao: descontoPunicao,
        pontos_negativos: pontosNegativos,
        desconto_ausencia: descontoAusencia,
        dias_ausencia: absenceDays,
        dias_uteis_mes: businessDays,
        nps_score: latestNps,
        bonus_nps: bonusNps,
        subtotal_apos_ausencia: subtotalAposAusencia,
        plano_punicao: planoPunicaoAtivo,
        mes_sem_lucro: mesSemLucro,
      }

      detalhes.push({
        colaborador_id: colab.id,
        nome: colab.nome,
        cargo: cargo,
        nivel: nivel,
        projetos: projetos,
        pontos_negativos: pontosNegativos,
        ausencia_dias: absenceDays,
        valor_calculado: pipj,
        detalhes_calculo: detalhesCalculo,
      })

      totalLancado += pipj
    }

    return NextResponse.json({
      success: true,
      total_lancado: totalLancado,
      total_colaboradores: colaboradores.length,
      mes_sem_lucro: mesSemLucro,
      detalhes,
    })
  } catch (error: any) {
    console.error('PIPJ preview error:', error)
    return NextResponse.json({ error: error.message || 'Erro interno.' }, { status: 500 })
  }
}
