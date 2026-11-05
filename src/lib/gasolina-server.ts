// Checagens de acesso das rotas /api/gasolina/* (o app usa a chave anon do
// Supabase, então é aqui que se decide quem pode o quê). Mesmo formato de
// retorno de exigirLider em src/lib/pdi-server.ts.
import { auth } from '@/auth'
import { paginaPermitida, podeGerirGasolina } from '@/lib/access-control'
import { calcularLitros, inicioDoMes } from '@/lib/gasolina'

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
// carro; valor = litros × preço do mês da viagem. Só viagens Pendentes do app
// são (re)calculadas — histórico importado da planilha e viagens já em
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
// (filtro.mes = "AAAA-MM-01") ou de autonomia de um carro (filtro.veiculoId).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function recalcularPendentes(supabase: any, filtro: { mes?: string, veiculoId?: string }): Promise<number> {
    let query = supabase
        .from('gasolina_viagens')
        .select('id, distancia_km, data_viagem, autonomia_usada, litros, preco_litro, valor, veiculo:veiculo_id(autonomia_km_l)')
        .eq('status', 'Pendente')
        .eq('origem', 'app')
    if (filtro.veiculoId) query = query.eq('veiculo_id', filtro.veiculoId)
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
        const novo = calcularViagem(Number(v.distancia_km), autonomia, precos.get(mes) ?? null)
        const mudou = (['autonomia_usada', 'litros', 'preco_litro', 'valor'] as const)
            .some(k => (v[k] == null ? null : Number(v[k])) !== novo[k])
        if (!mudou) continue
        await supabase.from('gasolina_viagens').update({ ...novo, atualizado_em: new Date().toISOString() }).eq('id', v.id)
        alteradas++
    }
    return alteradas
}
