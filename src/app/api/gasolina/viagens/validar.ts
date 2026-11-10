import { listarOpcoesDropdown } from '@/lib/monday'
import { dataMaisAntigaPermitida, formatarData, hojeBrasil, lerNumero } from '@/lib/gasolina'
import { calcularRota, mapsAtivo, pontosDaRota, type RotaCalculada } from '@/lib/google-maps'
import type { RotaViagem } from '@/lib/gasolina'

type Ok = {
    ok: true
    viagem: {
        veiculo_id: string
        centro_custo_id: string
        projeto: string
        origem_local: string
        destino_local: string
        paradas: string[]
        distancia_km: number
        data_viagem: string
        rota: RotaCalculada | null
    }
    autonomia: number
}

// Valida o corpo de criação/edição de uma viagem: carro precisa ser do
// membro e estar ativo; projeto precisa existir na lista do Monday (ou ser o
// rótulo fixo do centro); data dentro do prazo de 2 meses e não futura.
// Km travados: depois que o membro calcula pelo Google, os km da viagem são
// sempre os da rota calculada aqui no servidor (não dá para alterar pelo
// navegador). Numa edição, a trava continua enquanto o trajeto for o mesmo.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function lerViagem(supabase: any, colaboradorId: string, body: Record<string, unknown>, rotaAnterior: RotaViagem | null = null): Promise<Ok | { ok: false, status: number, error: string }> {
    const texto = (v: unknown, max: number) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : '')
    const erro = (error: string, status = 400) => ({ ok: false as const, status, error })

    const veiculoId = texto(body.veiculo_id, 60)
    const centroId = texto(body.centro_custo_id, 60)
    const origem = texto(body.origem_local, 200)
    const destino = texto(body.destino_local, 200)
    const distancia = lerNumero(body.distancia_km)
    const data = texto(body.data_viagem, 10)
    const paradas = (Array.isArray(body.paradas) ? body.paradas : [])
        .map(p => texto(p, 200)).filter(Boolean).slice(0, 10)
    const idaEVolta = body.ida_e_volta === true

    if (!centroId) return erro('Escolha o centro de custo.')
    if (!veiculoId) return erro('Escolha o carro.')
    if (!origem) return erro('Informe o local de saída.')
    if (!destino) return erro('Informe o local de chegada.')
    if (distancia === null || distancia <= 0 || distancia > 2000) return erro('Distância inválida — informe o total de km do trecho (até 2.000 km).')
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data) || Number.isNaN(Date.parse(data))) return erro('Data inválida.')
    const hoje = hojeBrasil()
    if (data > hoje) return erro('A data da viagem não pode ser no futuro.')
    const maisAntiga = dataMaisAntigaPermitida(hoje)
    if (data < maisAntiga) return erro(`O prazo para reembolso é de 2 meses — só dá para lançar viagens a partir de ${formatarData(maisAntiga)}.`)

    const { data: veiculo } = await supabase.from('gasolina_veiculos')
        .select('id, autonomia_km_l').eq('id', veiculoId).eq('colaborador_id', colaboradorId).eq('ativo', true).maybeSingle()
    if (!veiculo) return erro('Carro não encontrado. Cadastre o carro na aba "Meus carros e Pix".')

    const { data: centro } = await supabase.from('gasolina_centros_custo')
        .select('id, tipo, rotulo_fixo, monday_coluna_projeto, ativo').eq('id', centroId).maybeSingle()
    if (!centro || !centro.ativo) return erro('Centro de custo inválido.')

    let projeto: string
    if (centro.tipo === 'fixo') {
        projeto = centro.rotulo_fixo
    } else {
        projeto = texto(body.projeto, 120)
        if (!projeto) return erro('Escolha o projeto.')
        try {
            const opcoes = await listarOpcoesDropdown(centro.monday_coluna_projeto)
            if (!opcoes.includes(projeto)) return erro('Projeto não encontrado na lista do Monday. Escolha um da lista.')
        } catch (err) {
            console.error('[gasolina] Falha ao validar projeto no Monday:', err)
            return erro('Não foi possível conferir o projeto no Monday agora. Tente de novo em instantes.', 502)
        }
    }

    // Rota pelo Google Maps (quando ligado): calculada aqui, não no navegador,
    // para a VP poder comparar com os km informados. Falha do Google não
    // impede salvar — os km informados continuam valendo.
    const mesmoTrajeto = !!rotaAnterior?.km_google
        && JSON.stringify(rotaAnterior.pontos) === JSON.stringify(pontosDaRota(origem, paradas, destino, idaEVolta))
    const kmGoogle = body.km_google === true || mesmoTrajeto

    let rota: RotaCalculada | null = null
    if (mapsAtivo()) {
        rota = await calcularRota(origem, paradas, destino, idaEVolta).catch(err => {
            console.error('[gasolina] Rota não calculada ao salvar a viagem:', err)
            return null
        })
    }
    let km = distancia
    if (kmGoogle) {
        if (!rota) return erro('Não foi possível confirmar a distância no Google Maps agora. Tente salvar de novo em instantes.', 502)
        km = rota.distancia_km
        rota = { ...rota, km_google: true }
    }

    return {
        ok: true,
        viagem: {
            veiculo_id: veiculo.id,
            centro_custo_id: centro.id,
            projeto,
            origem_local: origem,
            destino_local: destino,
            paradas,
            distancia_km: km,
            data_viagem: data,
            rota,
        },
        autonomia: Number(veiculo.autonomia_km_l),
    }
}
