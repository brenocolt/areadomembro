import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { CARGO_FANTASMA } from '@/lib/cargos'

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
// Bônus manual "NPS 10/CSAT 5" selecionado no lançamento. Calculado sobre a
// mesma base que o bônus de NPS automático (subtotal após ausência) e somado
// a ele — os dois bônus percentuais NUNCA compõem (um sobre o outro).
const NPS_CSAT_BONUS_PERCENT = 0.10
// Bônus manual "Reconhecimento" selecionado no lançamento. Valor FIXO (não
// percentual) somado por fora — nunca entra na base dos bônus de NPS/CSAT
// acima, nem é reduzido/limitado por eles.
const RECONHECIMENTO_BONUS_VALOR = 50
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

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const overrides: Record<string, { deducao?: number, valor_final?: number, motivo: string }> = body.overrides || {};
    const npsCsatBonus: Record<string, boolean> = body.npsCsatBonus || {};
    const reconhecimentoBonus: Record<string, boolean> = body.reconhecimentoBonus || {};
    const mesSemLucro: boolean = body.mesSemLucro === true;

    const supabaseAdmin = createServerSupabaseClient()
    const now = new Date()
    const mes: number = body.mes ? parseInt(body.mes) : now.getMonth() + 1
    const ano: number = body.ano ? parseInt(body.ano) : now.getFullYear()

    // Monthly limit check removed for testing purposes

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
      const latestNps = npsMap.get(colab.id) || 0
      const bonusNps = latestNps > NPS_THRESHOLD ? Math.round(subtotalAposAusencia * NPS_BONUS_PERCENT * 100) / 100 : 0

      // Valor "Calculado" mostrado no preview (base + bônus de NPS automático).
      let pipjSemAjusteManual = Math.round((subtotalAposAusencia + bonusNps) * 100) / 100
      pipjSemAjusteManual = Math.min(pipjSemAjusteManual, MAX_PER_PERSON)

      // 7. Ajustes manuais feitos no preview (bloqueados para plano de punição)
      const override = emPlanoPunicao.has(colab.id) ? undefined : overrides[colab.id];
      const npsCsatSelecionado = !emPlanoPunicao.has(colab.id) && !!npsCsatBonus[colab.id]
      const deducaoManual = override?.deducao !== undefined ? Number(override.deducao) : 0

      // 7b. Bônus manual "NPS 10/CSAT 5". Usa a MESMA base que o bônus de NPS
      // automático (subtotalAposAusencia) — nunca o valor que já inclui o
      // outro bônus, senão os dois bônus percentuais comporiam entre si. A
      // dedução manual reduz essa base antes do cálculo dos 10%, então o
      // bônus responde à dedução aplicada (ex.: base R$100, dedução R$20 →
      // bônus = 10% de R$80 = R$8).
      const baseParaBonusCsat = Math.max(0, subtotalAposAusencia - deducaoManual)
      const bonusNpsCsat = npsCsatSelecionado ? Math.round(baseParaBonusCsat * NPS_CSAT_BONUS_PERCENT * 100) / 100 : 0

      let pipjCalculado = Math.max(0, pipjSemAjusteManual - deducaoManual) + bonusNpsCsat
      pipjCalculado = Math.min(Math.round(pipjCalculado * 100) / 100, MAX_PER_PERSON)

      // 7c. Bônus fixo "Reconhecimento" (R$50). Somado DEPOIS do teto de
      // MAX_PER_PERSON e fora da base de qualquer bônus percentual — nunca
      // entra no cálculo dos 10% de NPS/CSAT, nem é limitado pelo teto.
      const reconhecimentoSelecionado = !emPlanoPunicao.has(colab.id) && !!reconhecimentoBonus[colab.id]
      const bonusReconhecimento = reconhecimentoSelecionado ? RECONHECIMENTO_BONUS_VALOR : 0
      pipjCalculado = Math.round((pipjCalculado + bonusReconhecimento) * 100) / 100

      // Plano de punição: zera o PIPJ (override manual não pode reverter)
      if (emPlanoPunicao.has(colab.id)) pipjCalculado = 0

      let pipj = pipjCalculado;

      // Override absoluto do valor final (digitado diretamente no preview,
      // substitui todo o cálculo acima).
      const hasValorFinalOverride = override && override.valor_final !== undefined;
      if (hasValorFinalOverride) {
        pipj = Math.max(0, Number(override.valor_final));
      }

      // Ajuste manual total = dedução aplicada + qualquer diferença extra de
      // um override absoluto de valor final (normalmente zero, já que os
      // dois campos são mutuamente exclusivos no preview).
      const ajusteManual = Math.round((-deducaoManual + (pipj - pipjCalculado)) * 100) / 100;
      const motivoAjuste = override ? override.motivo : '';

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
        nps_csat_selecionado: npsCsatSelecionado,
        bonus_nps_csat: bonusNpsCsat,
        reconhecimento_selecionado: reconhecimentoSelecionado,
        bonus_reconhecimento: bonusReconhecimento,
        ajuste_manual: ajusteManual,
        motivo_ajuste: motivoAjuste,
        mes_sem_lucro: mesSemLucro
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
      })

      totalLancado += pipj

      // Build periodo label
      const periodo = `${String(mes).padStart(2, '0')}/${ano}`

      // Determine semestre
      const semestre = mes <= 6 ? `${ano}.1` : `${ano}.2`

      // Update saldo_pipj
      const novoSaldo = Number(colab.saldo_pipj || 0) + pipj
      await supabaseAdmin
        .from('colaboradores')
        .update({ saldo_pipj: novoSaldo })
        .eq('id', colab.id)

      // Insert transaction record with full breakdown
      await supabaseAdmin.from('transacoes_pipj').insert({
        colaborador_id: colab.id,
        tipo: 'ENTRADA',
        valor: pipj,
        periodo,
        semestre,
        cargo_no_periodo: cargo,
        detalhes_calculo: detalhesCalculo,
        status: 'CREDITADO',
      })
    }

    // Log the launch
    await supabaseAdmin.from('lancamentos_pipj').insert({
      mes,
      ano,
      total_lancado: totalLancado,
      total_colaboradores: colaboradores.length,
      detalhes,
    })

    return NextResponse.json({
      success: true,
      total_lancado: totalLancado,
      total_colaboradores: colaboradores.length,
      detalhes,
    })
  } catch (error: any) {
    console.error('PIPJ launch error:', error)
    return NextResponse.json({ error: error.message || 'Erro interno.' }, { status: 500 })
  }
}
