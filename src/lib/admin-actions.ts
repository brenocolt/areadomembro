'use server';

import bcrypt from 'bcryptjs';
import { createServerSupabaseClient } from '@/lib/supabase-server';
import { exigirPagina, nivelGestaoUsuarios, SEM_PERMISSAO } from '@/lib/server-auth';
import { isAdmin, isEstrategicoOuAdmin } from '@/lib/access-control';
import { randomBytes } from 'crypto';

export async function approveAccountRequest(id: string) {
    if (!(await exigirPagina('/users-management'))) return { success: false, error: SEM_PERMISSAO };
    const supabase = createServerSupabaseClient();

    // 1. Get the request
    const { data: req, error: reqError } = await supabase
        .from('solicitacoes_conta')
        .select('*')
        .eq('id', id)
        .single();

    if (reqError || !req) {
        return { success: false, error: reqError?.message || 'Solicitação não encontrada.' };
    }

    if (req.status !== 'PENDENTE') {
        return { success: false, error: 'A solicitação já foi processada.' };
    }

    // 2. Hash password
    const hashedPassword = await bcrypt.hash(req.senha, 10);

    // 2.5. Fetch pre-cadastro data for pontos and milhas
    let pontosAcumulados = 0;
    let milhasIniciais = 0;
    let nivelConsultor = 'Júnior';
    let projetos = 0;
    let saldoPipj = 0;
    let npsDataToImport: Record<string, unknown>[] = [];

    if (req.membro_pre_cadastro_id) {
        const { data: preCad } = await supabase
            .from('membros_pre_cadastro')
            .select('pontos_acumulados, milhas, nivel_consultor, projetos, saldo_pipj, nps_data')
            .eq('id', req.membro_pre_cadastro_id)
            .single();
        if (preCad) {
            pontosAcumulados = preCad.pontos_acumulados || 0;
            milhasIniciais = preCad.milhas || 0;
            nivelConsultor = preCad.nivel_consultor || 'Júnior';
            projetos = preCad.projetos || 0;
            saldoPipj = Number(preCad.saldo_pipj) || 0;
            npsDataToImport = preCad.nps_data || [];
        }
    }

    // 2.8. Check for duplicate CPF
    if (req.cpf) {
        const { data: existingCpf } = await supabase
            .from('colaboradores')
            .select('id, nome')
            .eq('cpf', req.cpf)
            .maybeSingle();
        if (existingCpf) {
            return { success: false, error: `O CPF ${req.cpf} já está cadastrado para "${existingCpf.nome}". Verifique se o CPF está correto ou exclua o colaborador existente primeiro.` };
        }
    }

    // 2.9. Check for duplicate email
    if (req.email_corporativo) {
        const { data: existingEmail } = await supabase
            .from('colaboradores')
            .select('id, nome')
            .eq('email_corporativo', req.email_corporativo)
            .maybeSingle();
        if (existingEmail) {
            return { success: false, error: `O email ${req.email_corporativo} já está cadastrado para "${existingEmail.nome}". Verifique se o email está correto.` };
        }
    }

    // 3. Create Colaborador
    const { data: newColaborador, error: colabError } = await supabase
        .from('colaboradores')
        .insert({
            nome: req.nome,
            cargo_atual: req.cargo,
            nucleo_atual: req.nucleo,
            safra: req.safra,
            semestre_ingresso: req.semestre_ingresso,
            data_nascimento: req.data_nascimento,
            cpf: req.cpf,
            endereco: req.endereco,
            matricula: req.matricula,
            telefone: req.telefone,
            email_pessoal: req.email_pessoal,
            email_corporativo: req.email_corporativo,
            hobby: req.hobby,
            chocolate_favorito: req.chocolate_favorito,
            serie_filme_favorito: req.serie_filme_favorito,
            pontos_negativos: pontosAcumulados,
            nivel_consultor: nivelConsultor,
            projetos: projetos,
            saldo_pipj: saldoPipj,
            // Sem exceção manual — o acesso padrão já vem do cargo/núcleo
            // (ver src/lib/access-control.ts). paginas_permitidas só soma
            // páginas além disso, concedidas depois por quem tem tier 3 em
            // Gestão de Usuários.
            paginas_permitidas: null,
        })
        .select('id')
        .single();

    if (colabError || !newColaborador) {
        return { success: false, error: 'Erro ao criar perfil de colaborador: ' + colabError?.message };
    }

    // 4. Create User Access
    const { error: userError } = await supabase
        .from('users')
        .insert({
            email: req.email_corporativo,
            senha: hashedPassword,
            role: 'COLABORADOR',
            colaborador_id: newColaborador.id,
            // id column uses default gen_random_uuid(), but wait!
            // According to earlier logic: "1-Coloque o mesmo id nas tabelas de users e colaboradores. o id de user é diferente do id na table de colaborador quero que coloque o mesmo id nos dois"
            // So we MUST set users.id = newColaborador.id!
            id: newColaborador.id
        });

    if (userError) {
        // Rollback colaborador? Supabase REST API doesn't easily do transactions without RPC.
        // We will just return the error.
        return { success: false, error: 'Erro ao criar acesso de usuário: ' + userError.message };
    }

    // 4.5. Initialize milhas_saldo with values from pre-cadastro
    const { error: saldoError } = await supabase
        .from('milhas_saldo')
        .insert({
            colaborador_id: newColaborador.id,
            saldo_total: milhasIniciais,
            saldo_disponivel: milhasIniciais,
        });

    if (saldoError) {
        return { success: false, error: 'Erro ao inicializar saldo de milhas: ' + saldoError.message };
    }

    // 4.6. Mark membros_pre_cadastro as conta_criada = true
    if (req.membro_pre_cadastro_id) {
        await supabase
            .from('membros_pre_cadastro')
            .update({ conta_criada: true })
            .eq('id', req.membro_pre_cadastro_id);
    }

    // 4.7 Copy NPS Data
    if (npsDataToImport && npsDataToImport.length > 0) {
        const npsInsertions = npsDataToImport.map((nps: Record<string, unknown>) => ({
            colaborador_id: newColaborador.id,
            mes: nps.mes,
            ano: nps.ano,
            nps_geral: nps.nps_geral,
            comunicacao: nps.comunicacao,
            suporte: nps.suporte,
            relacionamento: nps.relacionamento,
            resolutividade: nps.resolutividade,
            lideranca: nps.lideranca,
            dedicacao: nps.dedicacao,
            confianca: nps.confianca,
            pontualidade: nps.pontualidade,
            organizacao: nps.organizacao,
            proatividade: nps.proatividade,
            qualidade_entregas: nps.qualidade_entregas,
            dominio_tecnico: nps.dominio_tecnico
        }));

        const { error: npsError } = await supabase
            .from('avaliacoes_nps')
            .insert(npsInsertions);

        if (npsError) {
             console.error("Failed inserting NPS data:", npsError);
        }
    }

    // 5. Update Request Status
    await supabase.from('solicitacoes_conta').update({ status: 'APROVADA' }).eq('id', id);

    return { success: true };
}

export async function desligarMembro(colaboradorId: string) {
    if (!(await exigirPagina('/users-management'))) return { success: false, error: SEM_PERMISSAO };
    const supabase = createServerSupabaseClient();

    const { error } = await supabase
        .from('colaboradores')
        .update({ status: 'Desligado', desligado_em: new Date().toISOString() })
        .eq('id', colaboradorId);

    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true };
}

export async function reativarMembro(colaboradorId: string) {
    if (!(await exigirPagina('/users-management'))) return { success: false, error: SEM_PERMISSAO };
    const supabase = createServerSupabaseClient();

    const { error } = await supabase
        .from('colaboradores')
        .update({ status: 'Ativo', desligado_em: null })
        .eq('id', colaboradorId);

    if (error) {
        return { success: false, error: error.message };
    }
    return { success: true };
}

export async function deleteUserCompletely(colaboradorId: string) {
    // Apaga tudo do membro: só o nível mais alto da Gestão de Usuários.
    const chamador = await exigirPagina('/users-management');
    if (!chamador || nivelGestaoUsuarios(chamador) < 3) return { success: false, error: SEM_PERMISSAO };
    const supabase = createServerSupabaseClient();

    // 1. Get colaborador email to find related solicitacoes_conta and membros_pre_cadastro
    const { data: colab } = await supabase
        .from('colaboradores')
        .select('email_corporativo')
        .eq('id', colaboradorId)
        .single();

    // 2. Delete from ALL tables that reference colaborador_id
    // First delete formulario response items (child records). Cobre tanto
    // respostas escritas pelo colaborador quanto — em formulários
    // direcionados — respostas de OUTRAS pessoas que são sobre ele
    // (alvo_colaborador_id), já que a coluna não tem ON DELETE CASCADE.
    const { data: respostas } = await supabase
        .from('formulario_respostas')
        .select('id')
        .or(`colaborador_id.eq.${colaboradorId},alvo_colaborador_id.eq.${colaboradorId}`);
    if (respostas && respostas.length > 0) {
        const respostaIds = respostas.map(r => r.id);
        await supabase.from('formulario_respostas_itens').delete().in('resposta_id', respostaIds);
        await supabase.from('formulario_respostas').delete().in('id', respostaIds);
    }

    await supabase.from('ausencias').delete().eq('colaborador_id', colaboradorId);
    await supabase.from('avaliacoes_nps').delete().eq('colaborador_id', colaboradorId);
    await supabase.from('citacoes').delete().eq('colaborador_id', colaboradorId);
    await supabase.from('historico_cargos').delete().eq('colaborador_id', colaboradorId);
    await supabase.from('milhas_saldo').delete().eq('colaborador_id', colaboradorId);
    await supabase.from('milhas_trocas').delete().eq('colaborador_id', colaboradorId);
    await supabase.from('ocorrencias').delete().eq('colaborador_id', colaboradorId);
    await supabase.from('projetos_finalizados').delete().eq('colaborador_id', colaboradorId);
    await supabase.from('resgates_beneficios').delete().eq('colaborador_id', colaboradorId);
    await supabase.from('solicitacoes_remocao').delete().eq('colaborador_id', colaboradorId);
    await supabase.from('solicitacoes_saque').delete().eq('colaborador_id', colaboradorId);
    await supabase.from('transacoes_pipj').delete().eq('colaborador_id', colaboradorId);

    // 3. Delete user access
    const { error: userErr } = await supabase.from('users').delete().eq('colaborador_id', colaboradorId);
    if (userErr) {
        return { success: false, error: 'Erro ao deletar acesso de usuário: ' + userErr.message };
    }

    // 4. Delete colaborador profile
    const { error: colabErr } = await supabase.from('colaboradores').delete().eq('id', colaboradorId);
    if (colabErr) {
        return { success: false, error: 'Erro ao deletar perfil do colaborador: ' + colabErr.message };
    }

    // 5. Delete related solicitacoes_conta and reset membros_pre_cadastro
    if (colab?.email_corporativo) {
        await supabase.from('solicitacoes_conta').delete().eq('email_corporativo', colab.email_corporativo);
        await supabase.from('membros_pre_cadastro').update({ conta_criada: false }).eq('email_corporativo', colab.email_corporativo);
    }

    return { success: true };
}

// Gera uma senha temporária para um membro que esqueceu a dele (substitui a
// recuperação por CPF, suspensa por segurança). Quem gera repassa a senha ao
// membro por um canal confiável; ele troca no Perfil depois de entrar.
export async function gerarSenhaTemporaria(colaboradorId: string) {
    const chamador = await exigirPagina('/users-management');
    if (!chamador) return { success: false, error: SEM_PERMISSAO };

    const supabase = createServerSupabaseClient();
    const [{ data: alvo }, { data: user }] = await Promise.all([
        supabase.from('colaboradores').select('cargo_atual').eq('id', colaboradorId).maybeSingle(),
        supabase.from('users').select('id, role').eq('colaborador_id', colaboradorId).maybeSingle(),
    ]);
    if (!user) return { success: false, error: 'Este membro ainda não tem acesso ao portal.' };

    // Trocar a senha de um administrador ou do Estratégico daria acesso total:
    // só o nível mais alto da Gestão de Usuários pode.
    const alvoSensivel = isAdmin(user.role) || isEstrategicoOuAdmin(alvo?.cargo_atual);
    if (alvoSensivel && nivelGestaoUsuarios(chamador) < 3) {
        return { success: false, error: 'Só o Estratégico ou um administrador pode trocar a senha desta pessoa.' };
    }

    const senha = randomBytes(9).toString('base64url');
    const { error } = await supabase
        .from('users')
        .update({ senha: await bcrypt.hash(senha, 10) })
        .eq('id', user.id);
    if (error) return { success: false, error: 'Não foi possível salvar a nova senha. Tente de novo.' };

    return { success: true, senha };
}
