// Checagens de acesso das rotas /api/gasolina/* (o app usa a chave anon do
// Supabase, então é aqui que se decide quem pode o quê). Mesmo formato de
// retorno de exigirLider em src/lib/pdi-server.ts.
import { auth } from '@/auth'
import { paginaPermitida, podeGerirGasolina } from '@/lib/access-control'
import { calcularLitros, dataMaisAntigaPermitida, formatarMes, inicioDoMes } from '@/lib/gasolina'

type Resultado =
    | { ok: true, colaboradorId: string, gestor: boolean }
    | { ok: false, status: number, error: string }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function exigirMembroGasolina(supabase: any): Promise<Resultado> {
    const session = await auth()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const colaboradorId = (session?.user as any)?.colaborador_id as string | undefined
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const role = (session?.user as any)?.role as string | undefined
    if (!colaboradorId) return { ok: false, status: 401, error: 'Não autenticado.' }

    const { data: colaborador } = await supabase
        .from('colaboradores')
        .select('cargo_atual, nucleo_atual, status, paginas_permitidas')
        .eq('id', colaboradorId)
        .single()
    if (!colaborador || colaborador.status !== 'Ativo') {
        return { ok: false, status: 403, error: 'Acesso restrito a membros ativos.' }
    }
    // Mesma regra do menu/RouteGuard (access-control.ts): enquanto a página
    // estiver restrita, as rotas também ficam.
    if (!paginaPermitida('/gasolina', colaborador, role)) {
        return { ok: false, status: 403, error: 'O reembolso de gasolina ainda não está liberado para você.' }
    }
    return { ok: true, colaboradorId, gestor: podeGerirGasolina(colaborador, role) }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function exigirGestorGasolina(supabase: any): Promise<Resultado> {
    const acesso = await exigirMembroGasolina(supabase)
    if (acesso.ok && !acesso.gestor) {
        return { ok: false, status: 403, error: 'Apenas a Vice Presidência pode fazer isso.' }
    }
    return acesso
}

// ---------------------------------------------------------------------------
// Cálculo das viagens (mesma conta da planilha): litros = km ÷ autonomia do
// carro; valor = litros × preço do mês da viagem. Só viagens Pendentes são
// (re)calculadas — histórico (Reembolsado/Vencido) e viagens já em
// solicitação mantêm o valor que foi pedido/pago.
// ---------------------------------------------------------------------------

export interface CalculoViagem {
    autonomia_usada: number | null
    litros: number | null
    preco_litro: number | null
    valor: number | null
}

export function calcularViagem(distanciaKm: number, autonomia: number | null, precoLitro: number | null): CalculoViagem {
    if (!autonomia) return { autonomia_usada: null, litros: null, preco_litro: precoLitro, valor: null }
    const litros = calcularLitros(distanciaKm, autonomia)
    return {
        autonomia_usada: autonomia,
        litros,
        preco_litro: precoLitro,
        valor: precoLitro ? Math.round(litros * precoLitro * 100) / 100 : null,
    }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function precoDoMes(supabase: any, dataViagem: string): Promise<number | null> {
    const { data } = await supabase.from('gasolina_precos').select('preco_litro').eq('mes', inicioDoMes(dataViagem)).maybeSingle()
    return data ? Number(data.preco_litro) : null
}

// Recalcula as viagens Pendentes afetadas por uma mudança de preço do mês
// (filtro.mes = "AAAA-MM-01"), de autonomia de um carro (filtro.veiculoId) ou
// uma lista específica (filtro.ids — usado antes de montar a prévia).
// Vale também para Pendentes importadas da planilha: sem carro vinculado, elas
// mantêm os litros da planilha e só ganham preço/valor.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recalcularPendentes(supabase: any, filtro: { mes?: string, veiculoId?: string, ids?: string[] }): Promise<number> {
    let query = supabase
        .from('gasolina_viagens')
        .select('id, distancia_km, data_viagem, autonomia_usada, litros, preco_litro, valor, veiculo:veiculo_id(autonomia_km_l)')
        .eq('status', 'Pendente')
    if (filtro.veiculoId) query = query.eq('veiculo_id', filtro.veiculoId)
    if (filtro.ids) query = query.in('id', filtro.ids.length ? filtro.ids : ['00000000-0000-0000-0000-000000000000'])
    if (filtro.mes) {
        const [a, m] = filtro.mes.split('-').map(Number)
        const fim = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
        query = query.gte('data_viagem', filtro.mes).lte('data_viagem', fim)
    }
    const { data: viagens, error } = await query
    if (error || !viagens?.length) return 0

    const precos = new Map<string, number | null>()
    let alteradas = 0
    for (const v of viagens) {
        const mes = inicioDoMes(v.data_viagem)
        if (!precos.has(mes)) precos.set(mes, await precoDoMes(supabase, v.data_viagem))
        const autonomia = v.veiculo?.autonomia_km_l != null ? Number(v.veiculo.autonomia_km_l) : null
        const preco = precos.get(mes) ?? null
        const novo = autonomia || v.litros == null
            ? calcularViagem(Number(v.distancia_km), autonomia, preco)
            : {
                autonomia_usada: v.autonomia_usada == null ? null : Number(v.autonomia_usada),
                litros: Number(v.litros),
                preco_litro: preco,
                valor: preco ? Math.round(Number(v.litros) * preco * 100) / 100 : null,
            }
        const mudou = (['autonomia_usada', 'litros', 'preco_litro', 'valor'] as const)
            .some(k => (v[k] == null ? null : Number(v[k])) !== novo[k])
        if (!mudou) continue
        await supabase.from('gasolina_viagens').update({ ...novo, atualizado_em: new Date().toISOString() }).eq('id', v.id)
        alteradas++
    }
    return alteradas
}

// ---------------------------------------------------------------------------
// Solicitação de reembolso: 1 por projeto/prospecção (mesma lógica da
// planilha). Só entram viagens Pendentes cujo mês já tem preço definido; as
// demais ficam de fora e continuam Pendentes.
// ---------------------------------------------------------------------------

export interface ViagemPreview {
    id: string
    data_viagem: string
    origem_local: string
    destino_local: string
    paradas: string[]
    distancia_km: number
    litros: number | null
    preco_litro: number | null
    valor: number | null
    veiculo: { modelo: string } | null
}

export interface PreviewSolicitacao {
    incluidas: ViagemPreview[]
    excluidas: (ViagemPreview & { motivo: string })[]
    litros_total: number
    valor_total: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function montarPreview(supabase: any, colaboradorId: string, centroId: string, projeto: string): Promise<PreviewSolicitacao> {
    const campos = 'id, data_viagem, origem_local, destino_local, paradas, distancia_km, litros, preco_litro, valor, veiculo:veiculo_id(modelo)'
    const buscar = async (): Promise<ViagemPreview[]> => {
        const { data, error } = await supabase
            .from('gasolina_viagens')
            .select(campos)
            .eq('colaborador_id', colaboradorId)
            .eq('centro_custo_id', centroId)
            .eq('projeto', projeto)
            .eq('status', 'Pendente')
            .order('data_viagem', { ascending: true })
        if (error) throw new Error(error.message)
        return data ?? []
    }

    // Garante valores atualizados (ex.: preço do mês lançado agora há pouco).
    const antes = await buscar()
    const alteradas = await recalcularPendentes(supabase, { ids: antes.map(v => v.id) })
    const viagens = alteradas ? await buscar() : antes

    const incluidas: ViagemPreview[] = []
    const excluidas: (ViagemPreview & { motivo: string })[] = []
    for (const v of viagens) {
        if (v.valor != null) incluidas.push(v)
        else if (v.litros == null) excluidas.push({ ...v, motivo: 'Carro sem autonomia válida' })
        else excluidas.push({ ...v, motivo: `Aguardando o preço de ${formatarMes(inicioDoMes(v.data_viagem))}` })
    }
    const somar = (k: 'litros' | 'valor') => incluidas.reduce((s, v) => s + Number(v[k] ?? 0), 0)
    return {
        incluidas,
        excluidas,
        litros_total: Math.round(somar('litros') * 1000) / 1000,
        valor_total: Math.round(somar('valor') * 100) / 100,
    }
}

export const STATUS_SOLICITACAO = ['Solicitado', 'Aprovado', 'Lançado', 'Pago', 'Recusado'] as const
export type StatusSolicitacao = typeof STATUS_SOLICITACAO[number]

// Ordem do kanban: o status só avança (Recusado encerra a qualquer momento).
const ORDEM: Record<StatusSolicitacao, number> = { 'Solicitado': 0, 'Aprovado': 1, 'Lançado': 2, 'Pago': 3, 'Recusado': 9 }

// Aplica um novo status vindo do Monday/n8n. Pago -> viagens Reembolsado.
// Recusado -> as viagens continuam vinculadas à solicitação (o app mostra
// "Recusada" com o motivo) até o membro clicar em "Retomar", que as devolve
// a Pendente para corrigir e pedir de novo (retomarSolicitacao).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function aplicarStatusSolicitacao(supabase: any, solicitacao: { id: string, status: StatusSolicitacao }, novo: StatusSolicitacao, motivo?: string): Promise<boolean> {
    if (solicitacao.status === novo) return false
    if (solicitacao.status === 'Pago' || solicitacao.status === 'Recusado') return false
    if (novo !== 'Recusado' && ORDEM[novo] < ORDEM[solicitacao.status]) return false

    const agora = new Date().toISOString()
    const { data: atualizada } = await supabase
        .from('gasolina_solicitacoes')
        .update({ status: novo, atualizado_em: agora, ...(novo === 'Recusado' ? { motivo_recusa: motivo || 'Recusado no Monday.' } : {}) })
        .eq('id', solicitacao.id)
        .eq('status', solicitacao.status)   // evita corrida entre o n8n e o sync
        .select('id')
        .maybeSingle()
    if (!atualizada) return false

    if (novo === 'Pago') {
        await supabase.from('gasolina_viagens').update({ status: 'Reembolsado', atualizado_em: agora })
            .eq('solicitacao_id', solicitacao.id).eq('status', 'Em solicitação')
    }
    return true
}

// "Retomar" uma solicitação recusada: as viagens voltam a Pendente (sem
// vínculo), prontas para editar e solicitar de novo. As que já passaram do
// prazo de 2 meses voltam como Vencido — mesma regra do job diário.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function retomarSolicitacao(supabase: any, solicitacaoId: string): Promise<{ retomadas: number, vencidas: number }> {
    const agora = new Date().toISOString()
    const limite = dataMaisAntigaPermitida()
    const { data: vencidas } = await supabase.from('gasolina_viagens')
        .update({ status: 'Vencido', solicitacao_id: null, atualizado_em: agora })
        .eq('solicitacao_id', solicitacaoId).eq('status', 'Em solicitação').lt('data_viagem', limite)
        .select('id')
    const { data: retomadas } = await supabase.from('gasolina_viagens')
        .update({ status: 'Pendente', solicitacao_id: null, atualizado_em: agora })
        .eq('solicitacao_id', solicitacaoId).eq('status', 'Em solicitação')
        .select('id')
    return { retomadas: retomadas?.length ?? 0, vencidas: vencidas?.length ?? 0 }
}
