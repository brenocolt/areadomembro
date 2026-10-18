-- Exclusão definitiva da conta de teste (TESTE) do banco de dados.
-- Identificação: colaboradores.email_corporativo = 'joaogabrielcavalcanticg@gmail.com'
-- e colaboradores.matricula = '20260001234'.
--
-- PASSO 1 (rode isto primeiro e confira o resultado antes de continuar):
-- deve retornar exatamente 1 linha, com o email e a matrícula batendo.
SELECT id, nome, email_corporativo, matricula, cargo_atual, nucleo_atual
FROM colaboradores
WHERE email_corporativo = 'joaogabrielcavalcanticg@gmail.com'
   OR matricula = '20260001234';

-- PASSO 2: depois de confirmar que o PASSO 1 retornou a conta de teste certa
-- (e só ela), rode o bloco abaixo. Ele resolve o id a partir das DUAS
-- condições (email + matrícula) e aborta se elas não baterem na mesma linha,
-- então limpa as referências que não têm ON DELETE CASCADE/SET NULL, exclui
-- o registro de login (users) e por fim o colaborador — o que dispara a
-- limpeza em cascata de todo o resto (histórico de cargos, projetos,
-- avaliações NPS, citações, PIPJ, saques, benefícios, ocorrências, milhas,
-- pontuação e notificações).
DO $$
DECLARE
    v_colaborador_id uuid;
BEGIN
    SELECT id INTO v_colaborador_id
    FROM colaboradores
    WHERE email_corporativo = 'joaogabrielcavalcanticg@gmail.com'
      AND matricula = '20260001234';

    IF v_colaborador_id IS NULL THEN
        RAISE EXCEPTION 'Nenhum colaborador encontrado com esse email E essa matrícula ao mesmo tempo. Confira o PASSO 1 antes de excluir.';
    END IF;

    -- formularios.created_by não tem ON DELETE: se o usuário de teste criou
    -- algum template de formulário, perde o autor (o formulário continua existindo).
    UPDATE formularios SET created_by = NULL WHERE created_by = v_colaborador_id;

    -- formulario_respostas.alvo_colaborador_id não tem ON DELETE: se alguém
    -- respondeu um formulário direcionado tendo o usuário de teste como alvo,
    -- a resposta de quem respondeu é preservada, só perde o alvo.
    UPDATE formulario_respostas SET alvo_colaborador_id = NULL WHERE alvo_colaborador_id = v_colaborador_id;

    -- formulario_respostas.colaborador_id não tem ON DELETE: respostas que o
    -- próprio usuário de teste enviou são excluídas (formulario_respostas_itens
    -- cai em cascata via resposta_id).
    DELETE FROM formulario_respostas WHERE colaborador_id = v_colaborador_id;

    -- users.colaborador_id é ON DELETE SET NULL, então excluir o colaborador
    -- não apaga a conta de login sozinho — precisa excluir explicitamente.
    DELETE FROM users WHERE colaborador_id = v_colaborador_id;

    -- Dispara CASCADE em: historico_cargos, projetos_finalizados,
    -- avaliacoes_nps, citacoes, transacoes_pipj, solicitacoes_saque,
    -- resgates_beneficios, ocorrencias, solicitacoes_remocao, milhas_saldo,
    -- milhas_trocas, milhas_addition_requests, solicitacoes_pontuacao,
    -- pontuacao_notificacoes, audit_logs.
    DELETE FROM colaboradores WHERE id = v_colaborador_id;
END $$;
