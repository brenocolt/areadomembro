-- NPS Projetos — importa o histórico de avaliacoes_nps para dentro do
-- formulário genérico "NPS Projetos (Novo)" (f0a00000-...), como respostas
-- de verdade (formulario_respostas + formulario_respostas_itens). Sem isso,
-- o formulário novo nasce com 0 respostas em qualquer tela que leia
-- formulario_respostas diretamente (ex.: Respostas de Formulários), mesmo
-- a empresa já tendo centenas de avaliações antigas.
--
-- NÃO mexe em avaliacoes_nps nem em quem já lê essa tabela diretamente (aba
-- "NPS Projeto" antiga em Respostas de Formulários; Performance, PIPJ, NPS
-- Gerente e Wallet via src/lib/nps-projetos-generico.ts, Fase B) — o
-- histórico continua intacto nos dois lugares, sem duplicar. As respostas
-- migradas aqui não preenchem a pergunta colaborador_unico de cada seção
-- com um valor "de verdade" resolvido pela navegação do formulário — elas
-- só usam a seção do Gerente ou a da 1ª Dupla (ver abaixo) — e por isso a
-- leitura sintética da Fase B (que exige casar a resposta com uma seção
-- específica) não as enxerga: nenhuma duplicação em Performance/PIPJ/etc.
--
-- Cada linha de avaliacoes_nps vira UMA resposta:
--   - colaborador_id (quem respondeu)  = avaliador_id (ou o próprio
--     avaliado, se o avaliador não foi registrado na linha original)
--   - alvo_colaborador_id (quem foi avaliado) = colaborador_id da linha original
--   - enviado_em = created_at
-- Os itens usam sempre as perguntas da seção "Avalie o Gerente do Projeto"
-- (tipo_avaliacao='gerente') ou da 1ª dupla "Avalie sua Dupla (Consultor 1)"
-- (tipo_avaliacao='consultor') — o histórico não distinguia qual das até 3
-- duplas era, e cada avaliação antiga vira uma resposta própria (não há
-- duas seções concorrendo pela mesma resposta).
DO $mig$
DECLARE
    rec RECORD;
    resposta_id uuid;
BEGIN
    IF EXISTS (SELECT 1 FROM formulario_respostas WHERE formulario_id = 'f0a00000-0000-4000-8000-000000000000') THEN
        RAISE NOTICE 'NPS Projetos (Novo) já tem respostas — importação pulada (já rodou antes).';
        RETURN;
    END IF;

    FOR rec IN SELECT * FROM avaliacoes_nps LOOP
        resposta_id := gen_random_uuid();
        INSERT INTO formulario_respostas (id, formulario_id, colaborador_id, alvo_colaborador_id, enviado_em)
        VALUES (
            resposta_id,
            'f0a00000-0000-4000-8000-000000000000',
            COALESCE(NULLIF(rec.avaliador_id, '')::uuid, rec.colaborador_id),
            rec.colaborador_id,
            rec.created_at
        );

        IF rec.projeto_id IS NOT NULL AND trim(rec.projeto_id) <> '' THEN
            INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor)
            VALUES (gen_random_uuid(), resposta_id, 'f0a00000-0000-4000-8000-000000000001', rec.projeto_id);
        END IF;

        IF rec.tipo_avaliacao = 'gerente' THEN
            INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor)
            VALUES (gen_random_uuid(), resposta_id, 'f0a00000-0000-4000-8000-000000000004', rec.colaborador_id::text);

            IF rec.comunicacao IS NOT NULL THEN INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor) VALUES (gen_random_uuid(), resposta_id, 'f0a00000-0000-4000-8000-000000000005', rec.comunicacao::text); END IF;
            IF rec.suporte IS NOT NULL THEN INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor) VALUES (gen_random_uuid(), resposta_id, 'f0a00000-0000-4000-8000-000000000006', rec.suporte::text); END IF;
            IF rec.relacionamento IS NOT NULL THEN INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor) VALUES (gen_random_uuid(), resposta_id, 'f0a00000-0000-4000-8000-000000000007', rec.relacionamento::text); END IF;
            IF rec.resolutividade IS NOT NULL THEN INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor) VALUES (gen_random_uuid(), resposta_id, 'f0a00000-0000-4000-8000-000000000008', rec.resolutividade::text); END IF;
            IF rec.lideranca IS NOT NULL THEN INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor) VALUES (gen_random_uuid(), resposta_id, 'f0a00000-0000-4000-8000-000000000009', rec.lideranca::text); END IF;
            IF rec.feedback_texto IS NOT NULL AND trim(rec.feedback_texto) <> '' THEN INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor) VALUES (gen_random_uuid(), resposta_id, 'f0a0000a-0000-4000-8000-000000000000', rec.feedback_texto); END IF;
            IF rec.precisa_feedback IS NOT NULL THEN INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor) VALUES (gen_random_uuid(), resposta_id, 'f0a0000b-0000-4000-8000-000000000000', CASE WHEN rec.precisa_feedback THEN 'Sim' ELSE 'Não' END); END IF;
        ELSE
            INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor)
            VALUES (gen_random_uuid(), resposta_id, 'f0a0000d-0000-4000-8000-000000000000', rec.colaborador_id::text);

            IF rec.comunicacao IS NOT NULL THEN INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor) VALUES (gen_random_uuid(), resposta_id, 'f0a0000e-0000-4000-8000-000000000000', rec.comunicacao::text); END IF;
            IF rec.dedicacao IS NOT NULL THEN INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor) VALUES (gen_random_uuid(), resposta_id, 'f0a0000f-0000-4000-8000-000000000000', rec.dedicacao::text); END IF;
            IF rec.confianca IS NOT NULL THEN INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor) VALUES (gen_random_uuid(), resposta_id, 'f0a00010-0000-4000-8000-000000000000', rec.confianca::text); END IF;
            IF rec.pontualidade IS NOT NULL THEN INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor) VALUES (gen_random_uuid(), resposta_id, 'f0a00011-0000-4000-8000-000000000000', rec.pontualidade::text); END IF;
            IF rec.organizacao IS NOT NULL THEN INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor) VALUES (gen_random_uuid(), resposta_id, 'f0a00012-0000-4000-8000-000000000000', rec.organizacao::text); END IF;
            IF rec.proatividade IS NOT NULL THEN INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor) VALUES (gen_random_uuid(), resposta_id, 'f0a00013-0000-4000-8000-000000000000', rec.proatividade::text); END IF;
            IF rec.qualidade_entregas IS NOT NULL THEN INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor) VALUES (gen_random_uuid(), resposta_id, 'f0a00014-0000-4000-8000-000000000000', rec.qualidade_entregas::text); END IF;
            IF rec.dominio_tecnico IS NOT NULL THEN INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor) VALUES (gen_random_uuid(), resposta_id, 'f0a00015-0000-4000-8000-000000000000', rec.dominio_tecnico::text); END IF;
            IF rec.feedback_texto IS NOT NULL AND trim(rec.feedback_texto) <> '' THEN INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor) VALUES (gen_random_uuid(), resposta_id, 'f0a00016-0000-4000-8000-000000000000', rec.feedback_texto); END IF;
            IF rec.precisa_feedback IS NOT NULL THEN INSERT INTO formulario_respostas_itens (id, resposta_id, pergunta_id, valor) VALUES (gen_random_uuid(), resposta_id, 'f0a00017-0000-4000-8000-000000000000', CASE WHEN rec.precisa_feedback THEN 'Sim' ELSE 'Não' END); END IF;
        END IF;
    END LOOP;

    RAISE NOTICE 'Importação de avaliacoes_nps para NPS Projetos (Novo) concluída.';
END
$mig$;
