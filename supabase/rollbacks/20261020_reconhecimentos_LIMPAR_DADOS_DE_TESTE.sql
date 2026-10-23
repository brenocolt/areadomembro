-- LIMPEZA DOS DADOS DE TESTE da aba Reconhecimentos e Bonificações (uso ÚNICO, antes do uso real)
--
-- Para quê: o histórico é imutável POR DESENHO. Se você validar a aba no banco real, os registros de teste (e o
-- histórico deles) ficam. Este script zera SOMENTE os dados criados na aba, para começar o uso real do zero.
--
-- O que apaga (somente as tabelas novas desta aba): reconhecimentos, bonificações, entregas, regras e histórico.
-- O que MANTÉM: os 7 tipos de reconhecimento e a elegibilidade de núcleos (a estrutura).
-- O que NUNCA toca: qualquer tabela, função, policy ou dado preexistente (users, colaboradores, projetos, PIPJ...).
--
-- Como usar (2 passos, de propósito):
--   1) Rode como está (confirmar = false): é uma SIMULAÇÃO. Dá erro em vermelho com o que SERIA apagado, quantos
--      registros e QUEM os criou — confira que são só registros de teste.
--   2) Troque "confirmar ... := false" por "true" e rode de novo. Tudo ou nada (um único comando).
-- NÃO rode depois que o uso real começar: apagaria também os registros reais e o histórico deles. IRREVERSÍVEL
-- (tenha backup). Só o dono do banco (papel postgres do SQL Editor) consegue: ele desliga e religa o bloqueio do histórico.
DO $limpeza$
DECLARE
  confirmar constant boolean := false;   -- <<< troque para true no passo 2
  v_rec int; v_bon int; v_ent int; v_reg int; v_his int; v_autores text; v_n int;
BEGIN
  SELECT count(*) INTO v_rec FROM public.reconhecimentos;
  SELECT count(*) INTO v_bon FROM public.bonificacoes;
  SELECT count(*) INTO v_ent FROM public.bonificacao_entregas;
  SELECT count(*) INTO v_reg FROM public.regras_bonificacao;
  SELECT count(*) INTO v_his FROM public.reconhecimento_historico;
  SELECT coalesce(string_agg(usuario_email || ' (' || n || ' eventos)', ', ' ORDER BY n DESC), 'ninguém')
    INTO v_autores FROM (SELECT usuario_email, count(*) n FROM public.reconhecimento_historico GROUP BY usuario_email) a;

  IF NOT confirmar THEN
    RAISE EXCEPTION E'SIMULAÇÃO — nada foi apagado.\nSERIAM APAGADOS: % reconhecimentos, % bonificações, % entregas, % regras e % eventos de histórico.\nAutores dos eventos: %.\nSe forem só dados de teste, troque "confirmar ... := false" por "true" e rode de novo.',
      v_rec, v_bon, v_ent, v_reg, v_his, v_autores;
  END IF;

  ALTER TABLE public.reconhecimento_historico DISABLE TRIGGER rec_historico_imutavel_linha;
  ALTER TABLE public.reconhecimento_historico DISABLE TRIGGER rec_historico_imutavel_truncate;
  TRUNCATE public.reconhecimento_historico, public.bonificacao_entregas, public.bonificacoes,
           public.regras_bonificacao, public.reconhecimentos;
  ALTER TABLE public.reconhecimento_historico ENABLE TRIGGER rec_historico_imutavel_linha;
  ALTER TABLE public.reconhecimento_historico ENABLE TRIGGER rec_historico_imutavel_truncate;

  -- Trava de segurança: o bloqueio do histórico precisa ter voltado a valer, senão TUDO é desfeito.
  SELECT count(*) INTO v_n FROM pg_trigger g
   WHERE g.tgrelid = 'public.reconhecimento_historico'::regclass AND g.tgname LIKE 'rec_historico_imutavel_%' AND g.tgenabled = 'O';
  IF v_n <> 2 THEN RAISE EXCEPTION 'O bloqueio do histórico não foi religado; operação desfeita.'; END IF;
END
$limpeza$;
