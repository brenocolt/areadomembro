import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

// Business Rules Constants
const FIXED_VALUES: Record<string, number> = {
  'Consultor': 100,
  'Assessor': 100,
  'Gerente': 175,
  'Closer': 175,
  'Diretor': 200,
  'SDR': 100,
}

const VARIABLE_PER_PROJECT: Record<string, number> = {
  'Consultor': 15,
  'Assessor': 15,
  'SDR': 15,
  'Gerente': 5,
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
const EXCLUSIVE_ROLES = ['Diretor', 'Closer', 'Gerente']

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
    const mes = now.getMonth() + 1
    const ano = now.getFullYear()

    // Fetch active colaboradores sorted alphabetically
    const { data: colaboradores, error: colabError } = await supabaseAdmin
      .from('colaboradores')
      .select('id, nome, cargo_atual, nivel_consultor, projetos, pontos_negativos, saldo_pipj')
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

    // Fetch latest NPS per user
    const { data: avaliacoesNps } = await supabaseAdmin
      .from('avaliacoes_nps')
      .select('colaborador_id, nps_geral')
      .order('ano', { ascending: false })
      .order('mes', { ascending: false })

    const npsMap = new Map<string, number>()
    if (avaliacoesNps) {
        // Keep only the first one (most recent) for each colab
        for (const nps of avaliacoesNps) {
            if (!npsMap.has(nps.colaborador_id)) {
                npsMap.set(nps.colaborador_id, Number(nps.nps_geral))
            }
        }
    }

    const detalhes: any[] = []
    let totalLancado = 0

    for (const colab of colaboradores) {
      const cargo = colab.cargo_atual || 'Assessor'
      const nivel = colab.nivel_consultor || 'Júnior'
      const projetos = colab.projetos || 0
      const pontosNegativos = colab.pontos_negativos || 0

      // 1. Fixed base value
      const baseCargo = FIXED_VALUES[cargo] || 100
      let subtotal = baseCargo

      // 2. Variable per project (only Consultor/Gerente)
      const bonusProjetos = VARIABLE_PER_PROJECT[cargo] ? VARIABLE_PER_PROJECT[cargo] * projetos : 0
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
      const latestNps = npsMap.get(colab.id) || 0
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
        plano_punicao: planoPunicaoAtivo,
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
      detalhes,
    })
  } catch (error: any) {
    console.error('PIPJ preview error:', error)
    return NextResponse.json({ error: error.message || 'Erro interno.' }, { status: 500 })
  }
}
