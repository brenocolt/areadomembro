// Marca como "Vencido" as viagens de gasolina Pendentes com mais de 2 meses
// (prazo da planilha, antes feito por um Apps Script). Mesmo padrão de
// agendamento de monday-sync-scheduler.ts. O UPDATE é idempotente: rodar duas
// vezes (ex.: dois processos) não causa problema.
import { createServerSupabaseClient } from './supabase-server'
import { dataMaisAntigaPermitida } from './gasolina'
import { isSchemaDesatualizado } from './db-compat'
import { aplicarStatusSolicitacao, type StatusSolicitacao } from './gasolina-server'
import { COLUNAS_PAGAMENTO, statusDoKanban } from './gasolina-monday'
import { lerColunaDosItens, MONDAY_PAGAMENTOS_API_TOKEN } from './monday'

const HORA_UTC = 3    // 3h UTC = meia-noite em Brasília: vira o dia e vence
const MINUTO_UTC = 5
const UM_DIA_MS = 24 * 60 * 60 * 1000

let agendado = false

function msAteProximoHorario(horaUtc: number, minutoUtc: number): number {
    const agora = new Date()
    const proximo = new Date(Date.UTC(
        agora.getUTCFullYear(), agora.getUTCMonth(), agora.getUTCDate(),
        horaUtc, minutoUtc, 0, 0
    ))
    if (proximo.getTime() <= agora.getTime()) {
        proximo.setUTCDate(proximo.getUTCDate() + 1)
    }
    return proximo.getTime() - agora.getTime()
}

export async function vencerViagensAntigas(): Promise<number> {
    const supabase = createServerSupabaseClient()
    const { data, error } = await supabase
        .from('gasolina_viagens')
        .update({ status: 'Vencido', atualizado_em: new Date().toISOString() })
        .eq('status', 'Pendente')
        .lt('data_viagem', dataMaisAntigaPermitida())
        .select('id')
    if (error) {
        if (isSchemaDesatualizado(error)) return 0   // migração ainda não aplicada
        throw new Error(error.message)
    }
    return data?.length ?? 0
}

async function rodar() {
    try {
        const vencidas = await vencerViagensAntigas()
        if (vencidas > 0) console.log(`[gasolina] ${vencidas} viagem(ns) marcada(s) como Vencido.`)
    } catch (err) {
        console.error('[gasolina] Falha ao marcar viagens vencidas:', err)
    }
}

// Acompanha no app o kanban do Monday (Aprovado -> Lançado -> Pago, ou
// Recusado) das solicitações em aberto.
// filtro.colaboradorId: só as solicitações daquele membro (botão "Atualizar").
export async function sincronizarSolicitacoes(filtro: { colaboradorId?: string } = {}): Promise<number> {
    if (!MONDAY_PAGAMENTOS_API_TOKEN) return 0
    const supabase = createServerSupabaseClient()
    let query = supabase
        .from('gasolina_solicitacoes')
        .select('id, status, monday_item_id')
        .in('status', ['Solicitado', 'Aprovado', 'Lançado'])
        .not('monday_item_id', 'is', null)
    if (filtro.colaboradorId) query = query.eq('colaborador_id', filtro.colaboradorId)
    const { data: abertas, error } = await query
    if (error) {
        if (isSchemaDesatualizado(error)) return 0
        throw new Error(error.message)
    }
    if (!abertas?.length) return 0

    const statusMonday = await lerColunaDosItens(abertas.map(s => s.monday_item_id as string), COLUNAS_PAGAMENTO.status)
    let alteradas = 0
    for (const s of abertas) {
        const texto = statusMonday.get(String(s.monday_item_id))
        // Card que não voltou (excluído, ou token sem acesso ao board): não
        // dá para distinguir os dois casos, então não mexe — só registra.
        if (texto === undefined) {
            console.warn(`[gasolina] Card ${s.monday_item_id} (solicitação ${s.id}) não encontrado no Monday.`)
            continue
        }
        const novo = statusDoKanban(texto)
        if (!novo) continue
        if (await aplicarStatusSolicitacao(supabase, s as { id: string, status: StatusSolicitacao }, novo)) alteradas++
    }
    return alteradas
}

async function rodarSincronizacao() {
    try {
        const alteradas = await sincronizarSolicitacoes()
        if (alteradas > 0) console.log(`[gasolina] ${alteradas} solicitação(ões) atualizada(s) pelo Monday.`)
    } catch (err) {
        console.error('[gasolina] Falha ao sincronizar solicitações com o Monday:', err)
    }
}

export function scheduleVencimentoGasolina() {
    if (agendado) return
    agendado = true

    rodarSincronizacao()
    // A cada 1 min: Lançado/Pago são movidos à mão no Monday e o membro recebe
    // o aviso quando o app percebe. É uma consulta ao Monday por rodada (lotes de 50).
    setInterval(rodarSincronizacao, 60 * 1000)

    rodar()
    setTimeout(function agendarProximo() {
        rodar()
        setInterval(rodar, UM_DIA_MS)
    }, msAteProximoHorario(HORA_UTC, MINUTO_UTC))
}
