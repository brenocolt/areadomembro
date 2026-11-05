// Marca como "Vencido" as viagens de gasolina Pendentes com mais de 2 meses
// (prazo da planilha, antes feito por um Apps Script). Mesmo padrão de
// agendamento de monday-sync-scheduler.ts. O UPDATE é idempotente: rodar duas
// vezes (ex.: dois processos) não causa problema.
import { createServerSupabaseClient } from './supabase-server'
import { dataMaisAntigaPermitida } from './gasolina'
import { isSchemaDesatualizado } from './db-compat'

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

export function scheduleVencimentoGasolina() {
    if (agendado) return
    agendado = true

    rodar()
    setTimeout(function agendarProximo() {
        rodar()
        setInterval(rodar, UM_DIA_MS)
    }, msAteProximoHorario(HORA_UTC, MINUTO_UTC))
}
