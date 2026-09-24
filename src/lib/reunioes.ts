// Reuniões com presença por QR code — regras compartilhadas pelas rotas de
// API e pelo agendador. Só roda no servidor (usa AUTH_SECRET).
// Ver supabase/migrations/20260924_reunioes_presenca_qr.sql.
//
// Fases de uma reunião (sempre comparadas no servidor, nunca no relógio do
// celular do membro):
//   até limite_chegada           → QR code aceito, membro fica "presente"
//   limite_chegada..encerramento → só o código de atraso, membro fica
//                                  "atrasado" e ganha uma pré-pontuação
//   depois do encerramento       → quem não confirmou vira falta
//                                  (pré-pontuação gerada pelo job abaixo)
import { createHmac, timingSafeEqual } from 'crypto'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { CARGO_FANTASMA } from '@/lib/cargos'
import { isSchemaDesatualizado, type ErroPostgrest } from '@/lib/db-compat'

export const PAGINA_GESTAO_REUNIOES = '/reunioes-management'

// O QR muda a cada 30s: uma foto do QR mandada no grupo para quem não está
// na sala para de funcionar em pouco tempo. A tolerância de algumas janelas
// cobre quem leu o QR e precisou fazer login antes de confirmar.
export const JANELA_QR_MS = 30_000
const JANELAS_TOLERADAS = 4

const FUSO = 'America/Sao_Paulo'

export type FaseReuniao = 'qr' | 'codigo' | 'encerrada' | 'cancelada'

export interface Reuniao {
    id: string
    titulo: string
    descricao: string | null
    local: string | null
    inicio: string
    limite_chegada: string
    encerramento: string
    status: 'agendada' | 'cancelada'
    criado_por: string | null
    faltas_processadas_em: string | null
    criado_em: string
}

function segredo(): string {
    const s = process.env.AUTH_SECRET
    if (!s) throw new Error('AUTH_SECRET não configurado — necessário para gerar o QR code das reuniões.')
    return s
}

function hmac(mensagem: string): Buffer {
    return createHmac('sha256', segredo()).update(mensagem).digest()
}

function janelaAtual(agora = Date.now()): number {
    return Math.floor(agora / JANELA_QR_MS)
}

function tokenDaJanela(reuniaoId: string, janela: number): string {
    return hmac(`reuniao-qr:${reuniaoId}:${janela}`).toString('base64url').slice(0, 22)
}

export function tokenQrAtual(reuniaoId: string, agora = Date.now()) {
    const janela = janelaAtual(agora)
    return {
        token: tokenDaJanela(reuniaoId, janela),
        expiraEm: (janela + 1) * JANELA_QR_MS,
    }
}

function iguais(a: string, b: string): boolean {
    const ba = Buffer.from(a)
    const bb = Buffer.from(b)
    return ba.length === bb.length && timingSafeEqual(ba, bb)
}

export function tokenQrValido(reuniaoId: string, token: string, agora = Date.now()): boolean {
    const janela = janelaAtual(agora)
    for (let i = 0; i <= JANELAS_TOLERADAS; i++) {
        if (iguais(tokenDaJanela(reuniaoId, janela - i), token)) return true
    }
    return false
}

// Código numérico de 6 dígitos, fixo por reunião, exibido na tela do
// organizador só depois do limite de chegada.
export function codigoAtraso(reuniaoId: string): string {
    const n = hmac(`reuniao-codigo:${reuniaoId}`).readUInt32BE(0) % 1_000_000
    return String(n).padStart(6, '0')
}

export function codigoAtrasoValido(reuniaoId: string, codigo: string): boolean {
    return iguais(codigoAtraso(reuniaoId), codigo.replace(/\D/g, ''))
}

export function faseReuniao(r: Pick<Reuniao, 'status' | 'limite_chegada' | 'encerramento'>, agora = Date.now()): FaseReuniao {
    if (r.status === 'cancelada') return 'cancelada'
    if (agora < new Date(r.limite_chegada).getTime()) return 'qr'
    if (agora < new Date(r.encerramento).getTime()) return 'codigo'
    return 'encerrada'
}

export function dataReuniaoLabel(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-BR', { timeZone: FUSO, day: '2-digit', month: '2-digit', year: 'numeric' })
}

// YYYY-MM-DD no fuso de Brasília — mesmo formato de ausencias.data_ida/volta.
function dataIso(iso: string): string {
    return new Date(iso).toLocaleDateString('en-CA', { timeZone: FUSO })
}

export function descricaoPrePontuacao(r: Pick<Reuniao, 'titulo' | 'inicio'>, tipo: 'atraso' | 'falta'): string {
    const rotulo = tipo === 'atraso' ? 'Atraso na reunião' : 'Falta na reunião'
    return `${rotulo}: ${r.titulo} - ${dataReuniaoLabel(r.inicio)}`
}

// Sem a migração, o erro cru do PostgREST não diz o que fazer — este diz.
export function mensagemErroBanco(error: ErroPostgrest, acao: string): string {
    if (isSchemaDesatualizado(error)) {
        return 'O banco ainda não tem as tabelas de reuniões. Aplique a migração supabase/migrations/20260924_reunioes_presenca_qr.sql e tente de novo.'
    }
    return `Erro ao ${acao}: ${error.message}`
}

// Mesmo corte do RouteGuard/AppSidebar: admin vê tudo, paginas_permitidas
// null significa "sem restrição", senão a página precisa estar liberada.
export async function podeGerenciarReunioes(colaboradorId: string | undefined, role: string | undefined): Promise<boolean> {
    if ((role || '').toUpperCase() === 'ADMIN') return true
    if (!colaboradorId) return false
    const supabase = createServerSupabaseClient()
    const { data } = await supabase
        .from('colaboradores')
        .select('paginas_permitidas')
        .eq('id', colaboradorId)
        .single()
    const paginas: string[] | null = data?.paginas_permitidas ?? null
    return !paginas || paginas.includes(PAGINA_GESTAO_REUNIOES)
}

// Gera as faltas das reuniões já encerradas que ainda não foram processadas.
// Idempotente: cada reunião é "reivindicada" com um UPDATE condicional antes
// de inserir, então duas execuções simultâneas (agendador + abertura da
// tela de gestão) não geram pré-pontuação em dobro.
export async function processarReunioesEncerradas(): Promise<number> {
    const supabase = createServerSupabaseClient()
    const agoraIso = new Date().toISOString()

    const { data: pendentes, error } = await supabase
        .from('reunioes')
        .select('*')
        .eq('status', 'agendada')
        .is('faltas_processadas_em', null)
        .lt('encerramento', agoraIso)
    if (error || !pendentes?.length) return 0

    let total = 0
    for (const reuniao of pendentes as Reuniao[]) {
        const { data: reivindicada } = await supabase
            .from('reunioes')
            .update({ faltas_processadas_em: agoraIso })
            .eq('id', reuniao.id)
            .is('faltas_processadas_em', null)
            .select('id')
        if (!reivindicada?.length) continue

        const dia = dataIso(reuniao.inicio)
        const [{ data: participantes }, { data: presencas }, { data: ausencias }] = await Promise.all([
            supabase
                .from('reuniao_participantes')
                .select('colaborador_id, colaboradores(status, cargo_atual)')
                .eq('reuniao_id', reuniao.id),
            supabase.from('reuniao_presencas').select('colaborador_id').eq('reuniao_id', reuniao.id),
            // Ausência aprovada cobrindo o dia da reunião não gera falta.
            supabase
                .from('ausencias')
                .select('colaborador_id')
                .eq('status', 'APROVADA')
                .lte('data_ida', dia)
                .gte('data_volta', dia),
        ])

        const confirmados = new Set((presencas || []).map((p: any) => p.colaborador_id))
        const ausentesJustificados = new Set((ausencias || []).map((a: any) => a.colaborador_id))
        const descricao = descricaoPrePontuacao(reuniao, 'falta')

        const rows = (participantes || [])
            .filter((p: any) => p.colaboradores?.status !== 'Desligado' && p.colaboradores?.cargo_atual !== CARGO_FANTASMA)
            .filter((p: any) => !confirmados.has(p.colaborador_id) && !ausentesJustificados.has(p.colaborador_id))
            .map((p: any) => ({
                colaborador_id: p.colaborador_id,
                reuniao_id: reuniao.id,
                descricao,
                origem: 'auto',
                status: 'PENDENTE',
            }))

        if (rows.length > 0) {
            const { error: insErr } = await supabase.from('pontos_pre_pontuacao').insert(rows)
            if (insErr) {
                // Devolve a reunião para a fila — a próxima execução tenta de novo.
                await supabase.from('reunioes').update({ faltas_processadas_em: null }).eq('id', reuniao.id)
                console.error('[reunioes] Falha ao gerar faltas da reunião', reuniao.id, insErr.message)
                continue
            }
        }
        total += rows.length
    }
    return total
}
