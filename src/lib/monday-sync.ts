// Sincroniza a tabela `projetos` e a alocação de projetos por colaborador
// (colaboradores.projetos) com o board do Monday.com configurado em
// MONDAY_BOARD_ID. Extraído de src/app/api/monday/projects/route.ts para ser
// chamado tanto pela rota (sincronização manual/sob demanda) quanto pelo job
// agendado em src/instrumentation.ts (sincronização automática, já que o app
// roda num VPS como processo persistente — não há Cron Jobs de plataforma
// como no Vercel).
import { createClient } from '@supabase/supabase-js'
import { CARGO_FANTASMA } from './cargos'
import { ProjetoAtivoDetalhe } from './pipj-projetos'
import { MONDAY_API_TOKEN, mondayRequest } from './monday'
import { buscarTodasPaginas } from './paginacao'

const MONDAY_BOARD_ID = process.env.MONDAY_BOARD_ID || ''
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

type MondayItemsPage = { cursor?: string | null; items?: any[] }

async function fetchMondayItemsPage(cursor: string | null): Promise<MondayItemsPage> {
    const query: string = cursor
        ? `query($cursor: String!) {
            next_items_page(cursor: $cursor, limit: 500) {
                cursor
                items { id name column_values { id text value } }
            }
        }`
        : `{
            boards(ids: [${MONDAY_BOARD_ID}]) {
                items_page(limit: 500) {
                    cursor
                    items { id name column_values { id text value } }
                }
            }
        }`

    const data = await mondayRequest(query, cursor ? { cursor } : undefined)
    return (cursor ? data?.next_items_page : data?.boards?.[0]?.items_page) || {}
}

// items_page só retorna até 500 itens por página. Boards com mais itens
// precisam ser paginados com o cursor retornado, senão itens além do
// primeiro lote nunca são sincronizados.
async function fetchAllMondayItems(): Promise<any[]> {
    const allItems: any[] = []
    let cursor: string | null = null
    const MAX_PAGES = 50 // trava de segurança (até 25 mil itens)

    for (let page = 0; page < MAX_PAGES; page++) {
        const itemsPage = await fetchMondayItemsPage(cursor)
        allItems.push(...(itemsPage.items || []))

        cursor = itemsPage.cursor || null
        if (!cursor) break
    }

    return allItems
}

async function fetchMondayColumns(): Promise<{ id: string; title: string }[]> {
    const data = await mondayRequest(`{
        boards(ids: [${MONDAY_BOARD_ID}]) {
            columns { id title }
        }
    }`)
    return data?.boards?.[0]?.columns || []
}

// Colunas de data são descobertas pelo título — não dependem de um ID fixo
// de coluna no Monday, então continuam funcionando mesmo se o board for
// reorganizado.
function discoverDateColumns(columns: { id: string; title: string }[]) {
    const colunaDataInicio = columns.find(c => /in[íi]cio/i.test(c.title)) || null
    const colunaDataFim = columns.find(c => /fim|t[ée]rmino|conclus[ãa]o/i.test(c.title)) || null
    return { colunaDataInicio, colunaDataFim }
}

// Busca o e-mail de cada pessoa do Monday, em lotes (a API aceita uma lista
// de IDs, mas evitamos mandar milhares de uma vez).
async function fetchMondayUserEmails(userIds: number[]): Promise<Map<number, string>> {
    const emailById = new Map<number, string>()
    const LOTE = 100

    for (let i = 0; i < userIds.length; i += LOTE) {
        const lote = userIds.slice(i, i + LOTE)
        if (lote.length === 0) continue
        const data = await mondayRequest(`{ users(ids: [${lote.join(',')}]) { id email } }`)
        for (const u of data?.users || []) {
            if (u?.id && u?.email) emailById.set(Number(u.id), String(u.email).toLowerCase().trim())
        }
    }

    return emailById
}

// Extrai os IDs de pessoa do valor bruto (JSON) de uma coluna do tipo
// "people"/"person". Formatos possíveis:
// - people (atual): {"personsAndTeams":[{"id":123,"kind":"person"}, ...]}
// - person (legado): {"id":123,"changed_at":"..."}
function extrairPersonIds(rawValue: string | null | undefined): number[] {
    if (!rawValue) return []
    try {
        const parsed = JSON.parse(rawValue)
        if (Array.isArray(parsed?.personsAndTeams)) {
            return parsed.personsAndTeams
                .filter((p: any) => !p.kind || p.kind === 'person')
                .map((p: any) => Number(p.id))
                .filter((id: number) => !isNaN(id))
        }
        if (parsed?.id) {
            const id = Number(parsed.id)
            return isNaN(id) ? [] : [id]
        }
    } catch {
        // valor vazio ou não é JSON (coluna sem ninguém atribuído)
    }
    return []
}

function normalizeMondayStatus(statusText: string): 'Ativo' | 'Concluído' | 'Pausado' {
    const t = (statusText || '').toLowerCase()
    if (t.includes('finalizado') || t.includes('conclu') || t.includes('done')) return 'Concluído'
    if (t.includes('rescindido') || t.includes('cancelado')) return 'Concluído'
    if (t.includes('parado') || t.includes('pausado')) return 'Pausado'
    return 'Ativo'
}

export type SyncResult =
    | { skipped: true; reason: string }
    | { synced: number; added?: number; total?: number; message?: string }

export async function syncMondayProjects(): Promise<SyncResult> {
    if (!MONDAY_API_TOKEN || !MONDAY_BOARD_ID) {
        return { skipped: true, reason: 'Monday API not configured' }
    }

    const [columns, items] = await Promise.all([fetchMondayColumns(), fetchAllMondayItems()])
    if (items.length === 0) {
        return { synced: 0, message: 'No items found on Monday board' }
    }

    const { colunaDataInicio, colunaDataFim } = discoverDateColumns(columns)

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    const { data: existingProjects } = await supabase.from('projetos').select('id, nome, data_fim')
    const existingByName = new Map((existingProjects || []).map(p => [p.nome?.toLowerCase().trim(), p]))

    let synced = 0
    let added = 0

    for (const item of items) {
        const nome = item.name?.trim()
        if (!nome) continue
        const key = nome.toLowerCase().trim()

        const statusCol = item.column_values?.find((c: any) => c.id === 'status')
        const status = normalizeMondayStatus(statusCol?.text?.trim() || '')

        const dataInicioCol = colunaDataInicio && item.column_values?.find((c: any) => c.id === colunaDataInicio!.id)
        const dataInicio = dataInicioCol?.text?.trim() || null

        const existente = existingByName.get(key)

        // data_fim: prioriza a coluna explícita de fim/término do Monday
        // quando existir. Sem ela, auto-rastreia — grava a data da primeira
        // sincronização em que o status vira "Concluído" e nunca mais
        // sobrescreve (mantém o histórico mesmo que o board não tenha essa
        // coluna). Se o projeto voltar a ficar ativo, limpa de novo.
        const dataFimCol = colunaDataFim && item.column_values?.find((c: any) => c.id === colunaDataFim!.id)
        const dataFimExplicita = dataFimCol?.text?.trim() || null
        const dataFim = dataFimExplicita
            ? dataFimExplicita
            : status === 'Concluído'
                ? (existente?.data_fim || new Date().toISOString().slice(0, 10))
                : null

        if (!existente) {
            const { error } = await supabase
                .from('projetos')
                .insert({ nome, status, data_inicio: dataInicio, data_fim: dataFim })

            if (!error) {
                added++
                existingByName.set(key, { id: '', nome, data_fim: dataFim } as any)
            }
        } else {
            await supabase
                .from('projetos')
                .update({ status, data_inicio: dataInicio, data_fim: dataFim })
                .eq('id', existente.id)
        }
        synced++
    }

    return { synced, added, total: items.length }
}

// ─── Alocação de projetos por colaborador (colaboradores.projetos) ─────────
//
// Conta, para cada colaborador, quantos itens do board estão com status
// "Em execução" (normalizado para 'Ativo') e têm esse colaborador em alguma
// coluna de pessoas cujo título contenha "geren" ou "consultor" (ex.:
// "Gerente", "Consultores") — um mesmo projeto conta para todos os
// colaboradores alocados nele. O vínculo Monday → colaborador é feito por
// e-mail corporativo, já que não existe nenhum ID do Monday salvo no
// Supabase.
//
// Projetos concluídos também entram em projetos_ativos_detalhe (com
// status: 'Concluído' e a data de fim) — servem de histórico pro cálculo
// de PIPJ de meses passados (ver src/lib/pipj-projetos.ts), mesmo depois
// de saírem do board como "ativos". colaboradores.projetos, por sua vez,
// continua contando só os Ativos (é "quantos projetos essa pessoa toca
// agora").
//
// dryRun (padrão true nas rotas manuais) só calcula e retorna o que mudaria
// em colaboradores.projetos*, sem gravar nada nessa tabela — mas sempre
// roda syncMondayProjects primeiro (grava de verdade em `projetos`, é a
// mesma sincronização que já roda todo dia automaticamente), pra garantir
// que data_inicio/data_fim estejam atualizados antes de montar o detalhe.

export type AlocacaoColaborador = {
    colaborador_id: string
    nome: string
    email: string
    valor_antigo: number
    valor_novo: number
    projetos_ativos: ProjetoAtivoDetalhe[]
}

export type AlocacaoResult =
    | { skipped: true; reason: string }
    | {
        dryRun: boolean
        totalItensAtivos: number
        colunasConsideradas: { id: string; title: string }[]
        colunaDataInicio: string | null
        colunaDataFim: string | null
        alterados: AlocacaoColaborador[]
        emailsNaoEncontrados: string[]
    }

export async function syncMondayAlocacoes(opts?: { dryRun?: boolean }): Promise<AlocacaoResult> {
    const dryRun = opts?.dryRun !== false

    if (!MONDAY_API_TOKEN || !MONDAY_BOARD_ID) {
        return { skipped: true, reason: 'Monday API not configured' }
    }

    // Roda a sincronização de `projetos` primeiro, pra ter data_inicio/
    // data_fim atualizados (incluindo o auto-rastreamento de finalização)
    // antes de montar o histórico de cada colaborador.
    await syncMondayProjects()

    const [columns, items] = await Promise.all([fetchMondayColumns(), fetchAllMondayItems()])

    const colunasPessoas = columns.filter(c => /geren|consultor/i.test(c.title))
    if (colunasPessoas.length === 0) {
        return { skipped: true, reason: 'Nenhuma coluna de "Gerente" ou "Consultores" encontrada no board' }
    }

    const { colunaDataInicio, colunaDataFim } = discoverDateColumns(columns)

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    const { data: projetosSincronizados } = await supabase.from('projetos').select('nome, data_inicio, data_fim')
    const datasPorNomeProjeto = new Map(
        (projetosSincronizados || []).map(p => [p.nome?.toLowerCase().trim(), { data_inicio: p.data_inicio, data_fim: p.data_fim }])
    )

    // 1ª passada: descobre quais itens estão ativos ou concluídos, nome/
    // status/datas de cada um, e quais IDs de pessoa aparecem nas colunas
    // relevantes desses itens.
    const itensRelevantes: { nome: string; status: 'Ativo' | 'Concluído'; dataInicio: string | null; dataFim: string | null; personIds: number[] }[] = []
    const todosPersonIds = new Set<number>()
    let totalItensAtivos = 0

    for (const item of items) {
        const statusCol = item.column_values?.find((c: any) => c.id === 'status')
        const status = normalizeMondayStatus(statusCol?.text?.trim() || '')
        if (status !== 'Ativo' && status !== 'Concluído') continue
        if (status === 'Ativo') totalItensAtivos++

        const personIds: number[] = []
        for (const col of colunasPessoas) {
            const valueCol = item.column_values?.find((c: any) => c.id === col.id)
            for (const id of extrairPersonIds(valueCol?.value)) {
                personIds.push(id)
                todosPersonIds.add(id)
            }
        }

        const nome = item.name?.trim() || '(sem nome)'
        const datasSincronizadas = datasPorNomeProjeto.get(nome.toLowerCase().trim())

        itensRelevantes.push({
            nome,
            status,
            dataInicio: datasSincronizadas?.data_inicio || null,
            dataFim: datasSincronizadas?.data_fim || null,
            personIds,
        })
    }

    const emailById = await fetchMondayUserEmails(Array.from(todosPersonIds))

    // 2ª passada: agrupa, por e-mail, os itens (nome + status + datas) em
    // que cada pessoa aparece.
    const projetosPorEmail = new Map<string, ProjetoAtivoDetalhe[]>()
    for (const item of itensRelevantes) {
        const emailsUnicos = new Set(item.personIds.map(id => emailById.get(id)).filter((e): e is string => !!e))
        for (const email of emailsUnicos) {
            if (!projetosPorEmail.has(email)) projetosPorEmail.set(email, [])
            projetosPorEmail.get(email)!.push({ nome: item.nome, status: item.status, data_inicio: item.dataInicio, data_fim: item.dataFim })
        }
    }

    const { data: colaboradores } = await supabase
        .from('colaboradores')
        .select('id, nome, email_corporativo, projetos')
        .eq('status', 'Ativo')
        .neq('cargo_atual', CARGO_FANTASMA)

    const emailsUsados = new Set<string>()
    const todos: AlocacaoColaborador[] = []
    const alterados: AlocacaoColaborador[] = []

    for (const colab of colaboradores || []) {
        const email = (colab.email_corporativo || '').toLowerCase().trim()
        if (!email) continue

        const projetosAtivos = projetosPorEmail.get(email) || []
        // colaboradores.projetos conta só os Ativos agora — os concluídos
        // ficam em projetos_ativos_detalhe (histórico), mas não entram
        // nesse número "quantos projetos essa pessoa toca agora".
        const valorNovo = projetosAtivos.filter(p => p.status === 'Ativo').length
        if (projetosPorEmail.has(email)) emailsUsados.add(email)

        const valorAntigo = Number(colab.projetos || 0)
        const registro: AlocacaoColaborador = {
            colaborador_id: colab.id,
            nome: colab.nome,
            email,
            valor_antigo: valorAntigo,
            valor_novo: valorNovo,
            projetos_ativos: projetosAtivos,
        }
        todos.push(registro)
        if (valorAntigo !== valorNovo) alterados.push(registro)
    }

    const emailsNaoEncontrados = Array.from(projetosPorEmail.keys()).filter(e => !emailsUsados.has(e))

    if (!dryRun) {
        // O campo `projetos` (e o audit_log) só muda quando a contagem muda
        // de verdade, mas o detalhe (projetos_ativos_detalhe) é atualizado
        // sempre, pra nunca ficar com uma lista de nomes desatualizada.
        for (const registro of todos) {
            const update: Record<string, any> = { projetos_ativos_detalhe: registro.projetos_ativos }
            if (registro.valor_antigo !== registro.valor_novo) update.projetos = registro.valor_novo

            await supabase.from('colaboradores').update(update).eq('id', registro.colaborador_id)

            if (registro.valor_antigo !== registro.valor_novo) {
                await supabase.from('audit_logs').insert({
                    colaborador_id: registro.colaborador_id,
                    campo: 'projetos',
                    valor_antigo: String(registro.valor_antigo),
                    valor_novo: String(registro.valor_novo),
                    editado_por: 'Monday Sync',
                })
            }
        }
    }

    return {
        dryRun,
        totalItensAtivos,
        colunasConsideradas: colunasPessoas,
        colunaDataInicio: colunaDataInicio?.title || null,
        colunaDataFim: colunaDataFim?.title || null,
        alterados,
        emailsNaoEncontrados,
    }
}


// ─── Equipe de cada projeto (tabela projeto_equipe) ────────────────────────
//
// Guarda, para cada projeto ATIVO do board, quem é o gerente (coluna cujo
// título contém "geren") e quem são os consultores (coluna cujo título
// contém "consultor"). É o que permite ao formulário NPS Projetos já
// mostrar, para cada membro, os projetos dele e quem ele precisa avaliar.
//
// Não mexe em colaboradores.projetos (contagem usada no PIPJ) — por isso
// pode rodar todo dia, sem a trava de "dry run" da syncMondayAlocacoes.
// Roda DEPOIS de syncMondayProjects (precisa dos projetos já gravados).
// Só considera colaboradores ativos: quem foi desligado perde o vínculo.

export type EquipesResult =
    | { skipped: true; reason: string }
    | { projetos: number; vinculos: number; adicionados: number; removidos: number; emailsNaoEncontrados: string[]; message?: string }

type Papel = 'gerente' | 'consultor'

export async function syncMondayEquipes(): Promise<EquipesResult> {
    if (!MONDAY_API_TOKEN || !MONDAY_BOARD_ID) {
        return { skipped: true, reason: 'Monday API not configured' }
    }

    const [columns, items] = await Promise.all([fetchMondayColumns(), fetchAllMondayItems()])
    if (items.length === 0) return { projetos: 0, vinculos: 0, adicionados: 0, removidos: 0, emailsNaoEncontrados: [], message: 'No items found on Monday board' }

    // "Gerente" tem prioridade: uma coluna que cite os dois termos é tratada
    // como de gerente.
    const colunasPapel = columns
        .map(c => ({ id: c.id, papel: (/geren/i.test(c.title) ? 'gerente' : /consultor/i.test(c.title) ? 'consultor' : null) as Papel | null }))
        .filter((c): c is { id: string; papel: Papel } => c.papel !== null)
    if (colunasPapel.length === 0) {
        return { skipped: true, reason: 'Nenhuma coluna de "Gerente" ou "Consultores" encontrada no board' }
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

    const { data: projetosRows, error: erroProjetos } = await supabase.from('projetos').select('id, nome')
    if (erroProjetos) throw new Error(`Falha ao ler projetos: ${erroProjetos.message}`)
    const projetoIdPorNome = new Map((projetosRows || []).map(p => [String(p.nome || '').toLowerCase().trim(), p.id as string]))

    // 1ª passada: por projeto ativo, os IDs de pessoa de cada papel.
    const pessoasPorProjeto = new Map<string, { personId: number; papel: Papel }[]>()
    const todosPersonIds = new Set<number>()
    for (const item of items) {
        const statusCol = item.column_values?.find((c: any) => c.id === 'status')
        if (normalizeMondayStatus(statusCol?.text?.trim() || '') !== 'Ativo') continue
        const projetoId = projetoIdPorNome.get(String(item.name || '').toLowerCase().trim())
        if (!projetoId) continue

        const lista = pessoasPorProjeto.get(projetoId) || []
        for (const col of colunasPapel) {
            const valueCol = item.column_values?.find((c: any) => c.id === col.id)
            for (const personId of extrairPersonIds(valueCol?.value)) {
                lista.push({ personId, papel: col.papel })
                todosPersonIds.add(personId)
            }
        }
        pessoasPorProjeto.set(projetoId, lista)
    }

    const emailById = await fetchMondayUserEmails(Array.from(todosPersonIds))

    const { data: colaboradores, error: erroColabs } = await supabase
        .from('colaboradores')
        .select('id, email_corporativo')
        .eq('status', 'Ativo')
        .neq('cargo_atual', CARGO_FANTASMA)
    if (erroColabs) throw new Error(`Falha ao ler colaboradores: ${erroColabs.message}`)
    const colabIdPorEmail = new Map<string, string>()
    for (const c of colaboradores || []) {
        const email = String(c.email_corporativo || '').toLowerCase().trim()
        if (email) colabIdPorEmail.set(email, c.id as string)
    }

    // Estado desejado: (projeto, colaborador) -> papel. Gerente vence consultor.
    const desejado = new Map<string, { projeto_id: string; colaborador_id: string; papel: Papel }>()
    const emailsNaoEncontrados = new Set<string>()
    for (const [projetoId, pessoas] of pessoasPorProjeto.entries()) {
        for (const { personId, papel } of pessoas) {
            const email = emailById.get(personId)
            if (!email) continue
            const colabId = colabIdPorEmail.get(email)
            if (!colabId) { emailsNaoEncontrados.add(email); continue }
            const chave = `${projetoId}|${colabId}`
            const atual = desejado.get(chave)
            if (!atual || (atual.papel === 'consultor' && papel === 'gerente')) {
                desejado.set(chave, { projeto_id: projetoId, colaborador_id: colabId, papel })
            }
        }
    }

    const existentes = await buscarTodasPaginas<{ id: string; projeto_id: string; colaborador_id: string; papel: Papel }>((de, ate) =>
        supabase.from('projeto_equipe').select('id, projeto_id, colaborador_id, papel').order('id').range(de, ate))
    if (existentes.error) throw new Error(`Falha ao ler projeto_equipe (a migração 20261126_projeto_equipe.sql já foi aplicada?): ${(existentes.error as { message?: string }).message}`)

    // Trava de segurança: se o Monday devolveu itens mas NENHUMA pessoa foi
    // resolvida (ex.: falha ao buscar os e-mails), não apaga a equipe que já
    // estava gravada — melhor ficar um dia desatualizado do que zerada.
    if (desejado.size === 0 && existentes.data.length > 0) {
        return { projetos: pessoasPorProjeto.size, vinculos: 0, adicionados: 0, removidos: 0, emailsNaoEncontrados: Array.from(emailsNaoEncontrados), message: 'Nenhuma pessoa resolvida — equipes existentes mantidas.' }
    }

    const existentePorChave = new Map(existentes.data.map(e => [`${e.projeto_id}|${e.colaborador_id}`, e]))
    const paraRemover = existentes.data.filter(e => !desejado.has(`${e.projeto_id}|${e.colaborador_id}`)).map(e => e.id)
    const paraGravar = Array.from(desejado.entries())
        .filter(([chave, d]) => existentePorChave.get(chave)?.papel !== d.papel)
        .map(([, d]) => ({ ...d, atualizado_em: new Date().toISOString() }))

    const LOTE = 200
    for (let i = 0; i < paraRemover.length; i += LOTE) {
        const { error } = await supabase.from('projeto_equipe').delete().in('id', paraRemover.slice(i, i + LOTE))
        if (error) throw new Error(`Falha ao remover vínculos antigos: ${error.message}`)
    }
    for (let i = 0; i < paraGravar.length; i += LOTE) {
        const { error } = await supabase.from('projeto_equipe').upsert(paraGravar.slice(i, i + LOTE), { onConflict: 'projeto_id,colaborador_id' })
        if (error) throw new Error(`Falha ao gravar vínculos: ${error.message}`)
    }

    return {
        projetos: pessoasPorProjeto.size,
        vinculos: desejado.size,
        adicionados: paraGravar.length,
        removidos: paraRemover.length,
        emailsNaoEncontrados: Array.from(emailsNaoEncontrados),
    }
}
